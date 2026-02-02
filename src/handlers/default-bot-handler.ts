import { HandlerResponsesQueue } from '@cards-ts/core';
import { GameHandler, HandlerData } from '../game-handler.js';
import { SelectActiveCardResponseMessage, SetupCompleteResponseMessage, EvolveResponseMessage, AttackResponseMessage, PlayCardResponseMessage, EndTurnResponseMessage, AttachEnergyResponseMessage, SelectTargetResponseMessage, SelectEnergyResponseMessage, SelectCardResponseMessage, SelectChoiceResponseMessage } from '../messages/response/index.js';
import { ResponseMessage } from '../messages/response-message.js';
import { CardRepository } from '../repository/card-repository.js';
import { getCurrentTemplateId, getCurrentInstanceId } from '../utils/field-card-utils.js';
import { isPendingEnergySelection, isPendingCardSelection, isPendingChoiceSelection, isPendingFieldSelection } from '../effects/pending-selection-types.js';
import { FieldTargetResolver } from '../effects/target-resolvers/field-target-resolver.js';
import { Controllers } from '../controllers/controllers.js';
import { FieldEnergyTarget } from '../repository/targets/energy-target.js';
import { FieldTarget } from '../repository/targets/field-target.js';

export class DefaultBotHandler extends GameHandler {
    private cardRepository: CardRepository;
    
    constructor(cardRepository?: CardRepository) {
        super();
        this.cardRepository = cardRepository || new CardRepository();
    }
    
    handleAction(handlerData: HandlerData, responsesQueue: HandlerResponsesQueue<ResponseMessage>): void {
        const currentPlayer = handlerData.turn;
        
        // Get the player's hand
        const hand = handlerData.hand;
        
        // First try to play a creature card to the bench if possible
        const creatureCards = hand.filter(card => card.type === 'creature');
        const benchSize = handlerData.field.creatures[currentPlayer].length;
        
        if (creatureCards.length > 0 && benchSize < 3) {
            const cardIndex = hand.findIndex(card => card.type === 'creature');
            const card = hand[cardIndex];
            responsesQueue.push(new PlayCardResponseMessage(card.templateId, 'creature'));
            return;
        }
        
        if (!handlerData.turnState.supporterPlayedThisTurn) {
            const supporterCards = hand.filter(card => card.type === 'supporter');
            
            if (supporterCards.length > 0) {
                const cardIndex = hand.findIndex(card => card.type === 'supporter');
                const card = hand[cardIndex];
                responsesQueue.push(new PlayCardResponseMessage(card.templateId, 'supporter'));
                return;
            }
        }
        
        const itemCards = hand.filter(card => card.type === 'item');
        
        if (itemCards.length > 0) {
            const cardIndex = hand.findIndex(card => card.type === 'item');
            const card = hand[cardIndex];
            responsesQueue.push(new PlayCardResponseMessage(card.templateId, 'item', currentPlayer, 0));
            return;
        }
        
        // Try to evolve active creature if possible
        if (handlerData.field.canEvolveActive && (handlerData.field.canEvolveActive as boolean[])[currentPlayer]) {
            const activeCreature = handlerData.field.creatures[currentPlayer][0]; // Get active creature at position 0
            const activeCreatureData = this.cardRepository.getCreature(getCurrentTemplateId(activeCreature));
            const allCreatures = this.cardRepository.getAllCreatureIds();
            const evolution = allCreatures.find((id: string) => {
                const data = this.cardRepository.getCreature(id);
                return data?.previousStageName === activeCreatureData.name;
            });
            
            if (evolution) {
                responsesQueue.push(new EvolveResponseMessage(evolution, 0));
                return;
            }
        }
        
        // Try to attach energy if available and not first turn restricted
        if (handlerData.energy) {
            const isFirstTurnRestricted = handlerData.energy.isAbsoluteFirstTurn;
            const hasCurrentEnergy = handlerData.energy.currentEnergy[currentPlayer] !== null;
            
            if (hasCurrentEnergy && !isFirstTurnRestricted) {
                responsesQueue.push(new AttachEnergyResponseMessage(0));
                return;
            }
        }
        
        // Try to attack if we have sufficient energy
        const activeCard = handlerData.field.creatures[currentPlayer][0]; // Get active card at position 0
        if (activeCard && handlerData.energy) {
            const creatureData = this.cardRepository.getCreature(getCurrentTemplateId(activeCard));
            const attack = creatureData?.attacks[0];
            
            if (attack) {
                // Use the new energy system - attachedEnergyByInstance
                const instanceId = getCurrentInstanceId(activeCard);
                const attachedEnergy = handlerData.energy.attachedEnergyByInstance?.[instanceId];
                
                if (attachedEnergy) {
                    // Calculate total energy
                    const totalEnergy = Object.values(attachedEnergy).reduce((sum: number, count: unknown) => sum + (typeof count === 'number' ? count : 0), 0);
                    
                    // Check if we can use the attack
                    let canAttack = true;
                    for (const requirement of attack.energyRequirements) {
                        if (requirement.type === 'any' || requirement.type === 'colorless') {
                            if (totalEnergy < requirement.amount) {
                                canAttack = false;
                                break;
                            }
                        } else {
                            // Count specific energy type
                            const energyCount = attachedEnergy[requirement.type as keyof typeof attachedEnergy];
                            const typeCount = typeof energyCount === 'number' ? energyCount : 0;
                            if (typeCount < requirement.amount) {
                                canAttack = false;
                                break;
                            }
                        }
                    }
                    
                    if (canAttack) {
                        responsesQueue.push(new AttackResponseMessage(0));
                        return;
                    }
                }
            }
        }
        
        // End turn if no valid actions
        responsesQueue.push(new EndTurnResponseMessage());
    }
    
