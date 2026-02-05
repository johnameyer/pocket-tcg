import { CardTarget } from '../../repository/targets/card-target.js';
import { Controllers } from '../../controllers/controllers.js';
import { EffectContext } from '../effect-context.js';
import { GameCard } from '../../controllers/card-types.js';

/**
 * Result of card target resolution.
 */
export type CardTargetResolutionResult = 
    | { type: 'resolved', cards: GameCard[] }
    | { type: 'requires-selection', availableCards: GameCard[] }
    | { type: 'no-valid-targets' };

/**
 * Resolves card targets for effects that search or manipulate cards.
 * Handles targeting cards in hand, deck, discard pile, or field.
 * 
 * @example
 * // Resolve search effect targeting deck
 * CardTargetResolver.resolve(target, controllers, context);
 * // Returns available cards from the deck
 * 
 */
export class CardTargetResolver {
    /**
     * Resolves a card target to available cards.
     * 
     * @param target The card target specification
     * @param controllers Game controllers for accessing card state
     * @param context Effect context
     * @returns A CardTargetResolutionResult indicating available cards or selection requirement
     */
    static resolve(
        target: CardTarget | undefined,
        controllers: Controllers,
        context: EffectContext,
    ): CardTargetResolutionResult {
        if (!target) {
            return { type: 'no-valid-targets' };
        }

        // Determine player based on target type
        let playerId: number;
        if ('player' in target && target.player) {
            playerId = target.player === 'self' ? context.sourcePlayer : 1 - context.sourcePlayer;
        } else if ('chooser' in target && target.chooser) {
            playerId = target.chooser === 'self' ? context.sourcePlayer : 1 - context.sourcePlayer;
        } else {
            return { type: 'no-valid-targets' };
        }

        // Get cards from the specified location
        const cards = this.getCardsAtLocation(playerId, target.location, controllers);

        if (cards.length === 0) {
            return { type: 'no-valid-targets' };
        }

        // For fixed targets, return all matching cards as resolved
        if (target.type === 'fixed') {
            return { type: 'resolved', cards };
        }

        // For single-choice targets with one card, auto-resolve
        if (target.type === 'single-choice' && cards.length === 1) {
            return { type: 'resolved', cards };
        }

        // For multi-choice or multiple options, require selection
        return { type: 'requires-selection', availableCards: cards };
    }

    /**
     * Gets available cards from a specific location.
     * 
     * @param playerId The player to get cards from
     * @param location The location to search ('hand', 'deck', 'discard', or 'field')
     * @param controllers Game controllers
     * @returns Array of available cards at the location
     */
    static getCardsAtLocation(
        playerId: number,
        location: 'hand' | 'deck' | 'discard' | 'field',
        controllers: Controllers,
    ): GameCard[] {
        const cards: GameCard[] = [];

        switch (location) {
            case 'hand': {
                // @ts-expect-error state is protected but needed for card lookup - this is a framework limitation
                const handCards = controllers.hand.state?.[playerId] || [];
                for (const card of handCards) {
                    if (card) {
                        cards.push(card);
                    }
                }
                break;
            }

            case 'deck': {
                // @ts-expect-error state is protected but needed for card lookup - this is a framework limitation
                const deckCards = controllers.deck.state?.[playerId] || [];
                for (const card of deckCards) {
                    if (card) {
                        cards.push(card);
                    }
                }
                break;
            }

            case 'discard': {
                // @ts-expect-error state is protected but needed for card lookup - this is a framework limitation
                const discardCards = controllers.discard.state?.[playerId] || [];
                for (const card of discardCards) {
                    if (card) {
                        cards.push(card);
                    }
                }
                break;
            }

            case 'field': {
                const fieldCards = controllers.field.getCards(playerId) || [];
                for (let i = 0; i < fieldCards.length; i++) {
                    const card = fieldCards[i];
                    if (card) {
                        cards.push(card as unknown as GameCard);
                    }
                }
                break;
            }
        }

        return cards;
    }
}
