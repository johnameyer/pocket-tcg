import { Controllers } from '../../controllers/controllers.js';
import { PreventDamageEffect } from '../../repository/effect-types.js';
import { EffectContext } from '../effect-context.js';
import { AbstractEffectHandler, ResolutionRequirement } from '../effect-handler.js';

/**
 * Handler for prevent damage effects that prevent damage from specific sources.
 */
export class PreventDamageEffectHandler extends AbstractEffectHandler<PreventDamageEffect> {
    /**
     * Get the resolution requirements for a prevent damage effect.
     * Prevent damage effects don't resolve targets—they match criteria passively.
     * 
     * @param effect The prevent damage effect to get resolution requirements for
     * @returns Empty array (no resolution needed)
     */
    getResolutionRequirements(effect: PreventDamageEffect): ResolutionRequirement[] {
        return [];
    }
    
    /**
     * Apply a prevent damage effect.
     * This registers a passive effect that prevents damage from specific sources.
     * 
     * @param controllers Game controllers
     * @param effect The prevent damage effect to apply
     * @param context Effect context
     */
    apply(controllers: Controllers, effect: PreventDamageEffect, context: EffectContext): void {
        // Register as a passive effect with criteria matching
        controllers.effects.registerPassiveEffect(
            context.sourcePlayer,
            context.effectName,
            effect,
            effect.duration,
            controllers.turnCounter.getTurnNumber(),
        );
        
        // Show a message about the damage prevention
        controllers.players.messageAll({
            type: 'status',
            components: [ `${context.effectName} prevents damage!` ],
        });
    }
}

export const preventDamageEffectHandler = new PreventDamageEffectHandler();
