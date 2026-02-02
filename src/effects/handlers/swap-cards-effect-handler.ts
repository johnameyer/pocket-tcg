import { Controllers } from '../../controllers/controllers.js';
import { SwapCardsEffect } from '../../repository/effect-types.js';
import { EffectContext } from '../effect-context.js';
import { AbstractEffectHandler, ResolutionRequirement } from '../interfaces/effect-handler-interface.js';
import { getEffectValue } from '../effect-utils.js';

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
        // Determine the player based on discard target
        const discardTargetPlayer = this.getTargetPlayer(effect.discardTarget, context);
        const drawTargetPlayer = this.getTargetPlayer(effect.drawTarget, context);
        
        // Get the player's hand
        const hand = controllers.hand.getHand(discardTargetPlayer);
        
        if (hand.length === 0) {
            controllers.players.messageAll({
                type: 'status',
                components: [ `${context.effectName} cannot discard from empty hand!` ],
            });
            return;
        }
        
        // Calculate discard count
        const discardCount = this.getCardCount(effect.discardTarget, hand.length);
        const actualDiscardCount = Math.min(discardCount, hand.length);
        
        // Discard cards
        // TODO: For now just discard from the front, but should allow player choice
        const discardedCards = hand.slice(0, actualDiscardCount);
        controllers.hand.removeCards(discardTargetPlayer, discardedCards);
        
        // Calculate draw count
        let drawCount = this.getCardCount(effect.drawTarget, actualDiscardCount);
        
        // If balanced, draw same number as discarded
        if (effect.balanced) {
            drawCount = actualDiscardCount;
        }
        
        // Draw cards
        const deckSize = controllers.deck.getDeck(drawTargetPlayer).length;
        const actualDrawCount = Math.min(drawCount, deckSize);
        
        for (let i = 0; i < actualDrawCount; i++) {
            const card = controllers.deck.drawCard(drawTargetPlayer);
            if (card) {
                controllers.hand.getHand(drawTargetPlayer).push(card);
            }
        }
        
        // Send messages
        controllers.players.messageAll({
            type: 'status',
            components: [ 
                `${context.effectName} discards ${actualDiscardCount} card${actualDiscardCount !== 1 ? 's' : ''}` +
                ` and draws ${actualDrawCount} card${actualDrawCount !== 1 ? 's' : ''}!`,
            ],
        });
    }
    
    /**
     * Get the target player from a CardTarget.
     */
    private getTargetPlayer(cardTarget: SwapCardsEffect['discardTarget'], context: EffectContext): number {
        if (cardTarget.type === 'fixed') {
            return cardTarget.player === 'self' ? context.sourcePlayer : 1 - context.sourcePlayer;
        }
        
        // For choice targets, default to self
        if (cardTarget.type === 'single-choice' || cardTarget.type === 'multi-choice') {
            return cardTarget.chooser === 'self' ? context.sourcePlayer : 1 - context.sourcePlayer;
        }
        
        return context.sourcePlayer;
    }
    
    /**
     * Get the card count from a CardTarget.
     */
    private getCardCount(cardTarget: SwapCardsEffect['discardTarget'], defaultValue: number): number {
        if (cardTarget.type === 'multi-choice') {
            return cardTarget.count;
        }
        
        if (cardTarget.type === 'single-choice') {
            return 1;
        }
        
        return defaultValue;
    }
}

export const swapCardsEffectHandler = new SwapCardsEffectHandler();
