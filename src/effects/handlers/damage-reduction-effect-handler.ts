import { Controllers } from '../../controllers/controllers.js';
import { DamageReductionEffect } from '../../repository/effect-types.js';
import { EffectContext } from '../effect-context.js';
import { AbstractEffectHandler, ResolutionRequirement } from '../interfaces/effect-handler-interface.js';
import { getEffectValue, getCreatureFromTarget } from '../effect-utils.js';
import { CardRepository } from '../../repository/card-repository.js';
import { HandlerData } from '../../game-handler.js';
import { TargetResolver } from '../target-resolver.js';

/**
 * Handler for damage reduction effects that reduce damage taken by creature.
 */
export class DamageReductionEffectHandler extends AbstractEffectHandler<DamageReductionEffect> {
    /**
     * Validate if a damage reduction effect can be applied.
     * Checks if there are valid targets for applying damage reduction.
     * 
     * @param handlerData Handler data view
     * @param effect The damage reduction effect to validate
     * @param context Effect context
     * @returns True if the effect can be applied, false otherwise
     */
    canApply(handlerData: HandlerData, effect: DamageReductionEffect, context: EffectContext, cardRepository: CardRepository): boolean {
        // Use TargetResolver to check if the target is available
        return TargetResolver.isTargetAvailable(effect.target, handlerData, context, cardRepository);
    }

    /**
     * Get the resolution requirements for a damage reduction effect.
     * Damage reduction effects require a target to apply the reduction to.
     * 
     * @param effect The damage reduction effect
     * @returns Array with target resolution requirement
     */
    getResolutionRequirements(effect: DamageReductionEffect): ResolutionRequirement[] {
        return [
            { targetProperty: 'target', target: effect.target, required: true },
        ];
    }
    
    /**
     * Apply a damage reduction effect.
     * This registers a passive effect that reduces damage taken by the target creature.
     * 
     * @param controllers Game controllers
     * @param effect The damage reduction effect to apply
     * @param context Effect context
     */
    apply(controllers: Controllers, effect: DamageReductionEffect, context: EffectContext): void {
        // Ensure we have a valid target
        if (!effect.target) {
            throw new Error('No target specified for damage reduction effect');
        }
        
        // Get the amount of damage reduction
        const reductionAmount = getEffectValue(effect.amount, controllers, context);
        
        if (effect.target.type !== 'resolved') {
            throw new Error(`Expected resolved target, got ${effect.target?.type || effect.target}`);
        }
        
        // Get resolved targets directly
        const targets = effect.target.targets;
        
        if (targets.length === 0) {
            controllers.players.messageAll({
                type: 'status',
                components: [ `${context.effectName} found no valid targets!` ],
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
                    components: [ `${context.effectName} target creature not found!` ],
                });
                continue;
            }
            
            // Get creature data for messaging
            const creatureName = controllers.cardRepository.getCreature(targetCreature.templateId).name;
            
            // Register as a passive effect
            controllers.effects.registerPassiveEffect(
                context.sourcePlayer,
                context.effectName,
                {
                    type: 'damage-reduction',
                    amount: effect.amount,
                    target: effect.target,
                    duration: effect.duration,
                },
                effect.duration,
                controllers.turnCounter.getTurnNumber(),
            );
            
            // Send a message about the damage reduction
            controllers.players.messageAll({
                type: 'status',
                components: [ `${creatureName} will take ${reductionAmount} less damage from attacks!` ],
            });
        }
    }
}

export const damageReductionEffectHandler = new DamageReductionEffectHandler();
