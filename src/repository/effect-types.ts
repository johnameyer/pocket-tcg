import { FieldTarget, FieldTargetCriteria } from './targets/field-target.js';
import { EffectValue } from './effect-value-types.js';
import { AttachableEnergyType } from './energy-types.js';
import { CardTarget } from './targets/card-target.js';
import { PlayerTarget } from './targets/player-target.js';
import { Duration } from './duration-types.js';
import { EnergyTarget } from './targets/energy-target.js';
import { CardCriteria } from './criteria/card-criteria.js';

/**
 * Represents when an effect can be triggered.
 */
export type TriggerType = 'on-play' | 'on-attack' | 'on-damage' | 'on-knockout' | 'between-turns' | 'on-evolve' | 'damaged' | 'end-of-turn' | 'energy-attachment' | 'manual' | 'start-of-turn' | 'before-knockout' | 'on-checkup' | 'on-retreat';

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
 * Represents an effect that attaches energy to creatures.
 * @property {string} type - Always 'energy-attach' to identify this effect type
 * @property {AttachableEnergyType} energyType - The type of energy to attach
 * @property {EffectValue} amount - The amount of energy to attach
 * @property {FieldTarget} target - The target creature(s) to attach energy to
 * @example { type: 'energy-attach', energyType: 'fire', amount: { type: 'constant', value: 1 }, target: { type: 'fixed', player: 'self', position: 'active' } }
 * // Attach 1 fire energy to your active creature
 */
export type EnergyAttachEffect = {
    type: 'energy-attach';
    energyType: AttachableEnergyType;
    amount: EffectValue;
    target: FieldTarget;
};

/**
 * Represents an effect that discards energy from creatures.
 * @property {string} type - Always 'energy-discard' to identify this effect type
 * @property {EnergyTarget} energySource - The energy to discard (includes field target, energy criteria, and count)
 * @example { type: 'energy-discard', energySource: { type: 'field', fieldTarget: { type: 'fixed', player: 'self', position: 'active' }, criteria: { energyTypes: ['psychic', 'darkness'] }, count: 2 } }
 * // Discard a psychic and a dark energy from your active creature
 */
