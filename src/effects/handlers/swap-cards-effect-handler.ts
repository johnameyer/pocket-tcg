import { Controllers } from '../../controllers/controllers.js';
import { SwapCardsEffect } from '../../repository/effect-types.js';
import { EffectContext } from '../effect-context.js';
import { AbstractEffectHandler } from '../interfaces/effect-handler-interface.js';
import { getEffectValue } from '../effect-utils.js';
import { CardRepository } from '../../repository/card-repository.js';
import { HandlerData } from '../../game-handler.js';

/**
 * Handler for swap cards effects that discard cards and draw new ones.
 */
export class SwapCardsEffectHandler extends AbstractEffectHandler<SwapCardsEffect> {
    /**
     * Swap cards effects don't require any target resolution.
     * 
     * @param effect The swap cards effect
     * @returns Empty array (no resolution required)
     */
    getResolutionRequirements(effect: SwapCardsEffect): [] {
        return [];
    }
    
    /**
     * Optional validation method to check if a swap cards effect can be applied.
     * 
     * @param handlerData Handler data view
     * @param effect The swap cards effect to validate
     * @param context Effect context
     * @returns True if the effect can be applied, false otherwise
     */
    canApply(handlerData: HandlerData, effect: SwapCardsEffect, context: EffectContext, cardRepository: CardRepository): boolean {
        // Check if player has enough cards to discard
        // We can't resolve the exact amount without controllers, so just check if hand has any cards
        return handlerData.hand.length > 0;
    }

    /**
     * Apply a fully resolved swap cards effect.
     * This is called after all targets have been resolved.
     * 
     * @param controllers Game controllers
     * @param effect The swap cards effect to apply (with resolved targets)
     * @param context Effect context
     */
    apply(controllers: Controllers, effect: SwapCardsEffect, context: EffectContext): void {
        // Determine which player based on target
        const playerId = effect.target === 'opponent' ? 1 - context.sourcePlayer : context.sourcePlayer;
        
        // Resolve amounts
        const discardAmount = getEffectValue(effect.discardAmount, controllers, context);
        const drawAmount = getEffectValue(effect.drawAmount, controllers, context);
        
        // Apply maxDrawn cap if specified
        const actualDrawAmount = effect.maxDrawn !== undefined ? Math.min(drawAmount, effect.maxDrawn) : drawAmount;
        
        // Discard cards from hand
        const hand = controllers.hand.getHand(playerId);
        const cardsToDiscard = hand.slice(0, Math.min(discardAmount, hand.length));
        controllers.hand.removeCards(playerId, cardsToDiscard);
        
        // Draw cards
        for (let i = 0; i < actualDrawAmount; i++) {
            controllers.hand.drawCard(playerId);
        }
        
        // Message players
        if (effect.maxDrawn !== undefined && drawAmount > effect.maxDrawn) {
            controllers.players.messageAll({
                type: 'status',
                components: [ `${context.effectName} causes ${playerId === context.sourcePlayer ? 'you' : 'opponent'} to discard ${cardsToDiscard.length} card(s) and draw up to ${effect.maxDrawn} card(s)!` ],
            });
        } else {
            controllers.players.messageAll({
                type: 'status',
                components: [ `${context.effectName} causes ${playerId === context.sourcePlayer ? 'you' : 'opponent'} to discard ${cardsToDiscard.length} card(s) and draw ${actualDrawAmount} card(s)!` ],
            });
        }
    }
}

export const swapCardsEffectHandler = new SwapCardsEffectHandler();
