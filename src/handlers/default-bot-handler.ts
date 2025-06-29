import { GameHandler, HandlerData } from '../game-handler.js';
import { SelectActiveCardResponseMessage, SetupCompleteResponseMessage, EvolveResponseMessage, AttackResponseMessage, PlayCardResponseMessage, EndTurnResponseMessage, AttachEnergyResponseMessage } from '../messages/response/index.js';
import { ResponseMessage } from '../messages/response-message.js';
import { HandlerResponsesQueue } from '@cards-ts/core';
import { CardRepository } from "../repository/card-repository.js";

export class DefaultBotHandler extends GameHandler {
    private cardRepository: CardRepository;
    
    constructor(cardRepository?: CardRepository) {
        super();
        this.cardRepository = cardRepository || new CardRepository();
    }
    
    handleEvolve(handlerData: HandlerData, responsesQueue: HandlerResponsesQueue<ResponseMessage>): void {
        // Bot always evolves the first available creature
        const currentPlayer = handlerData.turn;
        const hand = handlerData.hand;
        
        // Find evolution cards in hand
        const evolutionCards = hand.filter(card => card.type === 'creature');
        
        if (evolutionCards.length > 0) {
            // Get the first evolution card
            const evolutionCard = evolutionCards[0];
            
            // Evolve the active creature by default
            responsesQueue.push(new EvolveResponseMessage(
                evolutionCard.cardId,
                true // isActive
            ));
        }
    }
    
    handleAction(handlerData: HandlerData, responsesQueue: HandlerResponsesQueue<ResponseMessage>): void {
        const currentPlayer = handlerData.turn;
        
        // Get the player's hand
        const hand = handlerData.hand;
        
        // First try to play a creature card to the bench if possible
        const creatureCards = hand.filter(card => card.type === 'creature');
        const benchSize = handlerData.field.benchedCards[currentPlayer].length;
        
        if (creatureCards.length > 0 && benchSize < 3) {
            const cardIndex = hand.findIndex(card => card.type === 'creature');
            const card = hand[cardIndex];
            responsesQueue.push(new PlayCardResponseMessage(card.cardId, 'creature'));
            return;
        }
        
        if (!handlerData.turnState.supporterPlayedThisTurn) {
            const supporterCards = hand.filter(card => card.type === 'supporter');
            
            if (supporterCards.length > 0) {
                const cardIndex = hand.findIndex(card => card.type === 'supporter');
                const card = hand[cardIndex];
                responsesQueue.push(new PlayCardResponseMessage(card.cardId, 'supporter'));
                return;
            }
        }
        
        const itemCards = hand.filter(card => card.type === 'item');
        
        if (itemCards.length > 0) {
            const cardIndex = hand.findIndex(card => card.type === 'item');
            const card = hand[cardIndex];
            responsesQueue.push(new PlayCardResponseMessage(card.cardId, 'item', currentPlayer, 0));
            return;
        }
        
        // Try to evolve active creature if possible
        if (handlerData.field.canEvolveActive && (handlerData.field.canEvolveActive as boolean[])[currentPlayer]) {
            const activeCreature = handlerData.field.activeCards[currentPlayer];
            const allCreatures = this.cardRepository.getAllCreatureIds();
            const evolution = allCreatures.find((id: string) => {
                const data = this.cardRepository.getCreature(id);
                return data?.evolvesFrom === activeCreature.cardId;
            });
            
            if (evolution) {
                responsesQueue.push(new EvolveResponseMessage(evolution, true));
                return;
            }
        }
        
        // Try to attach energy if available and not first turn restricted
        if (handlerData.energy) {
            const isFirstTurnRestricted = handlerData.energy.isAbsoluteFirstTurn;
            const energyAttachedThisTurn = handlerData.energy.energyAttachedThisTurn[currentPlayer];
            
            if (!energyAttachedThisTurn && !isFirstTurnRestricted) {
                responsesQueue.push(new AttachEnergyResponseMessage(0));
                return;
            }
        }
        
        // Try to attack if we have sufficient energy
        const activeCard = handlerData.field.activeCards[currentPlayer];
        if (activeCard && handlerData.energy) {
            const creatureData = this.cardRepository.getCreature(activeCard.cardId);
            const attack = creatureData?.attacks[0];
            
            if (attack) {
                const attachedEnergy = handlerData.energy.attachedEnergy[currentPlayer][0];
                const totalEnergy = attachedEnergy ? attachedEnergy.length : 0;
                
                // Use exact same logic as controllers.energy.canUseAttack()
                let canAttack = true;
                for (const requirement of attack.energyRequirements) {
                    if (requirement.type === 'colorless') {
                        if (totalEnergy < requirement.amount) {
                            canAttack = false;
                            break;
                        }
                    } else {
                        // Count specific energy type
                        const typeCount = attachedEnergy ? 
                            attachedEnergy.filter(e => e.type === requirement.type).length : 0;
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
                activeCard.cardId,
                benchCards.map(card => card.cardId)
            ));
        } else {
            // No creature cards in hand, just complete setup with default
            responsesQueue.push(new SetupCompleteResponseMessage(
                'basic-creature', // Use a default creature ID
                []
            ));
        }
    }
}
