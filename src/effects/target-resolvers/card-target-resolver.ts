import { CardTarget, ResolvedCardTarget } from '../../repository/targets/card-target.js';
import { Controllers } from '../../controllers/controllers.js';
import { EffectContext } from '../effect-context.js';
import { GameCard } from '../../controllers/card-types.js';
import { HandlerData } from '../../game-handler.js';
import { CardRepository } from '../../repository/card-repository.js';
import { CardCriteriaFilter } from '../filters/card-criteria-filter.js';

/**
 * Result of resolving a `CardTarget` through the generic ResolutionRequirement pipeline.
 */
export type CardTargetResolutionResult =
    | ResolvedCardTarget
    | { type: 'requires-selection', availableCards: GameCard[] }
    | { type: 'no-valid-targets' };

/**
 * A per-candidate predicate applied after location/criteria filtering, given the
 * ResolutionRequirements already resolved earlier in the same handler's requirement list.
 * See the `dependsOn`/`filter` TODO on `ResolutionRequirement` for the scope of this mechanism.
 */
export type CardCandidateFilter = (candidate: GameCard, resolved: Record<string, unknown>, controllers: Controllers) => boolean;

/**
 * Resolves the `CardTarget` family (`fixed` / `single-choice` / `resolved`) used by effects
 * that plug a single-card selection into the generic ResolutionRequirement pipeline.
 *
 * Not to be confused with `SearchCardTargetResolver`, which resolves the bespoke
 * `SearchCardTarget` family that `SearchEffect` resolves for itself.
 */
export class CardTargetResolver {
    /**
     * Resolves a card target, optionally narrowing candidates with a `filter` that can see
     * previously-resolved requirement values via `resolved`.
     */
    static resolveTarget(
        target: CardTarget | undefined,
        controllers: Controllers,
        context: EffectContext,
        filter?: CardCandidateFilter,
        resolved: Record<string, unknown> = {},
    ): CardTargetResolutionResult {
        if (!target) {
            return { type: 'no-valid-targets' };
        }

        if (target.type === 'resolved') {
            return target;
        }

        const playerId = target.type === 'single-choice'
            ? (target.chooser === 'self' ? context.sourcePlayer : 1 - context.sourcePlayer)
            : context.sourcePlayer;

        const criteria = target.criteria;
        const location = target.type === 'fixed' ? target.location : target.criteria.location;

        let cards = this.getCardsAtLocation(playerId, location, controllers);

        if (criteria) {
            cards = CardCriteriaFilter.filter(cards, criteria, controllers.cardRepository.cardRepository);
        }

        if (filter) {
            cards = cards.filter(card => filter(card, resolved, controllers));
        }

        if (cards.length === 0) {
            return { type: 'no-valid-targets' };
        }

        if (target.type === 'fixed') {
            return { type: 'resolved', cards: cards.map(card => ({ instanceId: card.instanceId })) };
        }

        // single-choice
        if (cards.length === 1) {
            return { type: 'resolved', cards: [{ instanceId: cards[0].instanceId }] };
        }

        return { type: 'requires-selection', availableCards: cards };
    }

    /**
     * Checks whether a card target has any matching cards (ignoring `filter`/`dependsOn` -
     * those are only evaluated once the earlier requirement they depend on is resolved).
     * Used for the coarse availability pre-check in `EffectApplier.canApplyEffect`; handlers
     * should implement their own `canApply` for anything that needs the filtered result.
     */
    static isTargetAvailable(
        target: CardTarget | undefined,
        handlerData: HandlerData,
        context: EffectContext,
        cardRepository: CardRepository,
    ): boolean {
        if (!target) {
            return false;
        }

        if (target.type === 'resolved') {
            return target.cards.length > 0;
        }

        const playerId = target.type === 'single-choice'
            ? (target.chooser === 'self' ? context.sourcePlayer : 1 - context.sourcePlayer)
            : context.sourcePlayer;
        const criteria = target.criteria;
        const location = target.type === 'fixed' ? target.location : target.criteria.location;

        const cards = this.getCardsAtLocationFromHandlerData(playerId, location, context.sourcePlayer, handlerData);
        if (cards === undefined) {
            // No visibility into this player's cards at this location (e.g. opponent's hand/deck) -
            // fall back to a size check only, ignoring criteria.
            return this.getLocationSize(playerId, location, handlerData) > 0;
        }

        const filtered = criteria ? CardCriteriaFilter.filter(cards, criteria, cardRepository) : cards;
        return filtered.length > 0;
    }

    /**
     * Gets available cards from a specific location (hand, deck, or discard).
     */
    static getCardsAtLocation(
        playerId: number,
        location: 'hand' | 'deck' | 'discard',
        controllers: Controllers,
    ): GameCard[] {
        switch (location) {
            case 'hand':
                return [ ...controllers.hand.getHand(playerId) ];
            case 'deck':
                return [ ...controllers.deck.getDeck(playerId) ];
            case 'discard':
                return [ ...controllers.discard.getDiscardPile(playerId) ];
        }
    }

    /**
     * Best-effort card visibility from a HandlerData view: only the acting player's own hand
     * is visible to their own HandlerData; deck contents are always hidden (public sizes only);
     * discard piles are public knowledge.
     */
    private static getCardsAtLocationFromHandlerData(
        playerId: number,
        location: 'hand' | 'deck' | 'discard',
        sourcePlayer: number,
        handlerData: HandlerData,
    ): GameCard[] | undefined {
        if (location === 'hand' && playerId === sourcePlayer) {
            return handlerData.hand.hand;
        }
        return undefined;
    }

    private static getLocationSize(
        playerId: number,
        location: 'hand' | 'deck' | 'discard',
        handlerData: HandlerData,
    ): number {
        if (location === 'hand') {
            return handlerData.hand.sizes[playerId] ?? 0;
        }
        if (location === 'deck') {
            return handlerData.deck.sizes[playerId] ?? 0;
        }
        return 0;
    }
}
