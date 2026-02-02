import { Condition } from './condition-types.js';
import { EnergyRequirementType, AttachableEnergyType } from './energy-types.js';

/**
 * Represents a player target for effects.
 */
export type PlayerTarget = 'self' | 'opponent' | 'both';

/**
 * Represents location where cards can be found.
 */
export type CardLocation = 'hand' | 'deck' | 'discard' | 'field';

/**
 * Base criteria shared by all card types.
 */
export type BaseCardCriteria = {
    /** Specific card names (exact match) */
    names?: string[];
};

/**
 * Criteria specific to creature cards.
 */
export type CreatureCardCriteria = BaseCardCriteria & {
    cardType: 'creature';
    /** Evolution stage (0=Basic, 1=Stage 1, 2=Stage 2) */
    stage?: 0 | 1 | 2;
    /** Energy type filter */
    energyType?: AttachableEnergyType;
    /** HP greater than this value */
    hpGreaterThan?: number;
    /** HP less than this value */
    hpLessThan?: number;
    /** Creature-specific condition */
    condition?: Condition;
};

/**
 * Criteria for tool cards.
 */
export type ToolCardCriteria = BaseCardCriteria & {
    cardType: 'tool';
};

/**
 * Criteria for supporter cards.
 */
export type SupporterCardCriteria = BaseCardCriteria & {
    cardType: 'supporter';
};

/**
 * Criteria for item cards.
 */
export type ItemCardCriteria = BaseCardCriteria & {
    cardType: 'item';
};

/**
 * Criteria for trainer cards (items or supporters).
 */
export type TrainerCardCriteria = BaseCardCriteria & {
    cardType: 'trainer';
};

/**
 * Represents criteria for targeting cards in hand, deck, or discard.
 * Used to filter which cards can be selected.
 */
export type CardCriteria = CreatureCardCriteria | ToolCardCriteria | SupporterCardCriteria | ItemCardCriteria | TrainerCardCriteria;

/**
 * Represents a fixed card target (specific location).
 */
export type FixedCardTarget = {
    type: 'fixed';
    player: 'self' | 'opponent';
    location: CardLocation;
};

/**
 * Represents a card target requiring single choice.
 */
export type SingleChoiceCardTarget = {
    type: 'single-choice';
    chooser: 'self' | 'opponent';
    location: CardLocation;
    criteria?: CardCriteria;
};

/**
 * Represents a card target requiring multiple choices.
 */
export type MultiChoiceCardTarget = {
    type: 'multi-choice';
    chooser: 'self' | 'opponent';
    location: CardLocation;
    criteria?: CardCriteria;
    count: number;
};

/**
 * Union type for card targets (cards in hand, deck, discard, or field).
 */
export type CardTarget = FixedCardTarget | SingleChoiceCardTarget | MultiChoiceCardTarget;

/**
 * Represents criteria for targeting energy.
 */
export type EnergyCriteria = {
    /** Specific energy types to target */
    energyTypes?: AttachableEnergyType[];
};

/**
 * Represents an energy target on a field card.
 */
export type FieldEnergyTarget = {
    type: 'field';
    /** The field card to target energy on */
    fieldTarget: FieldTarget;
    /** Criteria for which energy to target */
    criteria?: EnergyCriteria;
    /** Number of energy to target */
    count: number;
};

/**
 * Represents an energy target in discard pile.
 */
export type DiscardEnergyTarget = {
    type: 'discard';
    player: 'self' | 'opponent';
    /** Criteria for which energy to target */
    criteria?: EnergyCriteria;
    /** Number of energy to target */
    count: number;
};

/**
 * Union type for energy targets.
 */
export type EnergyTarget = FieldEnergyTarget | DiscardEnergyTarget;

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
    criteria: TargetCriteria;
};

/**
 * Represents a target that requires multiple choices from available options.
 */
export type MultiChoiceFieldTarget = {
    type: 'multi-choice';
    chooser: 'self' | 'opponent';
    criteria: TargetCriteria;
    count: number;
};

/**
 * Represents a target that matches all creature meeting certain criteria.
 */
export type AllMatchingFieldTarget = {
    type: 'all-matching';
    criteria: TargetCriteria;
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

// Legacy aliases for backward compatibility
export type FixedTarget = FixedFieldTarget;
export type ResolvedTarget = ResolvedFieldTarget;
export type SingleChoiceTarget = SingleChoiceFieldTarget;
export type MultiChoiceTarget = MultiChoiceFieldTarget;
export type AllMatchingTarget = AllMatchingFieldTarget;
export type SingleTarget = SingleFieldTarget;
export type MultiTarget = MultiFieldTarget;
export type Target = FieldTarget;
