import { CardCriteria } from '../criteria/card-criteria.js';

/**
 * Represents location where cards can be found.
 */
export type CardLocation = 'hand' | 'deck' | 'discard' | 'field';

/**
 * Represents a fixed card target (specific location).
 */
export type FixedCardTarget = {
    type: 'fixed';
    player: 'self' | 'opponent';
    location: CardLocation;
};

/**
 * Represents a card target requiring single choice.
 */
export type SingleChoiceCardTarget = {
    type: 'single-choice';
    chooser: 'self' | 'opponent';
    location: CardLocation;
    criteria?: CardCriteria;
};

/**
 * Represents a card target requiring multiple choices.
 */
export type MultiChoiceCardTarget = {
    type: 'multi-choice';
    chooser: 'self' | 'opponent';
    location: CardLocation;
    criteria?: CardCriteria;
    count: number;
};

/**
 * Union type for card targets (cards in hand, deck, discard, or field).
 */
export type CardTarget = FixedCardTarget | SingleChoiceCardTarget | MultiChoiceCardTarget;
