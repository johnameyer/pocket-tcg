import { Controllers } from '../../controllers/controllers.js';
import { SwapCardsEffect } from '../../repository/effect-types.js';
import { EffectContext } from '../effect-context.js';
import { AbstractEffectHandler, ResolutionRequirement } from '../interfaces/effect-handler-interface.js';

/**
 * Handler for swap cards effects that discard cards and draw replacements.
 */
export class SwapCardsEffectHandler extends AbstractEffectHandler<SwapCardsEffect> {
    /**
     * Swap cards effects don't have target resolution requirements.
     * 
     * @param effect The swap cards effect
     * @returns Empty array
     */
    getResolutionRequirements(effect: SwapCardsEffect): ResolutionRequirement[] {
        return [];
    }
    
    /**
     * Apply a swap cards effect.
     * This discards cards from hand and draws new ones.
     * 
     * @param controllers Game controllers
     * @param effect The swap cards effect to apply
     * @param context Effect context
     */
    apply(controllers: Controllers, effect: SwapCardsEffect, context: EffectContext): void {
        // TODO: Implement swap cards logic
        controllers.players.messageAll({
            type: 'status',
            components: [ `${context.effectName} is not yet implemented!` ],
        });
    }
}

export const swapCardsEffectHandler = new SwapCardsEffectHandler();
