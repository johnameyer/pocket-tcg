import { Controllers } from '../../controllers/controllers.js';
import { HandDiscardEffect } from '../../repository/effect-types.js';
import { EffectContext } from '../effect-context.js';
import { AbstractEffectHandler, ResolutionRequirement } from '../effect-handler.js';
import { getEffectValue } from '../effect-utils.js';
import { GameCard } from '../../controllers/card-types.js';

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
     * When the player has more cards than they must discard, a PendingCardSelection
     * is set so the player can choose which cards to discard.
     * 
     * @param controllers Game controllers
     * @param effect The hand discard effect to apply
     * @param context Effect context
     */
    apply(controllers: Controllers, effect: HandDiscardEffect, context: EffectContext): void {
        // Handle different target types
        if (effect.target === 'both') {
            // Apply to both players without choice (simultaneous discard)
            this.discardCards(controllers, effect, context, 0);
            this.discardCards(controllers, effect, context, 1);
        } else {
            // Determine which player's hand to discard from
            const playerId = effect.target === 'self' ? context.sourcePlayer : 1 - context.sourcePlayer;
            const hand = controllers.hand.getHand(playerId);
            const discardAmount = getEffectValue(effect.amount, controllers, context);
            const actualDiscardAmount = Math.min(discardAmount, hand.length);

            if (hand.length === 0) {
                controllers.players.messageAll({
                    type: 'status',
                    components: [ `${context.effectName} has no cards to discard!` ],
                });
                return;
            }

            if (actualDiscardAmount >= hand.length) {
                // No choice needed — discard the entire hand
                this.discardCards(controllers, effect, context, playerId);
            } else {
                // Player must choose which cards to discard
                controllers.turnState.setPendingSelection({
                    selectionType: 'card',
                    effect,
                    originalContext: context,
                    playerId,
                    location: 'hand',
                    count: actualDiscardAmount,
                    availableCards: [ ...hand ],
                    prompt: `Select ${actualDiscardAmount} card${actualDiscardAmount !== 1 ? 's' : ''} to discard:`,
                });
            }
        }
    }

    /**
     * Resume the discard after the player has selected which cards to discard.
     * 
     * @param controllers Game controllers
     * @param effect The hand discard effect
     * @param selectedCards The cards selected by the player to discard
     * @param context Effect context
     */
    resumeWithCardSelection(controllers: Controllers, effect: HandDiscardEffect, selectedCards: GameCard[], context: EffectContext): void {
        const playerId = effect.target === 'self' ? context.sourcePlayer : 1 - context.sourcePlayer;
        this.removeSelectedCards(controllers, effect, context, playerId, selectedCards);
    }

    /**
     * Discard cards from a player's hand without player input (auto-select first N cards).
     */
    private discardCards(controllers: Controllers, effect: HandDiscardEffect, context: EffectContext, playerId: number): void {
        const discardAmount = getEffectValue(effect.amount, controllers, context);
        const hand = controllers.hand.getHand(playerId);

        if (hand.length === 0) {
            controllers.players.messageAll({
                type: 'status',
                components: [ `${context.effectName} has no cards to discard for player ${playerId}!` ],
            });
            return;
        }

        const actualDiscardAmount = Math.min(discardAmount, hand.length);
        const cardsToDiscard = hand.slice(0, actualDiscardAmount);
        this.removeSelectedCards(controllers, effect, context, playerId, cardsToDiscard);
    }

    /**
     * Remove specific cards from a player's hand and send them to the discard pile or deck.
     */
    private removeSelectedCards(controllers: Controllers, effect: HandDiscardEffect, context: EffectContext, playerId: number, cardsToDiscard: GameCard[]): void {
        const count = cardsToDiscard.length;

        if (effect.shuffleIntoDeck) {
            // Remove from hand and shuffle into deck
            const hand = controllers.hand.getHand(playerId);
            const indicesToRemove: number[] = [];
            for (const card of cardsToDiscard) {
                const index = hand.findIndex((c: GameCard) => c.instanceId === card.instanceId);
                if (index !== -1) {
                    indicesToRemove.push(index);
                }
            }
            indicesToRemove.sort((a, b) => b - a);
            for (const index of indicesToRemove) {
                hand.splice(index, 1);
            }
            for (const card of cardsToDiscard) {
                controllers.deck.addCard(playerId, card);
            }
            controllers.deck.shuffle(playerId);
            controllers.players.messageAll({
                type: 'status',
                components: [ `${context.effectName} shuffles ${count} card${count !== 1 ? 's' : ''} from hand into the deck!` ],
            });
        } else {
            controllers.hand.removeCards(playerId, cardsToDiscard);
            controllers.players.messageAll({
                type: 'status',
                components: [ `${context.effectName} discards ${count} card${count !== 1 ? 's' : ''}!` ],
            });
        }
    }
}

export const handDiscardEffectHandler = new HandDiscardEffectHandler();
