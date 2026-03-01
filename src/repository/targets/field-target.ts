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
 * A target that refers to a named creature from the execution context.
 * The `context` discriminant restricts which execution context this target is valid in,
 * providing compile-time documentation and runtime validation.
 *
 * @example { type: 'contextual', context: 'attack', reference: 'defender' }
 * // The creature being attacked (valid only in attack effects)
 *
 * @example { type: 'contextual', context: 'damaged', reference: 'attacker' }
 * // The creature that dealt the damage (valid only in 'damaged' trigger effects)
 *
 * @example { type: 'contextual', context: 'energy-attachment', reference: 'trigger-target' }
 * // The creature energy was attached to (valid only in 'energy-attachment' trigger effects)
 */
export type ContextualFieldTarget =
    | { type: 'contextual'; context: 'attack'; reference: 'defender' }
    | { type: 'contextual'; context: 'damaged'; reference: 'attacker' }
    | { type: 'contextual'; context: 'before-knockout'; reference: 'attacker' }
    | { type: 'contextual'; context: 'energy-attachment'; reference: 'trigger-target' };

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
export type SingleFieldTarget = FixedFieldTarget | SingleChoiceFieldTarget | ResolvedFieldTarget | ContextualFieldTarget;

/**
 * Union type for multi-targets (choice-based or all-matching).
 */
export type MultiFieldTarget = MultiChoiceFieldTarget | AllMatchingFieldTarget;

/**
 * Union type representing all possible field target specifications.
 * Used to specify the target(s) of an effect on field cards.
 */
export type FieldTarget = SingleFieldTarget | MultiFieldTarget;
