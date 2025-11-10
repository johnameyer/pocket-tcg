import { Condition } from './condition-types.js';
import { EnergyRequirementType } from './energy-types.js';

/**
 * Represents a player target for effects.
 */
export type PlayerTarget = 'self' | 'opponent' | 'both';

/**
 * Represents criteria for targeting specific cards or creature.
 * Used to filter which cards can be targeted by an effect.
 */
export type TargetCriteria = {
    player?: 'self' | 'opponent';
    position?: 'active' | 'bench';
    location?: 'field' | 'hand' | 'deck';
    fieldCardType?: EnergyRequirementType;
    condition?: Condition;
};

/**
 * Represents a fixed target that doesn't require selection.
 */
export type FixedTarget = {
    type: 'fixed';
    player: 'self' | 'opponent';
    position: 'active' | 'source';
};

/**
 * Represents a target that has been resolved to a specific card.
 */
export type ResolvedTarget = {
    type: 'resolved';
    targets: Array<{
        playerId: number;
        fieldIndex: number;
    }>;
};

/**
 * Represents a target that requires a single choice from available options.
 */
export type SingleChoiceTarget = {
    type: 'single-choice';
    chooser: 'self' | 'opponent';
    criteria: TargetCriteria;
};

/**
 * Represents a target that requires multiple choices from available options.
 */
export type MultiChoiceTarget = {
    type: 'multi-choice';
    chooser: 'self' | 'opponent';
    criteria: TargetCriteria;
    count: number;
};

/**
 * Represents a target that matches all creature meeting certain criteria.
 */
export type AllMatchingTarget = {
    type: 'all-matching';
    criteria: TargetCriteria;
};

/**
 * Union type for single targets (fixed, resolved, or choice-based).
 */
export type SingleTarget = FixedTarget | SingleChoiceTarget | ResolvedTarget;

/**
 * Union type for multi-targets (choice-based or all-matching).
 */
export type MultiTarget = MultiChoiceTarget | AllMatchingTarget;

/**
 * Union type representing all possible target specifications.
 * Used to specify the target(s) of an effect.
 */
export type Target = SingleTarget | MultiTarget;
