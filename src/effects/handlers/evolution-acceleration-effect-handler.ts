import { Controllers } from '../../controllers/controllers.js';
import { CardRepository } from '../../repository/card-repository.js';
import { EvolutionAccelerationEffect } from '../../repository/effect-types.js';
import { EffectContext } from '../effect-context.js';
import { AbstractEffectHandler, ResolutionRequirement } from '../interfaces/effect-handler-interface.js';
import { getCreatureFromTarget } from '../effect-utils.js';
import { HandlerData } from '../../game-handler.js';
import { TargetResolver } from '../target-resolver.js';
import { GameCard } from '../../controllers/card-types.js';
import { getCurrentTemplateId } from '../../utils/field-card-utils.js';

/**
 * Handler for evolution acceleration effects that allow evolving a creature directly
 * from Basic to Stage 2, skipping Stage 1.
 */
export class EvolutionAccelerationEffectHandler extends AbstractEffectHandler<EvolutionAccelerationEffect> {
    /**
     * Validate if an evolution acceleration effect can be applied.
     * Checks if there are valid targets for applying evolution acceleration.
     * 
     * @param handlerData Handler data view
     * @param effect The evolution acceleration effect to validate
     * @param context Effect context
     * @returns True if the effect can be applied, false otherwise
     */
    canApply(handlerData: HandlerData, effect: EvolutionAccelerationEffect, context: EffectContext, cardRepository: CardRepository): boolean {
        // Use TargetResolver to check if the target is available
        if (!TargetResolver.isTargetAvailable(effect.target, handlerData, context, cardRepository)) {
            return false;
        }
        
        // For fixed targets like self active, we can check basic requirements
        if (effect.target.type === 'fixed' && effect.target.player === 'self' && effect.target.position === 'active') {
            const targetCreature = handlerData.field.creatures[context.sourcePlayer]?.[0];
            
            if (!targetCreature) {
                return false;
            }
            
            // Check if creature was played this turn (can't evolve on first turn)
            const currentTurn = handlerData.turnCounter.turnNumber;
            if (targetCreature.turnLastPlayed === currentTurn) {
                return false;
            }
            
            // Check restrictions - for now, only basic-creature-only is supported
            if (effect.restrictions && effect.restrictions.includes('basic-creature-only')) {
                const currentData = cardRepository.getCreature(getCurrentTemplateId(targetCreature));
                const isBasicCreature = !currentData.previousStageName;
                
                if (!isBasicCreature) {
                    return false;
                }
            }
            
            // Check if there's a valid Stage 2 evolution in hand
            const hand = handlerData.hand;
            const targetCreatureData = cardRepository.getCreature(getCurrentTemplateId(targetCreature));
            const hasValidEvolution = hand.some(card => {
                if (card.type !== 'creature') {
                    return false; 
                }
                const cardData = cardRepository.getCreature(card.templateId);
                if (!cardData.previousStageName) {
                    return false; 
                }
                try {
                    const stage1Data = cardRepository.getCreatureByName(cardData.previousStageName);
                    return stage1Data && stage1Data.previousStageName === targetCreatureData.name;
                } catch (error) {
                    return false;
                }
            });
            
            /*
             * For validation, we allow the item to be played even if there's no valid evolution
             * The evolution will just fail silently in the apply method
             */
            return true;
        }
        
        /*
         * For other target types, we can't easily determine the target in canApply
         * so we'll allow it and let the apply method handle validation
         */
        return true;
    }

    /**
     * Get resolution requirements for an evolution acceleration effect.
     * 
     * @param effect The evolution acceleration effect
     * @returns Array with a single requirement for the target property
     */
    getResolutionRequirements(effect: EvolutionAccelerationEffect): ResolutionRequirement[] {
        return [
            { targetProperty: 'target', target: effect.target, required: true },
        ];
    }
    
    /**
     * Apply an evolution acceleration effect.
     * This immediately forces evolution from Basic to Stage 2, skipping Stage 1.
     * 
     * @param controllers Game controllers
     * @param effect The evolution acceleration effect to apply
     * @param context Effect context
     */
    apply(controllers: Controllers, effect: EvolutionAccelerationEffect, context: EffectContext): void {
        
        if (effect.target.type !== 'resolved') {
            throw new Error(`Expected resolved target, got ${effect.target?.type || effect.target}`);
        }
        
        const targets = effect.target.targets;
        
        if (targets.length === 0) {
            controllers.players.messageAll({
                type: 'status',
                components: [ `${context.effectName} found no valid targets!` ],
            });
            return;
        }
        
        for (const target of targets) {
            const targetCreature = getCreatureFromTarget(controllers, target.playerId, target.fieldIndex);
            
            if (!targetCreature) {
                continue;
            }
            
            // Check restrictions - for now, only basic-creature-only is supported
            const currentData = controllers.cardRepository.getCreature(targetCreature.templateId);
            const isBasicCreature = !currentData.previousStageName;
            
            if (!isBasicCreature) {
                continue;
            }
            
            // Check if creature was played this turn (can't evolve on first turn)
            const currentTurn = controllers.turnCounter.getTurnNumber();
            if (targetCreature.turnPlayed === currentTurn) {
                continue;
            }
            
            // Find Stage 2 evolution in hand
            const hand = controllers.hand.getHand(context.sourcePlayer);
            const stage2Evolution = this.findStage2Evolution(controllers, hand, targetCreature.templateId);
            
            if (!stage2Evolution) {
                continue;
            }
            
            // Perform the evolution immediately
            if (target.fieldIndex === 0) {
                // Active creature
                controllers.field.evolveActiveCard(target.playerId, stage2Evolution.templateId);
            } else {
                // Bench creature
                controllers.field.evolveBenchedCard(target.playerId, target.fieldIndex - 1, stage2Evolution.templateId);
            }
            
            // Remove the evolution card from hand
            controllers.hand.removeCards(context.sourcePlayer, [ stage2Evolution ]);
            
            // Show a message about the evolution acceleration
            controllers.players.messageAll({
                type: 'status',
                components: [ `${context.effectName} evolved ${currentData.name} directly to ${controllers.cardRepository.getCreature(stage2Evolution.templateId).name}!` ],
            });
        }
    }
    
    /**
     * Find a Stage 2 evolution in the hand that can evolve from the given Basic creature.
     * 
     * @param controllers The controllers object
     * @param hand The player's hand
     * @param basicCardId The card ID of the Basic creature
     * @returns The Stage 2 evolution card, or undefined if none found
     */
    private findStage2Evolution(controllers: Controllers, hand: GameCard[], basicCardId: string): GameCard | undefined {
        const basicCardData = controllers.cardRepository.getCreature(basicCardId);
        return hand.find((card) => {
            if (card.type !== 'creature') {
                return false; 
            }
            
            const cardData = controllers.cardRepository.getCreature(card.templateId);
            if (!cardData.previousStageName) {
                return false; 
            }
            
            /*
             * Check if this Stage 2 can evolve from the Basic creature
             * evolvesFrom is now a name, not a templateId
             */
            try {
                const stage1Data = controllers.cardRepository.getCreatureByName(cardData.previousStageName);
                if (!stage1Data.previousStageName) {
                    return false; 
                }
                
                return stage1Data.previousStageName === basicCardData.name;
            } catch (error) {
                return false;
            }
        });
    }
}

export const evolutionAccelerationEffectHandler = new EvolutionAccelerationEffectHandler();
