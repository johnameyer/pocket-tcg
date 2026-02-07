import { FieldCriteria, FieldTargetCriteria } from './criteria/field-target-criteria.js';
import { CardCriteria } from './criteria/card-criteria.js';
import { EnergyCriteria } from './targets/energy-target.js';
import { CardLocation } from './targets/card-target.js';

/**
 * Represents a constant numeric value.
 */
export type ConstantValue = {
    type: 'constant';
    value: number;
};

/**
 * @deprecated Use CountValue instead. ResolvedValue will be removed in a future version.
 * Represents a value that is resolved at runtime based on game state.
 * 
 * Migration guide:
 * - 'creature-count' → { type: 'count', countType: 'field', criteria: {} }
 * - 'benched-creature-count' → { type: 'count', countType: 'field', criteria: { position: 'bench' } }
 * - 'energy-count' → { type: 'count', countType: 'energy', fieldCriteria: {} }
 * - 'damage-taken' → { type: 'count', countType: 'damage', fieldCriteria: { position: 'active' } }
 * - 'cards-in-hand' → { type: 'count', countType: 'card', player: 'self', location: 'hand' }
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
 * Represents counting field cards matching criteria.
 * @example { type: 'count', countType: 'field', criteria: { position: 'bench' } } // Count benched creatures
 * @example { type: 'count', countType: 'field', criteria: { player: 'self', position: 'bench' } } // Count own benched
 */
export type FieldCountValue = {
    type: 'count';
    countType: 'field';
    criteria: FieldTargetCriteria;
};

/**
 * Represents counting energy matching criteria.
 * @example { type: 'count', countType: 'energy', fieldCriteria: { player: 'self', position: 'active' }, energyCriteria: { energyTypes: ['fire'] } } // Count fire energy on active
 * @example { type: 'count', countType: 'energy', fieldCriteria: { player: 'self' } } // Count all energy on own creatures
 */
export type EnergyCountValue = {
    type: 'count';
    countType: 'energy';
    fieldCriteria: FieldTargetCriteria;
    energyCriteria?: EnergyCriteria;
};

/**
 * Represents counting cards matching criteria in hand, deck, or discard.
 * @example { type: 'count', countType: 'card', player: 'opponent', location: 'hand' } // Count opponent's hand
 * @example { type: 'count', countType: 'card', player: 'self', location: 'discard', criteria: { cardType: 'supporter' } } // Count supporters in discard
 */
export type CardCountValue = {
    type: 'count';
    countType: 'card';
    player: 'self' | 'opponent';
    location: CardLocation;
    criteria?: CardCriteria;
};

/**
 * Represents counting damage on a specific creature.
 * @example { type: 'count', countType: 'damage', fieldCriteria: { player: 'self', position: 'active' } } // Count damage on own active
 */
export type DamageCountValue = {
    type: 'count';
    countType: 'damage';
    fieldCriteria: FieldTargetCriteria;
};

/**
 * Union type for all count value types.
 */
export type CountValue = FieldCountValue | EnergyCountValue | CardCountValue | DamageCountValue;

/**
 * Union type representing all possible effect values.
 * Used to define dynamic values in effects that can be resolved at runtime.
 */
export type EffectValue = ConstantValue | PlayerContextResolvedValue | MultiplicationValue | CoinFlipValue | AdditionValue | ConditionalValue | CountValue;
