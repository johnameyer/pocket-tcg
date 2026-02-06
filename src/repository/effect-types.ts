import { FieldTarget, FieldTargetCriteria } from './targets/field-target.js';
import { EffectValue } from './effect-value-types.js';
import { AttachableEnergyType } from './energy-types.js';
import { CardTarget } from './targets/card-target.js';
import { PlayerTarget } from './targets/player-target.js';
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
 * @property {FieldTarget} target - The target(s) of the effect
 * @property {string} operation - Whether to 'heal' or 'damage' the target
 * @example { type: 'hp', amount: { type: 'constant', value: 30 }, target: { type: 'fixed', player: 'self', position: 'active' }, operation: 'heal' }
 * // Heal 30 HP from your active creature
 */
export type HpEffect = {
    type: 'hp';
    amount: EffectValue;
    target: FieldTarget;
    operation: 'heal' | 'damage';
};

/**
 * Represents an effect that applies a status condition to a target.
 * @property {string} type - Always 'status' to identify this effect type
 * @property {StatusCondition} condition - The status condition to apply
 * @property {FieldTarget} target - The target(s) to apply the status to
 * @example { type: 'status', condition: 'poison', target: { type: 'fixed', player: 'opponent', position: 'active' } }
 * // Apply poison to opponent's active creature
 */
export type StatusEffect = {
    type: 'status';
    condition: StatusCondition;
    target: FieldTarget;
};

/**
 * Represents an effect that draws cards from the deck.
 * @property {string} type - Always 'draw' to identify this effect type
 * @property {EffectValue} amount - The number of cards to draw
 * @example { type: 'draw', amount: { type: 'constant', value: 3 } }
 * // Draw 3 cards
 */
export type DrawEffect = {
    type: 'draw';
    amount: EffectValue;
};

/**
 * Represents an effect that modifies or transfers energy on creatures.
 * @property {string} type - Always 'energy' to identify this effect type
 * @property {AttachableEnergyType} energyType - The type of energy to modify
 * @property {EffectValue} amount - The amount of energy to attach or discard
 * @property {FieldTarget} target - The target creature(s) to modify
 * @property {string} operation - Whether to 'attach' or 'discard' energy
 * @example { type: 'energy', energyType: 'fire', amount: { type: 'constant', value: 1 }, target: { type: 'fixed', player: 'self', position: 'active' }, operation: 'attach' }
 * // Attach 1 fire energy to your active creature
 */
export type EnergyEffect = {
    type: 'energy';
    energyType: AttachableEnergyType;
    amount: EffectValue;
    target: FieldTarget;
    operation: 'attach' | 'discard';
};

/**
 * Represents an effect that searches for cards in a specified location.
 * Supports searching deck or discard pile with flexible criteria.
 * @property {string} type - Always 'search' to identify this effect type
 * @property {CardTarget} source - The location and criteria for cards to search
 * @property {EffectValue} amount - The number of cards to search for
 * @property {string} destination - The destination for searched cards (currently only 'hand')
 * @example { type: 'search', source: { type: 'fixed', player: 'self', location: 'deck' }, amount: { type: 'constant', value: 1 }, destination: 'hand' }
 * // Search your deck for any card and add it to hand
 */
export type SearchEffect = {
    type: 'search';
    /** Card(s) being sought */
    source: CardTarget;
    /** Number of cards to search for */
    amount: EffectValue;
    destination: 'hand'; // CardLocation;
};

/**
 * Represents an effect that shuffles deck or hand.
 * @property {string} type - Always 'shuffle' to identify this effect type
 * @property {PlayerTarget} target - The player whose deck/hand to shuffle
 * @property {boolean} [shuffleHand] - If true, shuffles hand; otherwise shuffles deck
 * @property {EffectValue} [drawAfter] - Optional number of cards to draw after shuffling
 * @example { type: 'shuffle', target: 'self', shuffleHand: true, drawAfter: { type: 'constant', value: 3 } }
 * // Shuffle opponent's hand and draw 3 cards
 */
export type ShuffleEffect = {
    type: 'shuffle';
    target: PlayerTarget;
    shuffleHand?: boolean;
    drawAfter?: EffectValue;
};

/**
 * Represents an effect that discards cards from hand.
 * @property {string} type - Always 'hand-discard' to identify this effect type
 * @property {EffectValue} amount - The number of cards to discard
 * @property {PlayerTarget} target - The player whose hand to discard from
 * @property {boolean} [shuffleIntoDeck] - If true, shuffles discarded cards back into deck
 * @example { type: 'hand-discard', amount: { type: 'constant', value: 2 }, target: 'opponent' }
 * // Opponent discards 2 cards from hand
 */
