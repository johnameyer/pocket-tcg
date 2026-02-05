import { Controllers } from '../../controllers/controllers.js';
import { PreventEnergyAttachmentEffect } from '../../repository/effect-types.js';
import { EffectContext } from '../effect-context.js';
import { AbstractEffectHandler, ResolutionRequirement } from '../interfaces/effect-handler-interface.js';

/**
 * Handler for prevent energy attachment effects that prevent energy attachment.
 */
export class PreventEnergyAttachmentEffectHandler extends AbstractEffectHandler<PreventEnergyAttachmentEffect> {
    /**
     * Get the resolution requirements for a prevent energy attachment effect.
     * Prevent energy attachment effects don't resolve targets—they apply to players.
     * 
     * @param effect The prevent energy attachment effect to get resolution requirements for
     * @returns Empty array (no resolution needed)
     */
    getResolutionRequirements(effect: PreventEnergyAttachmentEffect): ResolutionRequirement[] {
        return [];
    }
    
    /**
     * Apply a prevent energy attachment effect.
     * This registers a passive effect that prevents energy attachment.
     * 
     * @param controllers Game controllers
     * @param effect The prevent energy attachment effect to apply
     * @param context Effect context
     */
    apply(controllers: Controllers, effect: PreventEnergyAttachmentEffect, context: EffectContext): void {
        // Register as a passive effect
        controllers.effects.registerPassiveEffect(
            context.sourcePlayer,
            context.effectName,
            effect,
            effect.duration,
            controllers.turnCounter.getTurnNumber(),
        );
        
        // Show a message about the energy attachment prevention
        const targetStr = effect.target === 'self' ? 'You' : effect.target === 'opponent' ? 'Opponent' : 'Both players';
        controllers.players.messageAll({
            type: 'status',
            components: [ `${context.effectName}: ${targetStr} cannot attach energy!` ],
        });
    }
}

export const preventEnergyAttachmentEffectHandler = new PreventEnergyAttachmentEffectHandler();
