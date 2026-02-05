import { FieldCriteria } from './criteria/field-target-criteria.js';

/**
 * Represents a constant numeric value.
 */
export type ConstantValue = {
    type: 'constant';
    value: number;
};

/**
 * Represents a value that is resolved at runtime based on game state.
 */
export type ResolvedValue = {
    type: 'resolved';
    source: 'creature-count' | 'benched-creature-count' | 'energy-count' | 'damage-taken' | 'cards-in-hand';
    multiplier?: number;
};

/**
 * Represents a value resolved from player context (like hand size, points).
 */
export type PlayerContextResolvedValue = {
    type: 'player-context-resolved';
    source: 'hand-size' | 'points-to-win' | 'current-points';
    playerContext: 'self' | 'opponent';
};

/**
 * Represents a value that is calculated by multiplying a base value by a multiplier.
 */
export type MultiplicationValue = {
    type: 'multiplication';
    base: EffectValue;
    multiplier: EffectValue;
};

/**
 * Represents a value that depends on coin flip results.
 */
export type CoinFlipValue = {
    type: 'coin-flip';
    headsValue: number;
    tailsValue: number;
    flipCount?: number;
};

/**
 * Represents a value that is calculated by adding multiple values together.
 */
export type AdditionValue = {
    type: 'addition';
    values: EffectValue[];
};

/**
 * Represents a value that depends on a condition being met.
 */
export type ConditionalValue = {
    type: 'conditional';
    condition: FieldCriteria;
    trueValue: EffectValue;
    falseValue: EffectValue;
};

/**
 * Union type representing all possible effect values.
 * Used to define dynamic values in effects that can be resolved at runtime.
 */
export type EffectValue = ConstantValue | ResolvedValue | PlayerContextResolvedValue | MultiplicationValue | CoinFlipValue | AdditionValue | ConditionalValue;
