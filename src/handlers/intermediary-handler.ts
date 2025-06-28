import { GameHandler, HandlerData } from '../game-handler.js';
import { ResponseMessage } from '../messages/response-message.js';
import { SelectActiveCardResponseMessage } from '../messages/response/index.js';
import { Action, ActionResponseMessage } from '../messages/response/action-response-message.js';
import { Intermediary, Message } from '@cards-ts/core';
import { HandlerResponsesQueue } from '@cards-ts/core';
import { Controllers } from '../controllers/controllers.js';
import { GameCard } from '../controllers/card-types.js';
import { CardRepository, CreatureAttack } from '../card-repository.js';
import { FieldCard } from '../controllers/field-controller.js';

const toInquirerValue = <T extends {toString: () => string}>(t: T) => ({
    name: t.toString(),
    value: t,
});

const handleAction = async (intermediary: Intermediary, handlerData: HandlerData, responsesQueue: HandlerResponsesQueue<ResponseMessage>, cardRepository: CardRepository) => {
    const currentPlayer = handlerData.turn;
    
    // Define action options
    const actionOptions = [
        { name: 'Attack', value: 'attack' },
        { name: 'Play a card', value: 'play' },
        { name: 'End turn', value: 'endTurn' }
    ];
    
    // Ask player to choose an action
    const [actionSent, actionReceived] = intermediary.form({
        type: 'list',
        message: [`Player ${currentPlayer + 1}, choose your action:`],
        choices: actionOptions
    });
    
    const actionType = (await actionReceived)[0] as string;
    
    if (actionType === 'attack') {
        await handleAttack(intermediary, handlerData, responsesQueue, cardRepository);
    } else if (actionType === 'play') {
        await handlePlayCard(intermediary, handlerData, responsesQueue, cardRepository);
    } else if (actionType === 'endTurn') {
        // Inform the player
        await intermediary.form({ 
            type: 'print', 
            message: ['Ending your turn.'] 
        });
        
        // Send an endTurn action response
        responsesQueue.push(new ActionResponseMessage({
            type: 'endTurn'
        }));
    }
};

const handleAttack = async (intermediary: Intermediary, handlerData: HandlerData, responsesQueue: HandlerResponsesQueue<ResponseMessage>, cardRepository: CardRepository) => {
    const currentPlayer = handlerData.turn;
    const cardRepo = cardRepository;
    
    // Get the active card for the current player
    const activeCard = handlerData.field.activeCards[currentPlayer];
    const cardData = cardRepo.getCreature(activeCard.cardId);
    
    if (!cardData) {
        return;
    }
    
    // Get attacks from card
    const attackOptions = cardData.attacks.map((attack: CreatureAttack, index: number) => {
        const damage = attack.damage;
        return {
            name: `${attack.name} (${damage} damage)`,
            value: index
        };
    });
    
    // Add back option
    attackOptions.push({ name: 'Back', value: -1 });
    
    const [sent, received] = intermediary.form({ 
        type: 'list', 
        message: [`Player ${currentPlayer + 1}, choose your attack with ${cardData ? cardData.name : 'your card'}:`],
        choices: attackOptions
    });
    
    const attackIndex = (await received)[0] as number;
    
    // Handle back option
    if (attackIndex === -1) {
        await handleAction(intermediary, handlerData, responsesQueue, cardRepository);
        return;
    }
    
    // Create an attack action
    const attackAction: Action = {
        type: 'attack',
        attackIndex: attackIndex
    };
    
    responsesQueue.push(new ActionResponseMessage(attackAction));
};

