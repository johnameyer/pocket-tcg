import { GameHandler, HandlerData } from '../game-handler.js';
import { SelectActiveCardResponseMessage, SetupCompleteResponseMessage, EvolveResponseMessage, AttackResponseMessage, PlayCardResponseMessage, EndTurnResponseMessage, AttachEnergyResponseMessage } from '../messages/response/index.js';
import { ResponseMessage } from '../messages/response-message.js';
import { HandlerResponsesQueue } from '@cards-ts/core';
import { CardRepository } from '../repository/card-repository.js';

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
            const allCreatures = this.cardRepository.getAllCreatureIds();
            const evolution = allCreatures.find((id: string) => {
                const data = this.cardRepository.getCreature(id);
                return data?.evolvesFrom === activeCreature.templateId;
            });
            
            if (evolution) {
                responsesQueue.push(new EvolveResponseMessage(evolution, 0));
                return;
            }
        }
        
        // Try to attach energy if available and not first turn restricted
        if (handlerData.energy) {
            const isFirstTurnRestricted = handlerData.energy.isAbsoluteFirstTurn;
            const energyAvailable = handlerData.energy.currentEnergy[currentPlayer] !== null;
            
            if (energyAvailable && !isFirstTurnRestricted) {
                responsesQueue.push(new AttachEnergyResponseMessage(0));
                return;
            }
        }
        
        // Try to attack if we have sufficient energy
        const activeCard = handlerData.field.creatures[currentPlayer][0]; // Get active card at position 0
        if (activeCard && handlerData.energy) {
            const creatureData = this.cardRepository.getCreature(activeCard.templateId);
            const attack = creatureData?.attacks[0];
            
            if (attack) {
                // Use the new energy system - attachedEnergyByInstance
                const instanceId = activeCard.instanceId;
                const attachedEnergy = handlerData.energy.attachedEnergyByInstance?.[instanceId];
                
                if (attachedEnergy) {
                    // Calculate total energy
                    const totalEnergy = Object.values(attachedEnergy).reduce((sum: number, count: unknown) => 
                        sum + (typeof count === 'number' ? count : 0), 0);
                    
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
                benchCards.map(card => card.templateId)
            ));
        } else {
            // No creature cards in hand - this shouldn't happen in normal gameplay
            // But if it does, we need to handle it gracefully
            throw new Error('No creature cards available for setup');
        }
    }
}
