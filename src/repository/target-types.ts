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
 * Represents card type filters for card targeting.
 */
export type CardTypeFilter = 'creature' | 'basic-creature' | 'evolution-creature' | 'trainer' | 'item' | 'supporter' | 'tool' | 'energy';

/**
 * Represents criteria for targeting cards in hand, deck, or discard.
 * Used to filter which cards can be selected.
 */
export type CardCriteria = {
    /** Card type filter */
    cardType?: CardTypeFilter;
    /** Specific card names (exact match) */
    names?: string[];
    /** Evolution stage (0=Basic, 1=Stage 1, 2=Stage 2) */
    stage?: 0 | 1 | 2;
    /** Energy type filter for creatures */
    energyType?: AttachableEnergyType;
    /** HP greater than this value */
    hpGreaterThan?: number;
    /** HP less than this value */
    hpLessThan?: number;
    /** Creature-specific condition (only applicable if cardType filters to creatures) */
    condition?: Condition;
};

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
    /** Whether to select random energy if not specified */
    random?: boolean;
};

/**
 * Represents an energy target on a field card.
 */
export type FieldEnergyTarget = {
    type: 'field';
    /** The field card to target energy on */
    fieldTarget: Target;
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
