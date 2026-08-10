import { CardCriteria } from '../criteria/card-criteria.js';

/**
 * `CardTarget` is the single target family used for all card selection - both the
 * generic `ResolutionRequirement` pipeline (see `CardTargetResolver` / `effect-applier.ts`,
 * used e.g. by evolution-skip) and SearchEffect's own bespoke ad-hoc resolution (which
 * resolves candidates directly via `CardTargetResolver.getAvailableCards()` in its
 * `apply()` rather than going through a `ResolutionRequirement`).
 */
export type CardLocation = 'hand' | 'deck' | 'discard' | 'field';

/**
 * A card target that doesn't require player selection - either every card at the
 * location (no criteria) or, when `criteria` is given, whichever cards match it.
 */
export type FixedCardTarget = {
    type: 'fixed';
    player: 'self' | 'opponent';
    location: CardLocation;
    criteria?: CardCriteria;
};

/**
 * A card target requiring a single choice among cards matching `criteria`.
 */
export type SingleChoiceCardTarget<TRef extends string = string> = {
    type: 'single-choice';
    chooser: 'self' | 'opponent';
    location: CardLocation;
    criteria?: CardCriteria;
};

/**
 * A card target requiring a choice of multiple (up to `count`) cards matching `criteria`.
 */
export type MultiChoiceCardTarget<TRef extends string = string> = {
    type: 'multi-choice';
    chooser: 'self' | 'opponent';
    location: CardLocation;
    criteria?: CardCriteria;
    count: number;
};

/**
 * Represents a card target that has been resolved to specific card instances.
 */
export type ResolvedCardTarget = {
    type: 'resolved';
    cards: Array<{ instanceId: string }>;
};

/**
 * Union type representing all possible card target specifications.
 *
 * `TRef` is kept for API consistency with `FieldTarget<TContextualRefs>` but is
 * currently unused within `CardTarget` itself - none of these target shapes carry a
 * contextual reference the way `ContextualFieldTarget` does.
 */
export type CardTarget<TRef extends string = string> =
    | FixedCardTarget
    | SingleChoiceCardTarget<TRef>
    | MultiChoiceCardTarget<TRef>
    | ResolvedCardTarget;
