import { Controllers } from '../../controllers/controllers.js';
import { DamageReductionEffect } from '../../repository/effect-types.js';
import { EffectContext } from '../effect-context.js';
import { AbstractEffectHandler, ResolutionRequirement } from '../interfaces/effect-handler-interface.js';
import { getEffectValue } from '../effect-utils.js';

/**
 * Handler for damage reduction effects that reduce damage taken by creature.
 */
export class DamageReductionEffectHandler extends AbstractEffectHandler<DamageReductionEffect> {
    /**
     * Get the resolution requirements for a damage reduction effect.
     * Damage reduction effects don't resolve targets—they match criteria passively.
     * 
     * @param effect The damage reduction effect
     * @returns Empty array (no resolution needed)
     */
    getResolutionRequirements(effect: DamageReductionEffect): ResolutionRequirement[] {
        return [];
    }
    
    /**
     * Apply a damage reduction effect.
     * This registers a passive effect that reduces damage taken by creatures matching the target criteria.
     * 
     * @param controllers Game controllers
     * @param effect The damage reduction effect to apply
     * @param context Effect context
     */
    apply(controllers: Controllers, effect: DamageReductionEffect, context: EffectContext): void {
        // Get the amount of damage reduction
        const reductionAmount = getEffectValue(effect.amount, controllers, context);
        
        // Register as a passive effect with criteria matching
        controllers.effects.registerPassiveEffect(
            context.sourcePlayer,
            context.effectName,
            {
                type: 'damage-reduction',
                amount: effect.amount,
                damageSource: effect.damageSource,
                target: effect.target,
                duration: effect.duration,
            },
            effect.duration,
            controllers.turnCounter.getTurnNumber(),
        );
        
        // Send a message about the damage reduction
        controllers.players.messageAll({
            type: 'status',
            components: [ `${context.effectName} will reduce damage taken by ${reductionAmount}!` ],
        });
    }
}

export const damageReductionEffectHandler = new DamageReductionEffectHandler();
