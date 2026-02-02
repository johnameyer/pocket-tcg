import { Target, CardTarget, EnergyTarget, PlayerTarget, CardCriteria } from './target-types.js';
import { EffectValue } from './effect-value-types.js';
import { AttachableEnergyType } from './energy-types.js';
import { Condition } from './condition-types.js';

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

/**
 * Represents an effect that searches for cards in a specified location.
 * Supports searching deck or discard pile with flexible criteria.
 */
export type SearchEffect = {
    type: 'search';
    /** Location to search from (defaults to 'deck') */
    source?: CardTarget;
    /** Card selection criteria */
    criteria?: CardCriteria;
    /** Number of cards to search for */
    amount: EffectValue;
    /** Where to put found cards (defaults to 'hand') */
    destination?: 'hand' | 'deck' | 'field';
};

/**
 * Represents an effect that shuffles deck or hand.
 */
export type ShuffleEffect = {
    type: 'shuffle';
    target: PlayerTarget;
    shuffleHand?: boolean;
    drawAfter?: EffectValue;
};

/**
 * Represents an effect that discards cards from hand.
 */
export type HandDiscardEffect = {
    type: 'hand-discard';
    amount: EffectValue;
    target: PlayerTarget;
    shuffleIntoDeck?: boolean;
};

export type SwitchEffect = {
    type: 'switch';
    target: Target;
    switchWith: Target;
};

/**
 * Represents an effect that transfers energy between cards.
 * Can now target energy in discard pile as well as on field cards.
 */
export type EnergyTransferEffect = {
    type: 'energy-transfer';
    source: Target | EnergyTarget;
    target: Target | EnergyTarget;
    amount: EffectValue;
    energyTypes: AttachableEnergyType[];
};

/**
 * Represents an effect that discards tools from targeted field cards.
 */
export type ToolDiscardEffect = {
    type: 'tool-discard';
    target: Target;
};

/**
 * Represents an effect that pulls an evolution from deck and immediately evolves.
 */
export type PullEvolutionEffect = {
    type: 'pull-evolution';
    /** The card to evolve */
    target: Target;
    /** Search criteria for finding the evolution card */
    evolutionCriteria?: CardCriteria;
    /** Whether this can be used on first turn or multiple times per turn */
    skipRestrictions?: boolean;
};

/**
 * Represents an effect that swaps cards (discard to get different ones).
 */
export type SwapCardsEffect = {
    type: 'swap-cards';
    /** Cards to discard */
    discardTarget: CardTarget;
    /** Cards to get in exchange */
    drawTarget: CardTarget;
    /** Whether the number drawn must equal number discarded */
    balanced?: boolean;
};

/**
 * Represents an effect that prevents special conditions.
 */
export type StatusPreventionEffect = {
    type: 'status-prevention';
    target: Target;
    /** Which conditions to prevent (all if not specified) */
    conditions?: StatusCondition[];
    /** How long the prevention lasts */
    duration?: string;
};

/**
 * Represents an effect that recovers from special conditions.
 */
export type StatusRecoveryEffect = {
    type: 'status-recovery';
    target: Target;
    /** Which conditions to recover from (all if not specified) */
    conditions?: StatusCondition[];
};

/**
 * Represents an effect that moves cards (with tools/evolution) to deck/hand.
 * Requires switching in a replacement from bench.
 */
export type MoveCardsEffect = {
    type: 'move-cards';
    /** The card to move */
    target: Target;
    /** Where to move the card */
    destination: 'deck' | 'hand';
    /** Whether to include attached tools */
    includeTools?: boolean;
    /** Whether to include evolution stack */
    includeEvolutionStack?: boolean;
    /** The card to switch in (required if moving active card) */
    switchWith?: Target;
};

export type PreventDamageEffect = {
    type: 'prevent-damage';
    target?: Target;
    source?: string;
};

export type DamageReductionEffect = {
    type: 'damage-reduction';
    amount: EffectValue;
    target: Target;
    duration?: string;
};

export type RetreatPreventionEffect = {
    type: 'retreat-prevention';
    target: Target;
    duration: string;
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
    duration?: string;
};

export type HpBonusEffect = {
    type: 'hp-bonus';
    amount: EffectValue;
};

export type RetreatCostReductionEffect = {
    type: 'retreat-cost-reduction';
    amount: EffectValue;
};

/**
 * Union type representing all possible effects that can be applied in the game.
 * This is used to define what an effect can do, from dealing damage to drawing cards.
 */
export type Effect = 
    | HpEffect 
    | StatusEffect 
    | DrawEffect 
    | EnergyEffect 
    | SearchEffect 
    | ShuffleEffect 
    | HandDiscardEffect 
    | SwitchEffect 
    | EnergyTransferEffect 
    | PreventDamageEffect 
    | DamageReductionEffect 
    | RetreatPreventionEffect 
    | EvolutionAccelerationEffect 
    | EvolutionFlexibilityEffect 
    | EndTurnEffect 
    | CoinFlipManipulationEffect 
    | DamageBoostEffect 
    | HpBonusEffect 
    | RetreatCostReductionEffect
    | ToolDiscardEffect
    | PullEvolutionEffect
    | SwapCardsEffect
    | StatusPreventionEffect
    | StatusRecoveryEffect
    | MoveCardsEffect;

/**
 * Represents an effect that requires target selection before it can be applied.
 * These effects are stored in a pending state until the target is selected.
 * @property {number} sourcePlayer - The player who initiated the effect
 * @property {string} effectName - The name of the effect (for display purposes)
 */
export type PendingTargetEffect = (HpEffect | StatusEffect) & { sourcePlayer: number; effectName: string };
