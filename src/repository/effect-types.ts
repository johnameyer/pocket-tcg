import { Target } from './target-types.js';
import { EffectValue } from './effect-value-types.js';
import { AttachableEnergyType } from './energy-types.js';
import { Condition } from './condition-types.js';
import { Duration } from './duration-types.js';

/**
 * Represents when an effect can be triggered.
 */
export type TriggerType = 'on-play' | 'on-attack' | 'on-damage' | 'on-knockout' | 'between-turns' | 'on-evolve' | 'damaged' | 'end-of-turn' | 'energy-attachment' | 'manual';

/**
 * Represents status conditions that can be applied to creatures.
 */
export type StatusCondition = 'sleep' | 'burn' | 'confusion' | 'paralysis' | 'poison';

/**
 * Represents an effect that modifies a creature's HP (healing or damage).
 * @property {string} type - Always 'hp' to identify this effect type
 * @property {EffectValue} amount - The amount of HP to heal or damage
 * @property {Target} target - The target(s) of the effect
 * @property {string} operation - Whether to 'heal' or 'damage' the target
 * @example { type: 'hp', amount: { type: 'constant', value: 30 }, target: { type: 'fixed', player: 'self', position: 'active' }, operation: 'heal' }
 * // Heal 30 HP from your active creature
 */
export type HpEffect = {
    type: 'hp';
    amount: EffectValue;
    target: Target;
    operation: 'heal' | 'damage';
};

/**
 * Represents an effect that applies a status condition to a target.
 * @property {string} type - Always 'status' to identify this effect type
 * @property {StatusCondition} condition - The status condition to apply
 * @property {Target} target - The target(s) to apply the status to
 */
export type StatusEffect = {
    type: 'status';
    condition: StatusCondition;
    target: Target;
};

export type DrawEffect = {
    type: 'draw';
    amount: EffectValue;
};

export type EnergyEffect = {
    type: 'energy';
    energyType: AttachableEnergyType;
    amount: EffectValue;
    target: Target;
    operation: 'attach' | 'discard';
};

export type SearchEffect = {
    type: 'search';
    criteria?: string;
    cardType?: string;
    target?: string;
    amount: EffectValue;
    destination?: string;
};

export type ShuffleEffect = {
    type: 'shuffle';
    target: string;
    shuffleHand?: boolean;
    drawAfter?: EffectValue;
};

export type HandDiscardEffect = {
    type: 'hand-discard';
    amount: EffectValue;
    target: string;
    shuffleIntoDeck?: boolean;
};

export type SwitchEffect = {
    type: 'switch';
    target: Target;
    switchWith: Target;
};

export type EnergyTransferEffect = {
    type: 'energy-transfer';
    source: Target;
    target: Target;
    amount: EffectValue;
    energyTypes: AttachableEnergyType[];
};

export type PreventDamageEffect = {
    type: 'prevent-damage';
    target?: Target;
    source?: string;
    duration?: Duration;
};

export type DamageReductionEffect = {
    type: 'damage-reduction';
    amount: EffectValue;
    target: Target;
    duration?: Duration;
};

export type RetreatPreventionEffect = {
    type: 'retreat-prevention';
    target: Target;
    duration: Duration;
};

export type EvolutionAccelerationEffect = {
    type: 'evolution-acceleration';
    target: Target;
    skipStages: number;
    restrictions?: string[];
};

export type EvolutionFlexibilityEffect = {
    type: 'evolution-flexibility';
    target: string;
    baseForm: string;
};

export type EndTurnEffect = {
    type: 'end-turn';
};

export type CoinFlipManipulationEffect = {
    type: 'coin-flip-manipulation';
    guaranteeNextHeads: boolean;
};

export type DamageBoostEffect = {
    type: 'damage-boost';
    amount: EffectValue;
    target?: Target;
    condition?: Condition;
    duration?: Duration;
};

export type HpBonusEffect = {
    type: 'hp-bonus';
    amount: EffectValue;
};

export type RetreatCostReductionEffect = {
    type: 'retreat-cost-reduction';
    amount: EffectValue;
    duration?: Duration;
};

/**
 * Immediate effects that are resolved immediately and don't persist over time.
 * These effects typically modify game state directly (e.g., draw cards, deal damage).
 */
export type ImmediateEffect =
    | HpEffect
    | StatusEffect
    | DrawEffect
    | EnergyEffect
    | SearchEffect
    | ShuffleEffect
    | HandDiscardEffect
    | SwitchEffect
    | EnergyTransferEffect
    | EvolutionAccelerationEffect
    | EndTurnEffect;

/**
 * Modifier effects that can be passive and last over time.
 * These effects change values or prevent actions and are queried when needed.
 */
export type ModifierEffect =
    | PreventDamageEffect
    | DamageReductionEffect
    | RetreatPreventionEffect
    | EvolutionFlexibilityEffect
    | CoinFlipManipulationEffect
    | DamageBoostEffect
    | HpBonusEffect
    | RetreatCostReductionEffect;

/**
 * Union type representing all possible effects that can be applied in the game.
 * This is used to define what an effect can do, from dealing damage to drawing cards.
 */
export type Effect = ImmediateEffect | ModifierEffect;

/**
 * Represents an effect that requires target selection before it can be applied.
 * These effects are stored in a pending state until the target is selected.
 * @property {number} sourcePlayer - The player who initiated the effect
 * @property {string} effectName - The name of the effect (for display purposes)
 */
export type PendingTargetEffect = (HpEffect | StatusEffect) & { sourcePlayer: number; effectName: string };