const handlePlayCard = async (intermediary: Intermediary, handlerData: HandlerData, responsesQueue: HandlerResponsesQueue<ResponseMessage>, cardRepository: CardRepository) => {
    const currentPlayer = handlerData.turn;
    const cardRepo = cardRepository;
    
    // Get the player's hand
    const hand = handlerData.hand;
    
    if (!hand || hand.length === 0) {
        await intermediary.form({ type: 'print', message: ['Your hand is empty. Wait for your next turn to draw a card.'] });
        // Return to action selection instead of sending an invalid play action
        await handleAction(intermediary, handlerData, responsesQueue, cardRepository);
        return;
    }
    
    // Create options for each card in hand with type information
    const cardOptions = hand.map((card: GameCard, index) => {
        let cardName = undefined;
        let cardDescription = '';
        
        if (card.type === 'creature') {
            const { name } = cardRepo.getCreature(card.cardId);
            cardName = name;
            
            // Check if bench is full
            const benchSize = handlerData.field.benchedCards[currentPlayer].length;
            if (benchSize >= 3) {
                cardDescription = ' (Bench is full!)';
            }
        } else if (card.type === 'item') {
            const { name, effects } = cardRepo.getItem(card.cardId);
            cardName = name;
            if (effects.length > 0) {
                cardDescription = ` - Healing item`;
            }
        } else if (card.type === 'supporter') {
            const { name } = cardRepo.getSupporter(card.cardId);
            cardName = name;
            
            // Check if a supporter has already been played this turn
            if (handlerData.turnState.supporterPlayedThisTurn) {
                cardDescription = ' (Already played a Supporter this turn!)';
            } else {
                cardDescription = ` - Supporter card`;
            }
        }
        
        return {
            name: `[${card.type.toUpperCase()}] ${cardName}${cardDescription} (Card ${index + 1})`,
            value: index
        };
    });
    
    // Add back option
    cardOptions.push({ name: 'Back', value: -1 });
    
    const [sent, received] = intermediary.form({
        type: 'list',
        message: [`Player ${currentPlayer + 1}, choose a card to play:`],
        choices: cardOptions
    });
    
    const cardIndex = (await received)[0] as number;
    
    // Handle back option
    if (cardIndex === -1) {
        await handleAction(intermediary, handlerData, responsesQueue, cardRepository);
        return;
    }
    
    const selectedCard = hand[cardIndex];
    
    // For item cards, ask for a target
    let targetPlayerId = currentPlayer; // Default to self
    let targetFieldIndex = 0; // Default to active card
    
    if (selectedCard.type === 'item') {
        const itemData = cardRepo.getItem(selectedCard.cardId);
        
        // Only ask for target if it's a healing item
        if (itemData && itemData.effects && itemData.effects.some((effect: { type: string }) => effect.type === 'heal')) {
            // Create options for player's cards (active + bench)
            const cardOptions = [];
            
            // Add active card
            const activeCard = handlerData.field.activeCards[currentPlayer];
            const { name: activeName, maxHp: activeMaxHp } = cardRepo.getCreature(activeCard.cardId);
            const activeHp = Math.max(0, activeMaxHp - activeCard.damageTaken);
            cardOptions.push({
                name: `${activeName} (${activeHp} HP) - Active`,
                value: 0
            });
            
            // Add benched cards
            const benchedCards = handlerData.field.benchedCards[currentPlayer];
            benchedCards.forEach((card: FieldCard, index: number) => {
                const { name, maxHp } = cardRepo.getCreature(card.cardId);
                const hp = Math.max(0, maxHp - card.damageTaken);
                cardOptions.push({
                    name: `${name} (${hp} HP) - Bench`,
                    value: index + 1
                });
            });
            
            // Add back option
            cardOptions.push({ name: 'Back', value: -1 });
            
            const [targetSent, targetReceived] = intermediary.form({
                type: 'list',
                message: [`Choose a card to heal with your ${itemData.name}:`],
                choices: cardOptions
            });
            
            targetFieldIndex = (await targetReceived)[0] as number;
            
            // Handle back option
            if (targetFieldIndex === -1) {
                await handlePlayCard(intermediary, handlerData, responsesQueue, cardRepository);
                return;
            }
        }
    }
    
    // Create a play card action
    const playAction: Action = {
        type: 'play',
        cardIndex: cardIndex,
        targetPlayerId: targetPlayerId,
        targetFieldIndex: targetFieldIndex
    };
    
    responsesQueue.push(new ActionResponseMessage(playAction));
};

