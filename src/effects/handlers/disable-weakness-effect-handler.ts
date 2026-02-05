import { Controllers } from '../../controllers/controllers.js';
import { DisableWeaknessEffect } from '../../repository/effect-types.js';
import { EffectContext } from '../effect-context.js';
import { AbstractEffectHandler, ResolutionRequirement } from '../interfaces/effect-handler-interface.js';

/**
 * Handler for disable weakness effects that prevent weakness bonus damage.
 */
export class DisableWeaknessEffectHandler extends AbstractEffectHandler<DisableWeaknessEffect> {
    /**
     * Get the resolution requirements for a disable weakness effect.
     * Disable weakness effects don't resolve targets—they match criteria passively.
     * 
     * @param effect The disable weakness effect to get resolution requirements for
     * @returns Empty array (no resolution needed)
     */
    getResolutionRequirements(effect: DisableWeaknessEffect): ResolutionRequirement[] {
        return [];
    }
    
    /**
     * Apply a disable weakness effect.
     * This registers a passive effect that disables weakness bonus damage.
     * 
     * @param controllers Game controllers
     * @param effect The disable weakness effect to apply
     * @param context Effect context
     */
    apply(controllers: Controllers, effect: DisableWeaknessEffect, context: EffectContext): void {
        // Register as a passive effect with criteria matching
        controllers.effects.registerPassiveEffect(
            context.sourcePlayer,
            context.effectName,
            effect,
            effect.duration,
            controllers.turnCounter.getTurnNumber(),
        );
        
        // Show a message about the weakness disable
        controllers.players.messageAll({
            type: 'status',
            components: [ `${context.effectName} disables weakness!` ],
        });
    }
}

export const disableWeaknessEffectHandler = new DisableWeaknessEffectHandler();