    handleSelectActiveCard(handlerData: HandlerData, responsesQueue: HandlerResponsesQueue<ResponseMessage>): void {
        // Bot always selects the first benched card
        responsesQueue.push(new SelectActiveCardResponseMessage(0));
    }
    
    handleSetup(handlerData: HandlerData, responsesQueue: HandlerResponsesQueue<ResponseMessage>): void {
        const hand = handlerData.hand;
        
        // Find all creature cards in hand
        const creatureCards = hand.filter(card => card.type === 'creature');
        
        if (creatureCards.length > 0) {
            // Bot selects first creature as active, others for bench (max 3 bench)
            const activeCard = creatureCards[0];
            const benchCards = creatureCards.slice(1, 4);
            
            // Create a setup complete message with the selected cards
            responsesQueue.push(new SetupCompleteResponseMessage(
                activeCard.templateId,
                benchCards.map(card => card.templateId),
            ));
        } else {
            // No creature cards in hand, just complete setup with default
            responsesQueue.push(new SetupCompleteResponseMessage(
                'basic-creature', // Use a default creature ID
                [],
            ));
        }
    }
    
    handleSelectTarget(handlerData: HandlerData, responsesQueue: HandlerResponsesQueue<SelectTargetResponseMessage>): void {
        const pendingSelection = handlerData.turnState.pendingSelection;
        if (!pendingSelection || !isPendingFieldSelection(pendingSelection)) {
            return;
        }
        
        // Use TargetResolver to get valid targets compositionally
        const { effect, originalContext } = pendingSelection;
        let target = 'target' in effect ? effect.target : undefined;
        
        if (!target || typeof target === 'string') {
            // No target selection needed or resolved already
            return;
        }
        
        // Extract field target from energy target if necessary
        if ('fieldTarget' in target) {
            target = (target as FieldEnergyTarget).fieldTarget;
        }
        
        /*
         * Convert handlerData to Controllers for TargetResolver
         * HandlerData is structurally compatible with Controllers (it's a view of Controllers)
         * This pattern is used throughout the codebase for handler methods
         */
        const controllers = handlerData as unknown as Controllers;
        const resolution = FieldTargetResolver.resolveTarget(target as FieldTarget, controllers, originalContext);
        
        if (resolution.type !== 'requires-selection' || resolution.availableTargets.length === 0) {
            return;
        }
        
        // For bot: select first N available targets up to count
        const targetCount = Math.min(pendingSelection.count || 1, resolution.availableTargets.length);
        const selectedTargets = resolution.availableTargets.slice(0, targetCount).map(t => ({
            playerId: t.playerId,
            fieldIndex: t.fieldIndex,
        }));
        
        responsesQueue.push(new SelectTargetResponseMessage(selectedTargets));
    }
    
    handleSelectEnergy(handlerData: HandlerData, responsesQueue: HandlerResponsesQueue<SelectEnergyResponseMessage>): void {
        const pendingSelection = handlerData.turnState.pendingSelection;
        if (!pendingSelection || !isPendingEnergySelection(pendingSelection)) {
            return;
        }
        
        const count = pendingSelection.count || 1;
        // Just select first energy type available (simplified bot logic)
        responsesQueue.push(new SelectEnergyResponseMessage(
            Array(count).fill('fire'), // Default to fire energy
        ));
    }
    
    handleSelectCard(handlerData: HandlerData, responsesQueue: HandlerResponsesQueue<SelectCardResponseMessage>): void {
        const pendingSelection = handlerData.turnState.pendingSelection;
        if (!pendingSelection || !isPendingCardSelection(pendingSelection)) {
            return;
        }
        
        const cardCount = pendingSelection.count || 1;
        // Get the actual cards from the specified location and extract their instance IDs
        const hand = handlerData.hand;
        const selectedInstanceIds = hand.slice(0, cardCount).map((card) => card.instanceId);
        responsesQueue.push(new SelectCardResponseMessage(selectedInstanceIds));
    }
    
    handleSelectChoice(handlerData: HandlerData, responsesQueue: HandlerResponsesQueue<SelectChoiceResponseMessage>): void {
        const pendingSelection = handlerData.turnState.pendingSelection;
        if (!pendingSelection || !isPendingChoiceSelection(pendingSelection)) {
            return;
        }
        
        const choiceCount = pendingSelection.count || 1;
        const selectedChoices = pendingSelection.choices?.slice(0, choiceCount).map((choice) => choice.value) || [];
        responsesQueue.push(new SelectChoiceResponseMessage(selectedChoices));
    }
}
