import { AttachableEnergyType } from '../repository/energy-types.js';
import { Effect } from '../repository/effect-types.js';
import { EffectContext } from './effect-context.js';

/**
 * Represents the different types of selections that can be pending.
 */
export type SelectionType = 
    | 'field' // Select one or more cards on the field
    | 'energy' // Select energy to discard/move
    | 'card' // Select cards from a location (hand, deck, discard)
    | 'choice'; // Select from a list of named choices

/**
 * Base type for all pending selections.
 */
export type BasePendingSelection = {
    /** The type of selection required */
    selectionType: SelectionType;
    /** The effect that requires this selection */
    effect: Effect;
    /** The original context in which the effect was triggered */
    originalContext: EffectContext;
    /** A human-readable prompt for the selection */
    prompt?: string;
};

/**
 * Pending selection for target(s) on the field.
 */
export type PendingFieldSelection = BasePendingSelection & {
    selectionType: 'field';
    /** Number of targets to select */
    count: number;
    /** Minimum number of targets (defaults to count) */
    minTargets?: number;
    /** Maximum number of targets (defaults to count) */
    maxTargets?: number;
};

/**
 * Pending selection for energy to discard or move.
 */
export type PendingEnergySelection = BasePendingSelection & {
    selectionType: 'energy';
    /** The player who owns the energy */
    playerId: number;
    /** The field position of the card with energy */
    fieldPosition: number;
    /** Number of energy to select */
    count: number;
    /** Minimum number of energy (defaults to count) */
    minCount?: number;
    /** Maximum number of energy (defaults to count) */
    maxCount?: number;
    /** Optional: restrict to specific energy types */
    allowedTypes?: AttachableEnergyType[];
};

/**
 * Pending selection for cards from a specific location.
 */
export type PendingCardSelection = BasePendingSelection & {
    selectionType: 'card';
    /** The player whose cards to select from */
    playerId: number;
    /** Location of the cards to select from */
    location: 'hand' | 'deck' | 'discard';
    /** Number of cards to select */
    count: number;
    /** Minimum number of cards (defaults to count) */
    minCount?: number;
    /** Maximum number of cards (defaults to count) */
    maxCount?: number;
    /** Optional: filter by card type */
    cardType?: 'creature' | 'item' | 'supporter' | 'tool';
};

/**
 * Pending selection from a list of named choices.
 */
export type PendingChoiceSelection = BasePendingSelection & {
    selectionType: 'choice';
    /** The available choices */
    choices: Array<{ name: string; value: string }>;
    /** Number of choices to select */
    count: number;
    /** Minimum number of choices (defaults to count) */
    minCount?: number;
    /** Maximum number of choices (defaults to count) */
    maxCount?: number;
};

/**
 * Union type representing all possible pending selections.
 */
export type PendingSelection = 
    | PendingFieldSelection
    | PendingEnergySelection
    | PendingCardSelection
    | PendingChoiceSelection;

/**
 * Type guard functions for pending selection types
 */
export function isPendingFieldSelection(selection: PendingSelection): selection is PendingFieldSelection {
    return selection.selectionType === 'field';
}

export function isPendingEnergySelection(selection: PendingSelection): selection is PendingEnergySelection {
    return selection.selectionType === 'energy';
}

export function isPendingCardSelection(selection: PendingSelection): selection is PendingCardSelection {
    return selection.selectionType === 'card';
}

export function isPendingChoiceSelection(selection: PendingSelection): selection is PendingChoiceSelection {
    return selection.selectionType === 'choice';
}
