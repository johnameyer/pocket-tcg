import { Controllers } from '../../controllers/controllers.js';
import { PreventPlayingEffect } from '../../repository/effect-types.js';
import { EffectContext } from '../effect-context.js';
import { AbstractEffectHandler, ResolutionRequirement } from '../interfaces/effect-handler-interface.js';

/**
 * Handler for prevent playing effects that prevent playing specific card types.
 */
export class PreventPlayingEffectHandler extends AbstractEffectHandler<PreventPlayingEffect> {
    /**
     * Get the resolution requirements for a prevent playing effect.
     * Prevent playing effects don't resolve targets—they apply to players.
     * 
     * @param effect The prevent playing effect to get resolution requirements for
     * @returns Empty array (no resolution needed)
     */
    getResolutionRequirements(effect: PreventPlayingEffect): ResolutionRequirement[] {
        return [];
    }
    
    /**
     * Apply a prevent playing effect.
     * This registers a passive effect that prevents playing specific card types.
     * 
     * @param controllers Game controllers
     * @param effect The prevent playing effect to apply
     * @param context Effect context
     */
    apply(controllers: Controllers, effect: PreventPlayingEffect, context: EffectContext): void {
        // Register as a passive effect
        controllers.effects.registerPassiveEffect(
            context.sourcePlayer,
            context.effectName,
            effect,
            effect.duration,
            controllers.turnCounter.getTurnNumber(),
        );
        
        // Show a message about the card playing prevention
        const cardTypesStr = effect.cardTypes.join(', ');
        const targetStr = effect.target === 'self' ? 'You' : effect.target === 'opponent' ? 'Opponent' : 'Both players';
        controllers.players.messageAll({
            type: 'status',
            components: [ `${context.effectName}: ${targetStr} cannot play ${cardTypesStr} cards!` ],
        });
    }
}

export const preventPlayingEffectHandler = new PreventPlayingEffectHandler();
