import { Controllers } from '../../controllers/controllers.js';
import { PreventAttackEffect } from '../../repository/effect-types.js';
import { EffectContext } from '../effect-context.js';
import { AbstractEffectHandler, ResolutionRequirement } from '../interfaces/effect-handler-interface.js';

/**
 * Handler for prevent attack effects that prevent creature from attacking.
 */
export class PreventAttackEffectHandler extends AbstractEffectHandler<PreventAttackEffect> {
    /**
     * Get the resolution requirements for a prevent attack effect.
     * Prevent attack effects don't resolve targets—they match criteria passively.
     * 
     * @param effect The prevent attack effect to get resolution requirements for
     * @returns Empty array (no resolution needed)
     */
    getResolutionRequirements(effect: PreventAttackEffect): ResolutionRequirement[] {
        return [];
    }
    
    /**
     * Apply a prevent attack effect.
     * This registers a passive effect that prevents creatures matching the criteria from attacking.
     * 
     * @param controllers Game controllers
     * @param effect The prevent attack effect to apply
     * @param context Effect context
     */
    apply(controllers: Controllers, effect: PreventAttackEffect, context: EffectContext): void {
        // Register as a passive effect with criteria matching
        controllers.effects.registerPassiveEffect(
            context.sourcePlayer,
            context.effectName,
            effect,
            effect.duration,
            controllers.turnCounter.getTurnNumber(),
        );
        
        // Show a message about the attack prevention
        controllers.players.messageAll({
            type: 'status',
            components: [ `${context.effectName} prevents attacks!` ],
        });
    }
}

export const preventAttackEffectHandler = new PreventAttackEffectHandler();