export type HandDiscardEffect = {
    type: 'hand-discard';
    amount: EffectValue;
    target: PlayerTarget;
    shuffleIntoDeck?: boolean;
};

/**
 * Represents an effect that switches active and benched creatures.
 * @property {string} type - Always 'switch' to identify this effect type
 * @property {FieldTarget} target - The creature to switch out (typically the active creature)
 * @property {FieldTarget} switchWith - The creature to switch in (typically a benched creature to become active)
 * @example { type: 'switch', target: { type: 'fixed', player: 'self', position: 'active' }, switchWith: { type: 'single-choice', chooser: 'self', criteria: { player: 'self', location: 'field', position: 'bench' }} }
 * // Switch your active creature with a benched one
 */
export type SwitchEffect = {
    type: 'switch';
    target: FieldTarget;
    switchWith: FieldTarget;
};

/**
 * Represents an effect that transfers energy between cards.
 * Can target energy in discard pile as well as on field cards.
 * @property {string} type - Always 'energy-transfer' to identify this effect type
 * @property {FieldTarget} source - The source of the energy to transfer (where energy comes from)
 * @property {FieldTarget} target - The destination creature to receive energy (where energy goes to)
 * @property {EffectValue} amount - The amount of energy to transfer
 * @property {AttachableEnergyType[]} energyTypes - The types of energy that can be transferred
 * @example { type: 'energy-transfer', source: { type: 'single-choice', chooser: 'self', criteria: { player: 'self', location: 'field' }}, target: { type: 'fixed', player: 'self', position: 'bench' }, amount: { type: 'constant', value: 1 }, energyTypes: ['fire', 'grass'] }
 * // Transfer 1 fire or grass energy from a field creature to a benched creature
 */
export type EnergyTransferEffect = {
    type: 'energy-transfer';
    source: FieldTarget;
    target: FieldTarget;
    amount: EffectValue;
    energyTypes: AttachableEnergyType[];
};

/**
 * Represents an effect that prevents damage to a target.
 * @property {string} type - Always 'prevent-damage' to identify this effect type
 * @property {FieldTarget} target - The creature to protect from damage (where damage is being prevented)
 * @property {FieldTargetCriteria} damageSource - Criteria matching which attackers' damage to block
 * @property {Duration} duration - How long the damage is prevented
 * @example { type: 'prevent-damage', target: { type: 'fixed', player: 'self', position: 'active' }, damageSource: { player: 'opponent', fieldCriteria: { cardCriteria: { attributes: { ex: true } } } }, duration: 'until-end-of-next-turn' }
 * // Your active creature prevents all damage from opponent's ex creatures
 */
export type PreventDamageEffect = {
    type: 'prevent-damage';
    target: FieldTargetCriteria;
    damageSource: FieldTargetCriteria;
    duration: Duration;
};

/**
 * Represents an effect that reduces incoming damage to a target.
 * @property {string} type - Always 'damage-reduction' to identify this effect type
 * @property {EffectValue} amount - The amount of damage to reduce from incoming damage
 * @property {FieldTargetCriteria} damageSource - Criteria for matching which attacker's damage to reduce (evaluated passively against source creature)
 * @property {FieldTarget} target - The target creature to protect (usually your active creature)
 * @property {Duration} duration - How long the protection persists
 * @example { type: 'damage-reduction', amount: { type: 'constant', value: 20 }, damageSource: { fieldCriteria: { attributes: { ex: true } } }, target: { type: 'fixed', player: 'self', position: 'active' }, duration: 'this-turn' }
 * // Reduce all incoming damage to your active creature from ex creatures by 20 this turn
 */
export type DamageReductionEffect = {
    type: 'damage-reduction';
    amount: EffectValue;
    damageSource: FieldTargetCriteria;
    target: FieldTarget;
    duration: Duration;
};

/**
 * Represents an effect that prevents retreat from a creature.
 * @property {string} type - Always 'retreat-prevention' to identify this effect type
 * @property {FieldTarget} target - The creature that cannot retreat
 * @property {string} duration - How long the creature cannot retreat
 * @example { type: 'retreat-prevention', target: { type: 'fixed', player: 'opponent', position: 'active' }, duration: 'until-damage-taken' }
 * // Opponent's active creature cannot retreat until it takes damage
 */
export type RetreatPreventionEffect = {
    type: 'retreat-prevention';
    target: FieldTarget;
    duration: Duration;
};

