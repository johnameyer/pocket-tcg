import { Controllers } from '../../controllers/controllers.js';
import { SwapCardsEffect } from '../../repository/effect-types.js';
import { EffectContext } from '../effect-context.js';
import { AbstractEffectHandler } from '../interfaces/effect-handler-interface.js';
import { getEffectValue } from '../effect-utils.js';
import { CardRepository } from '../../repository/card-repository.js';
import { HandlerData } from '../../game-handler.js';
import { DrawnCardsMessage } from '../../messages/status/drawn-cards-message.js';
import { getCardNames } from '../../utils/card-name-utils.js';

/**
 * Handler for swap cards effects that discard cards and draw new ones.
 * Only affects the current player (self).
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
     * Validate if swap cards effect can be applied.
     * Effect should only be playable if it would change game state:
     * - Player must have cards in hand to discard OR cards in deck to draw
     * 
     * @param handlerData Handler data view
     * @param effect The swap cards effect to validate
     * @param context Effect context
     * @returns undefined if valid, rejection reason if invalid
     */
    canApply(handlerData: HandlerData, effect: SwapCardsEffect, context: EffectContext, cardRepository: CardRepository): string | undefined {
        // Check if player has cards in hand to discard OR cards in deck to draw
        const hasCardsToDiscard = handlerData.hand.length > 0;
        const hasCardsToDraw = handlerData.deck > 0;
        
        // Effect can be applied if either discarding or drawing would happen
        return (hasCardsToDiscard || hasCardsToDraw) ? undefined : 'No cards to swap';
    }

    /**
     * Apply a fully resolved swap cards effect.
     * This is called after all targets have been resolved.
     * Always affects the current player (self).
     * 
     * @param controllers Game controllers
     * @param effect The swap cards effect to apply (with resolved targets)
     * @param context Effect context
     */
    apply(controllers: Controllers, effect: SwapCardsEffect, context: EffectContext): void {
        // Always applies to the source player (self only)
        const playerId = context.sourcePlayer;
        
        // Resolve amounts
        const discardAmount = getEffectValue(effect.discardAmount, controllers, context);
        const drawAmount = getEffectValue(effect.drawAmount, controllers, context);
        
        // Apply maxDrawn cap if specified
        const actualDrawAmount = effect.maxDrawn !== undefined ? Math.min(drawAmount, effect.maxDrawn) : drawAmount;
        
        // Discard cards from hand
        const hand = controllers.hand.getHand(playerId);
        const cardsToDiscard = hand.slice(0, Math.min(discardAmount, hand.length));
        controllers.hand.removeCards(playerId, cardsToDiscard);
        
        // Draw cards and collect their names
        const drawnCards = [];
        for (let i = 0; i < actualDrawAmount; i++) {
            const card = controllers.hand.drawCard(playerId);
            if (card) {
                drawnCards.push(card);
            }
        }
        
        // Message players about the effect (generic reason)
        if (effect.maxDrawn !== undefined && drawAmount > effect.maxDrawn) {
            controllers.players.messageAll({
                type: 'status',
                components: [ `${context.effectName} causes you to discard ${cardsToDiscard.length} card(s) and draw up to ${effect.maxDrawn} card(s)!` ],
            });
        } else {
            controllers.players.messageAll({
                type: 'status',
                components: [ `${context.effectName} causes you to discard ${cardsToDiscard.length} card(s) and draw ${actualDrawAmount} card(s)!` ],
            });
        }
        
        // Message the player about the specific cards drawn
        if (drawnCards.length > 0) {
            const cardNames = getCardNames(drawnCards, controllers.cardRepository);
            controllers.players.message(playerId, new DrawnCardsMessage(cardNames));
        }
    }
}

export const swapCardsEffectHandler = new SwapCardsEffectHandler();
