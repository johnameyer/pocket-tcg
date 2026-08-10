import { CardCriteria } from '../criteria/card-criteria.js';

/**
 * Represents location where cards can be found.
 *
 * This is the target family used by SearchEffect (`SearchCardTargetResolver`) -
 * distinct from `CardTarget` (`src/repository/targets/card-target.ts`), which
 * models single-card selection with an explicit `resolved` state for the
 * declarative ResolutionRequirement pipeline.
 */
export type CardLocation = 'hand' | 'deck' | 'discard' | 'field';

/**
 * Represents a fixed search card target (specific location).
 */
export type FixedSearchCardTarget = {
    type: 'fixed';
    player: 'self' | 'opponent';
    location: CardLocation;
};

/**
 * Represents a search card target requiring single choice.
 */
export type SingleChoiceSearchCardTarget = {
    type: 'single-choice';
    chooser: 'self' | 'opponent';
    location: CardLocation;
    criteria?: CardCriteria;
};

/**
 * Represents a search card target requiring multiple choices.
 */
export type MultiChoiceSearchCardTarget = {
    type: 'multi-choice';
    chooser: 'self' | 'opponent';
    location: CardLocation;
    criteria?: CardCriteria;
    count: number;
};

/**
 * Union type for search card targets (cards in hand, deck, discard, or field).
 */
export type SearchCardTarget = FixedSearchCardTarget | SingleChoiceSearchCardTarget | MultiChoiceSearchCardTarget;
