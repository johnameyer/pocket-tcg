import { Controllers } from '../../controllers/controllers.js';
import { HandDiscardEffect } from '../../repository/effect-types.js';
import { EffectContext } from '../effect-context.js';
import { AbstractEffectHandler, ResolutionRequirement } from '../effect-handler.js';
import { getEffectValue } from '../effect-utils.js';

/**
 * Handler for hand discard effects that discard cards from a player's hand.
 */
export class HandDiscardEffectHandler extends AbstractEffectHandler<HandDiscardEffect> {
    /**
     * Hand discard effects don't have targets to resolve.
     * 
     * @param effect The hand discard effect
     * @returns Empty array as hand discard effects don't have targets
     */
    getResolutionRequirements(effect: HandDiscardEffect): ResolutionRequirement[] {
        return [];
    }
    
    /**
     * Apply a hand discard effect.
     * This discards cards from a player's hand.
     * 
     * @param controllers Game controllers
     * @param effect The hand discard effect to apply
     * @param context Effect context
     */
    apply(controllers: Controllers, effect: HandDiscardEffect, context: EffectContext): void {
        // Handle different target types
        if (effect.target === 'both') {
            // Apply to both players
            this.applyToPlayer(controllers, effect, context, 0);
            this.applyToPlayer(controllers, effect, context, 1);
        } else {
            // Determine which player's hand to discard from
            const playerId = effect.target === 'self' ? context.sourcePlayer : 1 - context.sourcePlayer;
            this.applyToPlayer(controllers, effect, context, playerId);
        }
    }
    
    /**
     * Apply hand discard effect to a specific player.
     */
    private applyToPlayer(controllers: Controllers, effect: HandDiscardEffect, context: EffectContext, playerId: number): void {
        // Get the amount of cards to discard
        const discardAmount = getEffectValue(effect.amount, controllers, context);
        
        // Get the player's hand
        const hand = controllers.hand.getHand(playerId);
        
        // If the hand is empty, there's nothing to discard
        if (hand.length === 0) {
            controllers.players.messageAll({
                type: 'status',
                components: [`${context.effectName} has no cards to discard for player ${playerId}!`]
            });
            return;
        }
        
        // If the discard amount is greater than the hand size, discard the entire hand
        const actualDiscardAmount = Math.min(discardAmount, hand.length);
        
        // For now, just discard random cards
        // In a real implementation, this would involve player choice
        const cardsToDiscard = hand.slice(0, actualDiscardAmount);
        
        // Remove the cards from the hand
        controllers.hand.removeCards(playerId, cardsToDiscard);
        
        // Send a message about the discard
        controllers.players.messageAll({
            type: 'status',
            components: [`${context.effectName} discards ${actualDiscardAmount} card${actualDiscardAmount !== 1 ? 's' : ''} from player ${playerId}!`]
        });
        
        // If shuffleIntoDeck is true, shuffle the discarded cards into the deck
        if (effect.shuffleIntoDeck) {
            for (const card of cardsToDiscard) {
                controllers.deck.addCard(playerId, card);
            }
            
            // Shuffle the deck
            controllers.deck.shuffle(playerId);
            
            // Send a message about the shuffle
            controllers.players.messageAll({
                type: 'status',
                components: [`${context.effectName} shuffles the discarded cards into the deck for player ${playerId}!`]
            });
        }
    }
}

export const handDiscardEffectHandler = new HandDiscardEffectHandler();
