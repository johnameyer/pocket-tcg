import { CardCriteria } from '../criteria/card-criteria.js';

/**
 * Not to be confused with `SearchCardTarget` (`search-card-target.ts`), which is the
 * bespoke target family SearchEffect resolves for itself. `CardTarget` is for effects
 * that plug a single-card selection into the generic `ResolutionRequirement` pipeline
 * (see `CardTargetResolver` / `effect-applier.ts`), where the resolved value ends up as
 * a `ResolvedCardTarget` on the effect itself.
 */
export type CardTargetCriteria = {
    location: 'hand' | 'deck' | 'discard';
} & CardCriteria;

/**
 * A card target that doesn't require player selection - either every card at the
 * location (no criteria) or, when `criteria` is given, whichever cards match it.
 */
export type FixedCardTarget = {
    type: 'fixed';
    location: 'hand' | 'deck' | 'discard';
    criteria?: CardTargetCriteria;
};

/**
 * A card target requiring a single choice among cards matching `criteria`.
 */
export type SingleChoiceCardTarget<TRef extends string = string> = {
    type: 'single-choice';
    chooser: 'self' | 'opponent';
    criteria: CardTargetCriteria;
};

// TODO: add MultiChoiceCardTarget if a future effect needs to select more than one card this way

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
    | ResolvedCardTarget;
