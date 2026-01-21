import { Controllers } from '../../controllers/controllers.js';
import { EnergyEffect } from '../../repository/effect-types.js';
import { FixedTarget, ResolvedTarget } from '../../repository/target-types.js';
import { EffectContext } from '../effect-context.js';
import { AbstractEffectHandler, ResolutionRequirement } from '../interfaces/effect-handler-interface.js';
import { getEffectValue, getCreatureFromTarget } from '../effect-utils.js';
import { CardRepository } from '../../repository/card-repository.js';
import { HandlerData } from '../../game-handler.js';
import { TargetResolver } from '../target-resolver.js';

/**
 * Handler for energy effects that attach or discard energy cards.
 */
export class EnergyEffectHandler extends AbstractEffectHandler<EnergyEffect> {
    /**
     * Validate if an energy effect can be applied.
     * Energy effects can always be applied, even if there are no energy cards in the deck.
     * 
     * @param handlerData Handler data view
     * @param effect The energy effect to validate
     * @param context Effect context
     * @returns True if the effect can be applied, false otherwise
     */
    canApply(handlerData: HandlerData, effect: EnergyEffect, context: EffectContext): boolean {
        // Always allow energy effects to be applied
        // The effect will attach as many energy cards as possible (or none if none are available)
        return true;
    }
    /**
     * Get the resolution requirements for an energy effect.
     * Energy effects require a target to be resolved.
     * 
     * @param effect The energy effect to get resolution requirements for
     * @returns Array of resolution requirements
     */
    getResolutionRequirements(effect: EnergyEffect): ResolutionRequirement[] {
        return [
            { targetProperty: 'target', target: effect.target, required: true }
        ];
    }
    
    /**
     * Apply a fully resolved energy effect.
     * This is called after all targets have been resolved.
     * 
     * @param controllers Game controllers
     * @param effect The energy effect to apply (with resolved targets)
     * @param context Effect context
     */
    apply(controllers: Controllers, effect: EnergyEffect, context: EffectContext): void {
        // Ensure we have a valid target
        if (!effect.target) {
            throw new Error('No target specified for energy effect');
        }

        // Get the amount of energy to attach/discard
        const amount = getEffectValue(effect.amount, controllers, context);

        // Get the energy type (if specified)
        const energyType = effect.energyType;

        // Get the operation (attach or discard)
        const operation = effect.operation;

        if (effect.target.type !== 'resolved') {
            throw new Error(`Expected resolved target, got ${effect.target?.type || effect.target}`);
        }
        
        // Get resolved targets directly
        const targets = effect.target.targets;
        
        if (targets.length === 0) {
            controllers.players.messageAll({
                type: 'status',
                components: [`${context.effectName} found no valid targets!`]
            });
            return;
        }
        
        for (const target of targets) {
            const { playerId, fieldIndex } = target;
            
            // Get the target creature
            const targetCreature = getCreatureFromTarget(controllers, playerId, fieldIndex);
            if (!targetCreature) {
                controllers.players.messageAll({
                    type: 'status',
                    components: [`${context.effectName} target creature not found!`]
                });
                continue;
            }
            
            // Get the creature data - will throw an error if not found
            const creatureName = controllers.cardRepository.getCreature(targetCreature.templateId).name;
            
            // Apply the appropriate energy operation
            if (operation === 'attach' && energyType) {
                // Attach energy directly to the creature
                const success = controllers.energy.attachSpecificEnergyToInstance(
                    targetCreature.instanceId, 
                    energyType, 
                    amount
                );
                
                if (success) {
                    controllers.players.messageAll({
                        type: 'status',
                        components: [`${context.effectName} attached ${amount} ${energyType} energy to ${creatureName}!`]
                    });
                } else {
                    controllers.players.messageAll({
                        type: 'status',
                        components: [`${context.effectName} failed to attach ${energyType} energy to ${creatureName}!`]
                    });
                }
            } else if (operation === 'discard') {
                const success = controllers.energy.discardSpecificEnergyFromInstance(
                    playerId,
                    targetCreature.instanceId, 
                    energyType, 
                    amount
                );
                
                if (success) {
                    controllers.players.messageAll({
                        type: 'status',
                        components: [`${context.effectName} discarded ${amount} ${energyType || 'random'} energy from ${creatureName}!`]
                    });
                } else {
                    controllers.players.messageAll({
                        type: 'status',
                        components: [`${context.effectName} failed to discard ${energyType || 'random'} energy from ${creatureName}!`]
                    });
                }
            } else {
                throw new Error(`Invalid operation ${operation} or missing energy type for attach operation`);
            }
        }
    }
}

export const energyEffectHandler = new EnergyEffectHandler();
