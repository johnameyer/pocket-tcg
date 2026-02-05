import { FieldTargetCriteria } from '../criteria/field-target-criteria.js';

export { FieldTargetCriteria };

/**
 * Represents a fixed target that doesn't require selection.
 */
export type FixedFieldTarget = {
    type: 'fixed';
    player: 'self' | 'opponent';
    position: 'active' | 'source';
};

/**
 * Represents a target that has been resolved to a specific card.
 */
export type ResolvedFieldTarget = {
    type: 'resolved';
    targets: Array<{
        playerId: number;
        fieldIndex: number;
    }>;
};

/**
 * Represents a target that requires a single choice from available options.
 */
export type SingleChoiceFieldTarget = {
    type: 'single-choice';
    chooser: 'self' | 'opponent';
    criteria: FieldTargetCriteria;
};

/**
 * Represents a target that requires multiple choices from available options.
 */
export type MultiChoiceFieldTarget = {
    type: 'multi-choice';
    chooser: 'self' | 'opponent';
    criteria: FieldTargetCriteria;
    count: number;
};

/**
 * Represents a target that matches all creature meeting certain criteria.
 */
export type AllMatchingFieldTarget = {
    type: 'all-matching';
    criteria: FieldTargetCriteria;
};

/**
 * Union type for single targets (fixed, resolved, or choice-based).
 */
export type SingleFieldTarget = FixedFieldTarget | SingleChoiceFieldTarget | ResolvedFieldTarget;

/**
 * Union type for multi-targets (choice-based or all-matching).
 */
export type MultiFieldTarget = MultiChoiceFieldTarget | AllMatchingFieldTarget;

/**
 * Union type representing all possible field target specifications.
 * Used to specify the target(s) of an effect on field cards.
 */
export type FieldTarget = SingleFieldTarget | MultiFieldTarget;