export class IntermediaryHandler extends GameHandler {
    private cardRepository: CardRepository;
    
    constructor(private intermediary: Intermediary, cardRepository?: CardRepository) {
        super();
        this.cardRepository = cardRepository || new CardRepository();
    }

    async handleAction(handlerData: HandlerData, responsesQueue: HandlerResponsesQueue<ResponseMessage>): Promise<void> {
        const currentPlayer = handlerData.turn;
        
        // Get the active card for the current player
        const activeCard = handlerData.field.activeCards?.[currentPlayer];
        
        if (!activeCard) {
            return;
        }

        // Show player status at start of turn
        await this.showPlayerStatus(handlerData, currentPlayer);

        // Handle actions for all players
        await handleAction(this.intermediary, handlerData, responsesQueue, this.cardRepository);
    }
    
    async handleSelectActiveCard(handlerData: HandlerData, responsesQueue: HandlerResponsesQueue<ResponseMessage>): Promise<void> {
        // Get the player who needs to select a new active card
        const playerId = handlerData.players.position;
        const cardRepo = this.cardRepository;
        
        // Get benched cards for the player
        const benchedCardsData = handlerData.field.benchedCards[playerId];
        
        // Convert raw card data to display format with names and HP
        const benchedCards = benchedCardsData.map(card => {
            const { name, maxHp } = cardRepo.getCreature(card.cardId);
            return {
                ...card,
                name,
                hp: Math.max(0, maxHp - card.damageTaken)
            };
        });
        
        if (benchedCards && benchedCards.length > 0) {
            // Create options for each benched card
            const benchOptions = benchedCards.map((card, index: number) => ({
                name: `${card.name} (HP: ${card.hp})`,
                value: index
            }));
            
            const [ sent, received ] = this.intermediary.form({ 
                type: 'list', 
                message: [ `Player ${playerId + 1}, select a card to make active:` ],
                choices: benchOptions
            });
            
            const benchIndex = (await received)[0] as number;
            responsesQueue.push(new SelectActiveCardResponseMessage(benchIndex));
        }
    }
    
    private async showPlayerStatus(handlerData: HandlerData, playerId: number): Promise<void> {
        const hand = handlerData.hand;
        const activeCard = handlerData.field.activeCards[playerId];
        const benchedCards = handlerData.field.benchedCards[playerId];
        const supporterPlayed = handlerData.turnState.supporterPlayedThisTurn;
        const cardRepo = this.cardRepository;
        
        // Get active card info
        const { name, maxHp } = cardRepo.getCreature(activeCard.cardId);
        const cardName = name;
        const cardHp = Math.max(0, maxHp - activeCard.damageTaken);
        
        // Get hand summary
        const handSummary = hand.map((card: GameCard) => {
            if (card.type === 'creature') {
                const { name } = cardRepo.getCreature(card.cardId);
                return name;
            } else if (card.type === 'supporter') {
                const { name } = cardRepo.getSupporter(card.cardId);
                return name;
            } else if (card.type === 'item') {
                const { name } = cardRepo.getItem(card.cardId);
                return name;
            }
            return 'Unknown';
        });
        
        const statusLines = [
            `=== Your Turn ===`,
            `Active Card: ${cardName} (${cardHp} HP)`,
            `Bench: ${benchedCards.length}/3 Cards`,
            `Hand (${hand.length} cards): ${handSummary.join(', ')}`,
            `Supporter played this turn: ${supporterPlayed ? 'Yes' : 'No'}`,
            `================`
        ];
        
        await this.intermediary.form({
            type: 'print',
            message: statusLines
        });
    }
}
