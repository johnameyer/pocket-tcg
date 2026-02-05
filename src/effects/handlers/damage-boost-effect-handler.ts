import { Controllers } from '../../controllers/controllers.js';
import { DamageBoostEffect } from '../../repository/effect-types.js';
import { EffectContext } from '../effect-context.js';
import { AbstractEffectHandler, ResolutionRequirement } from '../interfaces/effect-handler-interface.js';
import { getEffectValue } from '../effect-utils.js';

/**
 * Handler for damage boost effects that increase the damage dealt by attacks.
 */
export class DamageBoostEffectHandler extends AbstractEffectHandler<DamageBoostEffect> {
    /**
     * Get the resolution requirements for a damage boost effect.
     * Damage boost effects don't resolve targets—they match criteria passively.
     * 
     * @param effect The damage boost effect
     * @returns Empty array (no resolution needed)
     */
    getResolutionRequirements(effect: DamageBoostEffect): ResolutionRequirement[] {
        return [];
    }
    
    /**
     * Apply a damage boost effect.
     * This registers a passive effect that increases damage dealt by attacks.
     * 
     * @param controllers Game controllers
     * @param effect The damage boost effect to apply
     * @param context Effect context
     */
    apply(controllers: Controllers, effect: DamageBoostEffect, context: EffectContext): void {
        const amount = getEffectValue(effect.amount, controllers, context);
        
        // Register as a passive effect with criteria matching
        controllers.effects.registerPassiveEffect(
            context.sourcePlayer,
            context.effectName,
            effect,
            effect.duration,
            controllers.turnCounter.getTurnNumber(),
        );
        
        // Send a message about the damage boost
        controllers.players.messageAll({
            type: 'status',
            components: [ `${context.effectName} will increase damage dealt by ${amount}!` ],
        });
    }
}

export const damageBoostEffectHandler = new DamageBoostEffectHandler();