export type EnergyDiscardEffect = {
    type: 'energy-discard';
    energySource: EnergyTarget;
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
 * @property {string} type - Always 'energy-transfer' to identify this effect type
 * @property {EnergyTarget} source - The source of the energy to transfer (specifies which energy and from where)
 * @property {FieldTarget} target - The destination creature to receive energy (where energy goes to)
 * @example { type: 'energy-transfer', source: { type: 'field', fieldTarget: { type: 'single-choice', chooser: 'self', criteria: { player: 'self', location: 'field' }}, criteria: { energyTypes: ['fire', 'grass'] }, count: 1 }, target: { type: 'fixed', player: 'self', position: 'active' } }
 * // Transfer 1 fire or grass energy from a field creature to active creature
 */
export type EnergyTransferEffect = {
    type: 'energy-transfer';
    source: EnergyTarget;
    target: FieldTarget;
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
 * Represents an effect that modifies the energy cost of retreating.
 * @property {string} type - Always 'retreat-cost-modification' to identify this effect type
 * @property {'increase' | 'decrease'} operation - Whether to increase or decrease the retreat cost
 * @property {EffectValue} amount - The amount to modify retreat cost by (must be positive)
 * @property {FieldTargetCriteria} target - Criteria for which creatures to modify retreat cost for (evaluated passively)
 * @property {Duration} duration - How long the modification persists
 * @example { type: 'retreat-cost-modification', operation: 'decrease', amount: { type: 'constant', value: 1 }, target: { player: 'self', position: 'active' }, duration: 'this-turn' }
 * // Your active creature can retreat for 1 less energy this turn
 */
export type RetreatCostModificationEffect = {
    type: 'retreat-cost-modification';
    operation: 'increase' | 'decrease';
    amount: EffectValue;
    target: FieldTargetCriteria;
    duration: Duration;
};

/**
 * Immediate effects that are resolved immediately and don't persist over time.
 * These effects typically modify game state directly (e.g., draw cards, deal damage).
 */
export type ImmediateEffect =
    | HpEffect
    | StatusEffect
    | DrawEffect
    | EnergyAttachEffect
    | EnergyDiscardEffect
    | SearchEffect
    | ShuffleEffect
    | HandDiscardEffect
    | SwitchEffect
    | EnergyTransferEffect
    | CoinFlipManipulationEffect
    | EvolutionAccelerationEffect
    | EndTurnEffect
    | ToolDiscardEffect
    | StatusRecoveryEffect
    | SwapCardsEffect
    | MoveCardsEffect;

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
 * @property {FieldTargetCriteria} target - Criteria for which creatures cannot receive energy (evaluated passively)
 * @property {Duration} duration - How long energy attachment is prevented
 * @example { type: 'prevent-energy-attachment', target: { player: 'opponent', position: 'active' }, duration: 'this-turn' }
 * // Opponent cannot attach energy to their active creature this turn
 */
export type PreventEnergyAttachmentEffect = {
    type: 'prevent-energy-attachment';
    target: FieldTargetCriteria;
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
 * Represents an effect that discards tools from target creatures.
 * @property {string} type - Always 'tool-discard' to identify this effect type
 * @property {FieldTarget} target - The creature(s) to discard tools from
 * @example { type: 'tool-discard', target: { type: 'fixed', player: 'opponent', position: 'active' } }
 * // Discard tool from opponent's active creature
 */
export type ToolDiscardEffect = {
    type: 'tool-discard';
    target: FieldTarget;
};

/**
 * Represents an effect that removes status conditions from target creatures.
 * @property {string} type - Always 'status-recovery' to identify this effect type
 * @property {FieldTarget} target - The creature(s) to recover from status conditions
 * @property {StatusCondition[]} [conditions] - Optional specific conditions to remove; if not specified, removes all
 * @example { type: 'status-recovery', target: { type: 'fixed', player: 'self', position: 'active' } }
 * // Remove all status conditions from your active creature
 * @example { type: 'status-recovery', target: { type: 'fixed', player: 'self', position: 'active' }, conditions: ['poison', 'burn'] }
 * // Remove poison and burn from your active creature
 */
export type StatusRecoveryEffect = {
    type: 'status-recovery';
    target: FieldTarget;
    conditions?: StatusCondition[];
};

/**
 * Represents an effect that prevents status conditions from being applied.
 * @property {string} type - Always 'status-prevention' to identify this effect type
 * @property {FieldTargetCriteria} target - Criteria for which creatures are protected (evaluated passively)
 * @property {StatusCondition[]} [conditions] - Optional specific conditions to prevent; if not specified, prevents all
 * @property {Duration} duration - How long the prevention lasts
 * @example { type: 'status-prevention', target: { player: 'self', position: 'active' }, duration: 'this-turn' }
 * // Your active creature cannot receive any status conditions this turn
 * @example { type: 'status-prevention', target: { player: 'self' }, conditions: ['poison', 'burn'], duration: 'until-end-of-next-turn' }
 * // Your creatures cannot be poisoned or burned until end of next turn
 */
export type StatusPreventionEffect = {
    type: 'status-prevention';
    target: FieldTargetCriteria;
    conditions?: StatusCondition[];
    duration: Duration;
};

/**
 * Represents an effect that discards cards from hand and draws new ones.
 * @property {string} type - Always 'swap-cards' to identify this effect type
 * @property {EffectValue} discardAmount - The number of cards to discard from hand
 * @property {EffectValue} drawAmount - The number of cards to draw
 * @property {number} [maxDrawn] - Optional maximum number of cards that can be drawn (caps the draw)
 * @property {PlayerTarget} target - The player performing the swap
 * @example { type: 'swap-cards', discardAmount: { type: 'constant', value: 2 }, drawAmount: { type: 'constant', value: 2 }, target: 'self' }
 * // Discard 2 cards and draw 2 cards
 * @example { type: 'swap-cards', discardAmount: { type: 'constant', value: 1 }, drawAmount: { type: 'constant', value: 3 }, maxDrawn: 2, target: 'self' }
 * // Discard 1 card and draw up to 2 cards
 */
export type SwapCardsEffect = {
    type: 'swap-cards';
    discardAmount: EffectValue;
    drawAmount: EffectValue;
    maxDrawn?: number;
    target: PlayerTarget;
};

/**
 * Represents an effect that moves field cards to deck, hand, or discard.
 * Can include tools and evolution stack. Supports pull evolution functionality.
 * @property {string} type - Always 'move-cards' to identify this effect type
 * @property {FieldTarget} target - The creature(s) to move
 * @property {'deck' | 'hand' | 'discard'} destination - Where to move the card(s)
 * @property {'all' | 'tool' | 'evolution'} [include] - What to include with the card (tools, evolutions, or both)
 * @property {FieldTarget} [switchWith] - Optional creature to switch in when moving active creature
 * @property {boolean} [pullEvolution] - If true, pulls an evolution from deck and immediately evolves the target
 * @property {CardCriteria} [evolutionCriteria] - Criteria for the evolution to pull (only used with pullEvolution)
 * @property {boolean} [skipRestrictions] - If true, skips normal evolution restrictions (only used with pullEvolution)
 * @example { type: 'move-cards', target: { type: 'fixed', player: 'opponent', position: 'active' }, destination: 'hand', include: 'all' }
 * // Move opponent's active creature with all tools and evolutions to their hand
 * @example { type: 'move-cards', target: { type: 'fixed', player: 'self', position: 'active' }, destination: 'deck', pullEvolution: true, evolutionCriteria: { cardType: 'creature', stage: 2 } }
 * // Pull a stage 2 evolution from deck and evolve your active creature
 */
export type MoveCardsEffect = {
    type: 'move-cards';
    target: FieldTarget;
    destination: 'deck' | 'hand' | 'discard';
    include?: 'all' | 'tool' | 'evolution';
    switchWith?: FieldTarget;
    pullEvolution?: boolean;
    evolutionCriteria?: CardCriteria;
    skipRestrictions?: boolean;
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
    | RetreatCostModificationEffect
    | PreventPlayingEffect
    | PreventAttackEffect
    | PreventEnergyAttachmentEffect
    | AttackEnergyCostModifierEffect
    | StatusPreventionEffect;

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
