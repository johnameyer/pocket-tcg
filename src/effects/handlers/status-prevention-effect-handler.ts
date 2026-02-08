import { Controllers } from '../../controllers/controllers.js';
import { StatusPreventionEffect } from '../../repository/effect-types.js';
import { EffectContext } from '../effect-context.js';
import { AbstractEffectHandler } from '../interfaces/effect-handler-interface.js';

/**
 * Handler for status prevention effects that prevent status conditions from being applied.
 * This is a passive/modifier effect that is queried when status effects are being applied.
 */
export class StatusPreventionEffectHandler extends AbstractEffectHandler<StatusPreventionEffect> {
    /**
     * Status prevention effects are passive and require no resolution.
     * They are queried when status effects are being applied.
     * 
     * @param effect The status prevention effect
     * @returns Empty array (no resolution required)
     */
    getResolutionRequirements(effect: StatusPreventionEffect): [] {
        return [];
    }
    
    /**
     * Status prevention is a passive effect that doesn't need to be applied.
     * It is queried when status effects are being applied.
     * 
     * @param controllers Game controllers
     * @param effect The status prevention effect
     * @param context Effect context
     */
    apply(controllers: Controllers, effect: StatusPreventionEffect, context: EffectContext): void {
        /*
         * Passive effect - no immediate action needed
         * The effect will be queried when status effects are being applied
         */
    }
}

export const statusPreventionEffectHandler = new StatusPreventionEffectHandler();