/**
 * Represents an effect that allows creatures to skip evolution stages.
 * @property {string} type - Always 'evolution-acceleration' to identify this effect type
 * @property {FieldTarget} target - The creature to evolve
 * @property {number} skipStages - The number of evolution stages to skip
 * @property {string[]} [restrictions] - Optional restrictions on which creatures can use this effect
 * @example { type: 'evolution-acceleration', target: { type: 'fixed', player: 'self', position: 'active' }, skipStages: 1, restrictions: ['basic-creature-only'] }
 * // Your active basic creature can evolve skipping 1 stage
 */
export type EvolutionAccelerationEffect = {
    type: 'evolution-acceleration';
    target: FieldTarget;
    skipStages: number;
    restrictions?: string[];
};

/**
 * Represents an effect that allows flexible evolution paths.
 * @property {string} type - Always 'evolution-flexibility' to identify this effect type
 * @property {string} target - The card which has flexibility
 * @example { type: 'evolution-flexibility', target: 'evolution-creature', baseForm: 'basic-creature' }
 * // Evolution Creature can evolve from Basic Creature
 */
export type EvolutionFlexibilityEffect = {
    type: 'evolution-flexibility';
    target: string;
    baseForm: string;
    duration: Duration;
};

/**
 * Represents an effect that ends the current turn immediately.
 * @property {string} type - Always 'end-turn' to identify this effect type
 * @example { type: 'end-turn' }
 * // End your turn immediately
 */
export type EndTurnEffect = {
    type: 'end-turn';
};

/**
 * Represents an effect that manipulates coin flip outcomes.
 * @property {string} type - Always 'coin-flip-manipulation' to identify this effect type
 * @property {boolean} guaranteeNextHeads - If true, guarantees the next coin flip is heads
 * @example { type: 'coin-flip-manipulation', guaranteeNextHeads: true }
 * // Your next coin flip is guaranteed to be heads
 */
export type CoinFlipManipulationEffect = {
    type: 'coin-flip-manipulation';
    guaranteeNextHeads: boolean;
    duration: Duration;
};

/**
 * Represents an effect that increases damage output from attacks.
 * @property {string} type - Always 'damage-boost' to identify this effect type
 * @property {EffectValue} amount - The amount of additional damage to deal in attacks
 * @property {FieldTargetCriteria} damageSource - Criteria for matching which creature's attacks are boosted (evaluated passively against source creature)
 * @property {FieldTarget} target - Which opponent creatures receive the boosted damage
 * @property {Duration} duration - How long the boost persists
 * @example { type: 'damage-boost', amount: { type: 'constant', value: 30 }, damageSource: { fieldCriteria: { attributes: { ex: true } } }, target: { type: 'fixed', player: 'opponent', position: 'active' }, duration: 'this-turn' }
 * // Ex creatures deal 30 more damage to opponent's active creature this turn
 */
export type DamageBoostEffect = {
    type: 'damage-boost';
    amount: EffectValue;
    damageSource: FieldTargetCriteria;
    target: FieldTarget;
    duration: Duration;
};

/**
 * Represents an effect that increases a creature's maximum HP.
 * @property {string} type - Always 'hp-bonus' to identify this effect type
 * @property {EffectValue} amount - The amount of HP to add to maximum HP
 * @property {FieldTargetCriteria} target - Criteria for which creatures to boost max HP for (evaluated passively)
 * @property {Duration} duration - How long the bonus persists
 * @example { type: 'hp-bonus', amount: { type: 'constant', value: 50 }, target: { player: 'self', position: 'active' }, duration: 'this-turn' }
 * // Your active creature gains 50 maximum HP this turn
 */
export type HpBonusEffect = {
    type: 'hp-bonus';
    amount: EffectValue;
    target: FieldTargetCriteria;
    duration: Duration;
};

/**
 * Represents an effect that reduces the energy cost of retreating.
 * @property {string} type - Always 'retreat-cost-reduction' to identify this effect type
 * @property {EffectValue} amount - The amount to reduce retreat cost by (must be positive)
 * @property {FieldTargetCriteria} target - Criteria for which creatures to reduce retreat cost for (evaluated passively)
 * @property {Duration} duration - How long the reduction persists
 * @example { type: 'retreat-cost-reduction', amount: { type: 'constant', value: 1 }, target: { player: 'self', position: 'active' }, duration: 'this-turn' }
 * // Your active creature can retreat for 1 less energy this turn
 */
export type RetreatCostReductionEffect = {
    type: 'retreat-cost-reduction';
    amount: EffectValue;
    target: FieldTargetCriteria;
    duration: Duration;
};

