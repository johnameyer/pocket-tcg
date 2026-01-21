import { GameHandler, HandlerData } from '../game-handler.js';
import { ResponseMessage } from '../messages/response-message.js';
import { SelectActiveCardResponseMessage, SelectTargetResponseMessage } from '../messages/response/index.js';
import { SetupCompleteResponseMessage } from '../messages/response/index.js';
import { Intermediary } from '@cards-ts/core';
import { HandlerResponsesQueue } from '@cards-ts/core';
import { Controllers } from '../controllers/controllers.js';
import { TargetResolver } from '../effects/target-resolver.js';
import { EnergyController } from '../controllers/energy-controller.js';
import * as helpers from './intermediary-handler-helpers.js';
import { FieldCard } from '../controllers/field-controller.js';
import { CardRepository } from '../repository/card-repository.js';
import { toFieldCard } from '../utils/field-card-utils.js';

export class IntermediaryHandler extends GameHandler {
    
    constructor(private intermediary: Intermediary, private cardRepository: CardRepository) {
        super();
    }
    
    async handleAction(handlerData: HandlerData, responsesQueue: HandlerResponsesQueue<ResponseMessage>): Promise<void> {
        const currentPlayer = handlerData.turn;
        
        // Get the active card for the current player
        const activeCard = handlerData.field.creatures?.[currentPlayer]?.[0];
        
        if (!activeCard) {
            return;
        }

        // Show player status at start of turn
        await helpers.showPlayerStatus(this.cardRepository, this.intermediary, handlerData, currentPlayer);

        // Handle actions for all players
        await helpers.handleAction(this.cardRepository, this.intermediary, handlerData, responsesQueue);
    }
    
    async handleSelectActiveCard(handlerData: HandlerData, responsesQueue: HandlerResponsesQueue<ResponseMessage>): Promise<void> {
        // Get the player who needs to select a new active card
        const playerId = handlerData.players.position;
        const cardRepo = this.cardRepository;
        
        // Get benched cards for the player
        const benchedCardsData = handlerData.field.creatures[playerId].map(toFieldCard);
        
        // Convert raw card data to display format with names and HP
        const benchedCards = benchedCardsData.map((card: FieldCard) => {
            const { name, maxHp } = cardRepo.getCreature(card.templateId);
            return {
                ...card,
                name,
                hp: Math.max(0, maxHp - card.damageTaken)
            };
        });
        
        if (benchedCards && benchedCards.length > 0) {
            // Create options for each benched card
            const benchOptions = benchedCards.map((card: FieldCard, index: number) => {
                const cardData = this.cardRepository.getCreature(card.templateId);
                return {
                    name: `${cardData.name} (HP: ${cardData.maxHp})`,
                    value: index
                };
            });
            
            const [ sent, received ] = this.intermediary.form({ 
                type: 'list', 
                message: [ `Player ${playerId + 1}, select a card to make active:` ],
                choices: benchOptions
            });
            
            const benchIndex = (await received)[0] as number;
            responsesQueue.push(new SelectActiveCardResponseMessage(benchIndex));
        }
    }
    
    async handleSelectTarget(handlerData: HandlerData, responsesQueue: HandlerResponsesQueue<ResponseMessage>): Promise<void> {
        const currentPlayer = handlerData.turn;
        const pendingEffect = handlerData.turnState.pendingTargetSelection;
        
        if (!pendingEffect) {
            return;
        }
        
        // Use the original context directly
        const context = pendingEffect.originalContext;
        
        // Get the target from the effect (if it has one)
        const target = 'target' in pendingEffect.effect ? pendingEffect.effect.target : undefined;
        
        if (!target || typeof target === 'string') {
            return;
        }
        
        // Use TargetResolver with Controllers (converted from HandlerData)
        // TODO: This is a temporary solution until we fully refactor all methods to use HandlerData
        const controllers = handlerData as unknown as Controllers;
        const resolution = TargetResolver.resolveTarget(target, controllers, context);
        
        if (resolution.type !== 'requires-selection' || resolution.availableTargets.length === 0) {
            return;
        }
        
        // Convert available targets to options for the form
        const targetOptions = resolution.availableTargets.map(target => ({
            name: `${target.name} (${target.hp} HP) - ${target.position === 'active' ? 'Active' : 'Bench'}`,
            value: { playerId: target.playerId, fieldIndex: target.fieldIndex }
        }));
        
        // Determine the appropriate message based on the effect type
        let effectMessage = 'Choose target for the effect:';
        if (pendingEffect.effect.type === 'switch') {
            if (target.type === 'single-choice' && target.chooser === 'opponent') {
                effectMessage = 'Choose which of your FieldCard to switch in:';
            } else {
                effectMessage = 'Choose which FieldCard to force into battle:';
            }
        }
            
        const [sent, received] = this.intermediary.form({
            type: 'list',
            message: [effectMessage],
            choices: targetOptions
        });
        
        const selection = (await received)[0] as unknown as { playerId: number; fieldIndex: number };
        responsesQueue.push(new SelectTargetResponseMessage(selection.playerId, selection.fieldIndex));
    }
    
    async handleSelectMultiTarget(handlerData: HandlerData, responsesQueue: HandlerResponsesQueue<ResponseMessage>): Promise<void> {
        // Placeholder for multi-target selection
        // This would be similar to handleSelectTarget but allow multiple selections
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
            const creatureData = this.cardRepository.getCreature(card.templateId);
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
            const creatureData = this.cardRepository.getCreature(card.templateId);
            return {
                name: creatureData?.name || 'Creature',
                value: card.templateId
            };
        });
        
        const [activeSent, activeReceived] = this.intermediary.form({
            type: 'list',
            message: ['Choose your active creature:'],
            choices: activeOptions
        });
        
        const activeCardId = (await activeReceived)[0] as string;
        const benchCardIds = selectedIndices
            .map(index => hand[index].templateId)
            .filter(cardId => cardId !== activeCardId);
        
        responsesQueue.push(new SetupCompleteResponseMessage(activeCardId, benchCardIds));
    }
}
