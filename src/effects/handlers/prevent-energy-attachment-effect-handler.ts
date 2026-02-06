import { Controllers } from '../../controllers/controllers.js';
import { PreventEnergyAttachmentEffect } from '../../repository/effect-types.js';
import { EffectContext } from '../effect-context.js';
import { AbstractEffectHandler, ResolutionRequirement } from '../interfaces/effect-handler-interface.js';

/**
 * Handler for prevent energy attachment effects that prevent energy attachment to creatures.
 */
export class PreventEnergyAttachmentEffectHandler extends AbstractEffectHandler<PreventEnergyAttachmentEffect> {
    /**
     * Get the resolution requirements for a prevent energy attachment effect.
     * Prevent energy attachment effects don't resolve targets—they match criteria passively.
     * 
     * @param effect The prevent energy attachment effect to get resolution requirements for
     * @returns Empty array (no resolution needed)
     */
    getResolutionRequirements(effect: PreventEnergyAttachmentEffect): ResolutionRequirement[] {
        return [];
    }
    
    /**
     * Apply a prevent energy attachment effect.
     * This registers a passive effect that prevents energy attachment to matching creatures.
     * 
     * @param controllers Game controllers
     * @param effect The prevent energy attachment effect to apply
     * @param context Effect context
     */
    apply(controllers: Controllers, effect: PreventEnergyAttachmentEffect, context: EffectContext): void {
        // Register as a passive effect with criteria matching
        controllers.effects.registerPassiveEffect(
            context.sourcePlayer,
            context.effectName,
            effect,
            effect.duration,
            controllers.turnCounter.getTurnNumber(),
        );
        
        // Show a message about the energy attachment prevention
        controllers.players.messageAll({
            type: 'status',
            components: [ `${context.effectName} prevents energy attachment!` ],
        });
    }
}

export const preventEnergyAttachmentEffectHandler = new PreventEnergyAttachmentEffectHandler();