/**
 * Represents an effect that increases the energy cost of retreating.
 * @property {string} type - Always 'retreat-cost-increase' to identify this effect type
 * @property {EffectValue} amount - The amount to increase retreat cost by (must be positive)
 * @property {FieldTargetCriteria} target - Criteria for which creatures to increase retreat cost for (evaluated passively)
 * @property {Duration} duration - How long the increase persists
 * @example { type: 'retreat-cost-increase', amount: { type: 'constant', value: 1 }, target: { player: 'opponent', position: 'active' }, duration: 'this-turn' }
 * // Opponent's active creature needs 1 more energy to retreat this turn
 */
export type RetreatCostIncreaseEffect = {
    type: 'retreat-cost-increase';
    amount: EffectValue;
    target: FieldTargetCriteria;
    duration: Duration;
};

/**
 * Unified type for retreat cost modification effects.
 * Combines reduction and increase into a single type with operation enum.
 */
export type RetreatCostModificationEffect = RetreatCostReductionEffect | RetreatCostIncreaseEffect;

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
    | CoinFlipManipulationEffect
    | EvolutionAccelerationEffect
    | EndTurnEffect;

/**
 * Represents an effect that prevents playing specific card types.
 * @property {string} type - Always 'prevent-playing' to identify this effect type
 * @property {Array<'creature' | 'item' | 'supporter' | 'tool'>} cardTypes - Which card types cannot be played
 * @property {'self' | 'opponent' | 'both'} target - Which player(s) cannot play the cards
 * @property {Duration} duration - How long the prevention persists
 * @example { type: 'prevent-playing', cardTypes: ['item'], target: 'opponent', duration: 'this-turn' }
 * // Opponent cannot play items this turn
 */
export type PreventPlayingEffect = {
    type: 'prevent-playing';
    cardTypes: Array<'creature' | 'item' | 'supporter' | 'tool'>;
    target: 'self' | 'opponent' | 'both';
    duration: Duration;
};

/**
 * Represents an effect that prevents a creature from attacking.
 * @property {string} type - Always 'prevent-attack' to identify this effect type
 * @property {FieldTargetCriteria} target - Criteria for which creatures cannot attack (evaluated passively)
 * @property {Duration} duration - How long creatures cannot attack
 * @example { type: 'prevent-attack', target: { player: 'opponent', position: 'active' }, duration: 'until-end-of-next-turn' }
 * // Opponent's active creature cannot attack until end of next turn
 */
export type PreventAttackEffect = {
    type: 'prevent-attack';
    target: FieldTargetCriteria;
    duration: Duration;
};

/**
 * Represents an effect that prevents energy attachment to creatures.
 * @property {string} type - Always 'prevent-energy-attachment' to identify this effect type
 * @property {'self' | 'opponent' | 'both'} target - Which player(s) cannot attach energy
 * @property {Duration} duration - How long energy attachment is prevented
 * @example { type: 'prevent-energy-attachment', target: 'opponent', duration: 'this-turn' }
 * // Opponent cannot attach energy this turn
 */
export type PreventEnergyAttachmentEffect = {
    type: 'prevent-energy-attachment';
    target: 'self' | 'opponent' | 'both';
    duration: Duration;
};

/**
 * Represents an effect that modifies attack energy cost.
 * @property {string} type - Always 'attack-energy-cost-modifier' to identify this effect type
 * @property {EffectValue} amount - The amount to modify attack energy costs by (positive to increase, negative to decrease)
 * @property {FieldTargetCriteria} target - Criteria for which creatures have modified attack costs (evaluated passively)
 * @property {Duration} duration - How long the modifier persists
 * @example { type: 'attack-energy-cost-modifier', amount: { type: 'constant', value: -1 }, target: { player: 'self', position: 'active' }, duration: 'this-turn' }
 * // Your active creature's attacks cost 1 less energy this turn
 */
export type AttackEnergyCostModifierEffect = {
    type: 'attack-energy-cost-modifier';
    amount: EffectValue;
    target: FieldTargetCriteria;
    duration: Duration;
};

/**
 * Modifier effects that can be passive and last over time.
 * These effects change values or prevent actions and are queried when needed.
 */
export type ModifierEffect =
    | PreventDamageEffect
    | DamageReductionEffect
    | RetreatPreventionEffect
    | EvolutionFlexibilityEffect
    | DamageBoostEffect
    | HpBonusEffect
    | RetreatCostReductionEffect
    | RetreatCostIncreaseEffect
    | PreventPlayingEffect
    | PreventAttackEffect
    | PreventEnergyAttachmentEffect
    | AttackEnergyCostModifierEffect;

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
