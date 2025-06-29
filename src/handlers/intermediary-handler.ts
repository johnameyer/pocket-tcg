import { GameHandler, HandlerData } from '../game-handler.js';
import { ResponseMessage } from '../messages/response-message.js';
import { SelectActiveCardResponseMessage } from '../messages/response/index.js';
import { AttackResponseMessage } from '../messages/response/attack-response-message.js';
import { PlayCardResponseMessage } from '../messages/response/play-card-response-message.js';
import { EndTurnResponseMessage } from '../messages/response/end-turn-response-message.js';
import { SetupCompleteResponseMessage, EvolveResponseMessage } from '../messages/response/index.js';
import { Intermediary, Message } from '@cards-ts/core';
import { HandlerResponsesQueue } from '@cards-ts/core';
import { Controllers } from '../controllers/controllers.js';
import { GameCard } from '../controllers/card-types.js';
import { FieldCard } from '../controllers/field-controller.js';
import { CreatureAttack } from '../repository/card-types.js';
import { CardRepository } from "../repository/card-repository.js";

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
        
        responsesQueue.push(new EndTurnResponseMessage());
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
        const damage = typeof attack.damage === 'number' ? attack.damage : 20;
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
    responsesQueue.push(new AttackResponseMessage(attackIndex));
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
        let cardDescription = '';
        
        if (card.type === 'creature') {
            const { name } = cardRepo.getCreature(card.cardId);
            
            // Check if bench is full
            const benchSize = handlerData.field.benchedCards[currentPlayer].length;
            if (benchSize >= 3) {
                cardDescription = ' (Bench is full!)';
            }
            
            return {
                name: `${name}${cardDescription}`,
                value: index
            };
        } else if (card.type === 'item') {
            const itemData = cardRepo.getItem(card.cardId);
            // Use effects instead of effect
            if (itemData && itemData.effects && itemData.effects.length > 0) {
                cardDescription = ` - Healing item`;
            }
            
            return {
                name: `${itemData.name}${cardDescription}`,
                value: index
            };
        } else if (card.type === 'supporter') {
            const { name } = cardRepo.getSupporter(card.cardId);
            
            // Check if a supporter has already been played this turn
            if (handlerData.turnState.supporterPlayedThisTurn) {
                cardDescription = ' (Already played a Supporter this turn!)';
            } else {
                cardDescription = ` - Supporter card`;
            }
            
            return {
                name: `${name}${cardDescription}`,
                value: index
            };
        }
        
        // This should never happen with proper typing
        throw new Error(`Unknown card type: ${card.type}`);
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
            const activeCardData = cardRepo.getCreature(activeCard.cardId);
            const { name, maxHp } = activeCardData;
            const activeHp = Math.max(0, maxHp - activeCard.damageTaken);
            cardOptions.push({
                name: `${name} (${activeHp} HP) - Active`,
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
    
    const card = handlerData.hand[cardIndex];
    const cardType = card.type === 'tool' ? 'item' : card.type;
    responsesQueue.push(new PlayCardResponseMessage(card.cardId, cardType, targetPlayerId, targetFieldIndex));
};

export class IntermediaryHandler extends GameHandler {
    
    constructor(private intermediary: Intermediary, private cardRepository: CardRepository) {
        super();
    }
    
    async handleEvolve(handlerData: HandlerData, responsesQueue: HandlerResponsesQueue<ResponseMessage>): Promise<void> {
        const currentPlayer = handlerData.turn;
        const hand = handlerData.hand;
        const cardRepo = this.cardRepository;
        
        // Find evolution cards in hand
        const evolutionCards = hand.filter(card => card.type === 'creature');
        
        if (evolutionCards.length === 0) {
            await this.intermediary.form({
                type: 'print',
                message: ['No evolution cards in hand.']
            });
            return;
        }
        
        // Create options for each evolution card
        const evolutionOptions = evolutionCards.map((card, index) => {
            const creatureData = cardRepo.getCreature(card.cardId);
            return {
                name: creatureData.name,
                value: card.cardId
            };
        });
        
        // Add cancel option
        evolutionOptions.push({ name: 'Cancel', value: 'cancel' });
        
        // Ask player to choose an evolution card
        const [evolutionSent, evolutionReceived] = this.intermediary.form({
            type: 'list',
            message: [`Player ${currentPlayer + 1}, choose a creature to evolve with:`],
            choices: evolutionOptions
        });
        
        const evolutionId = (await evolutionReceived)[0] as string;
        
        if (evolutionId === 'cancel') {
            await this.intermediary.form({
                type: 'print',
                message: ['Evolution cancelled.']
            });
            return;
        }
        
        // Create options for target (active or bench)
        const targetOptions = [];
        
        // Add active card
        const activeCard = handlerData.field.activeCards[currentPlayer];
        const activeCardData = cardRepo.getCreature(activeCard.cardId);
        targetOptions.push({
            name: `${activeCardData.name} (Active)`,
            value: { isActive: true }
        });
        
        // Add benched cards
        const benchedCards = handlerData.field.benchedCards[currentPlayer];
        benchedCards.forEach((card: FieldCard, index: number) => {
            const cardData = cardRepo.getCreature(card.cardId);
            targetOptions.push({
                name: `${cardData.name} (Bench ${index + 1})`,
                value: { isActive: false, benchIndex: index }
            });
        });
        
        // Add cancel option
        targetOptions.push({ name: 'Cancel', value: 'cancel' });
        
        // Ask player to choose a target
        const [targetSent, targetReceived] = this.intermediary.form({
            type: 'list',
            message: [`Choose a creature to evolve:`],
            choices: targetOptions
        });
        
        const target = (await targetReceived)[0] as { isActive: boolean, benchIndex?: number } | 'cancel';
        
        if (target === 'cancel') {
            await this.intermediary.form({
                type: 'print',
                message: ['Evolution cancelled.']
            });
            return;
        }
        
        // Create evolution response
        if (target.isActive) {
            responsesQueue.push(new EvolveResponseMessage(
                evolutionId,
                true
            ));
        } else {
            responsesQueue.push(new EvolveResponseMessage(
                evolutionId,
                false,
                target.benchIndex
            ));
        }
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
            const benchOptions = benchedCards.map((card: FieldCard, index: number) => ({
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
    
    async handleSetup(handlerData: HandlerData, responsesQueue: HandlerResponsesQueue<ResponseMessage>): Promise<void> {
        const currentPlayer = handlerData.turn;
        const hand = handlerData.hand;
        
        await this.intermediary.form({
            type: 'print',
            message: [`Player ${currentPlayer + 1}, setup phase: Select cards for your team.`]
        });
        
        const creatureCards = hand.filter(card => card.type === 'creature');
        
        if (creatureCards.length === 0) {
            await this.intermediary.form({
                type: 'print',
                message: ['No creature cards in hand. Finishing setup.']
            });
            responsesQueue.push(new SetupCompleteResponseMessage('basic-creature', []));
            return;
        }
        
        // Let player select multiple creature cards using checkbox
        const creatureOptions = creatureCards.map((card, index) => {
            const creatureData = this.cardRepository.getCreature(card.cardId);
            const originalIndex = hand.findIndex(handCard => handCard === card);
            return {
                name: creatureData?.name || 'Creature',
                value: originalIndex
            };
        });
        
        const [checkboxSent, checkboxReceived] = this.intermediary.form({
            type: 'checkbox',
            message: ['Select creatures for your team (1 active + up to 3 bench):'],
            choices: creatureOptions,
            validate: (selected: number[]) => {
                if (selected.length === 0) return 'Must select at least one creature';
                if (selected.length > 4) return 'Can select maximum 4 creatures (1 active + 3 bench)';
                return true;
            }
        });
        
        const selectedIndices = (await checkboxReceived)[0] as number[];
        
        if (selectedIndices.length === 0) {
            // Default to first creature
            selectedIndices.push(creatureOptions[0].value);
        }
        
        // Choose which creature to make active
        const activeOptions = selectedIndices.map(index => {
            const card = hand[index];
            const creatureData = this.cardRepository.getCreature(card.cardId);
            return {
                name: creatureData?.name || 'Creature',
                value: card.cardId
            };
        });
        
        const [activeSent, activeReceived] = this.intermediary.form({
            type: 'list',
            message: ['Choose your active creature:'],
            choices: activeOptions
        });
        
        const activeCardId = (await activeReceived)[0] as string;
        const benchCardIds = selectedIndices
            .map(index => hand[index].cardId)
            .filter(cardId => cardId !== activeCardId);
        
        responsesQueue.push(new SetupCompleteResponseMessage(activeCardId, benchCardIds));
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
        
        const globalTurn = handlerData.turnCounter?.turnNumber || 0;
        
        const statusLines = [
            `=== Your Turn (Turn: ${globalTurn}) ===`,
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
