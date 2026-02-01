import { EffectValue } from './effect-value-types.js';
import { Target } from './target-types.js';
import { Condition } from './condition-types.js';
import { Duration } from './duration-types.js';

/**
 * Modifier effects that change values or prevent actions.
 * These are passive effects that last over time and are queried when needed,
 * rather than being immediately resolved.
 */

/**
 * Boosts damage dealt by attacks.
 * Applied during damage calculation.
 */
export type DamageBoostModifier = {
    type: 'damage-boost';
    amount: EffectValue;
    target?: Target;
    condition?: Condition;
};

/**
 * Reduces damage taken from attacks.
 * Applied during damage calculation.
 */
export type DamageReductionModifier = {
    type: 'damage-reduction';
    amount: EffectValue;
    target: Target;
};

/**
 * Prevents all damage from attacks (and their effects).
 * Applied during damage calculation.
 */
export type PreventDamageModifier = {
    type: 'prevent-damage';
    target?: Target;
    source?: string;
};

/**
 * Reduces the energy cost required to retreat.
 * Applied during retreat validation.
 */
export type RetreatCostReductionModifier = {
    type: 'retreat-cost-reduction';
    amount: EffectValue;
};

/**
 * Prevents retreating.
 * Applied during retreat validation.
 */
export type RetreatPreventionModifier = {
    type: 'retreat-prevention';
    target: Target;
};

/**
 * Adds additional effective HP to a card.
 * Applied during HP checks.
 */
export type HpBonusModifier = {
    type: 'hp-bonus';
    amount: EffectValue;
};

/**
 * Allows using previous evolution's attacks.
 * Applied during attack selection.
 */
export type EvolutionFlexibilityModifier = {
    type: 'evolution-flexibility';
    target: string;
    baseForm: string;
};

/**
 * Guarantees the next coin flip will be heads.
 * Applied during coin flip resolution.
 */
export type CoinFlipManipulationModifier = {
    type: 'coin-flip-manipulation';
    guaranteeNextHeads: boolean;
};

/**
 * Union type for all modifier effects that can be passive.
 */
export type ModifierEffect =
    | DamageBoostModifier
    | DamageReductionModifier
    | PreventDamageModifier
    | RetreatCostReductionModifier
    | RetreatPreventionModifier
    | HpBonusModifier
    | EvolutionFlexibilityModifier
    | CoinFlipManipulationModifier;

/**
 * Represents a passive effect with a duration.
 * The effect is active as long as the duration conditions are met.
 * 
 * @property {number} sourcePlayer - The player who activated this effect
 * @property {string} effectName - Display name for the effect (e.g., "Supporter's Boost")
 * @property {ModifierEffect} effect - The actual modifier effect
 * @property {Duration} duration - How long the effect remains active
 * @property {Condition} [condition] - Optional condition that must be met for effect to apply
 */
export type PassiveEffect = {
    sourcePlayer: number;
    effectName: string;
    effect: ModifierEffect;
    duration: Duration;
    condition?: Condition;
};
