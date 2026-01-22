import { Message } from '@cards-ts/core';
import { AttachableEnergyType } from '../repository/energy-types.js';
import { Effect } from '../repository/effect-types.js';
import { EffectContext } from './effect-context.js';

/**
 * Represents the different types of selections that can be pending.
 */
export type SelectionType = 
    | 'target'           // Select one or more cards on the field
    | 'energy'           // Select energy to discard/move
    | 'card-in-hand'     // Select a card from hand
    | 'choice'           // Select from a list of named choices
    | 'multi-target';    // Select multiple cards on the field

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
export type PendingTargetSelection = BasePendingSelection & {
    selectionType: 'target';
    /** Whether multiple targets can be selected */
    allowMultiple?: boolean;
    /** Minimum number of targets to select (default 1) */
    minTargets?: number;
    /** Maximum number of targets to select (default 1) */
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
    /** Optional: restrict to specific energy types */
    allowedTypes?: AttachableEnergyType[];
};

/**
 * Pending selection for a card from hand.
 */
export type PendingCardInHandSelection = BasePendingSelection & {
    selectionType: 'card-in-hand';
    /** The player whose hand to select from */
    playerId: number;
    /** Number of cards to select */
    count: number;
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
    /** Whether multiple choices can be selected */
    allowMultiple?: boolean;
};

/**
 * Pending selection for multiple targets on the field.
 */
export type PendingMultiTargetSelection = BasePendingSelection & {
    selectionType: 'multi-target';
    /** Number of targets to select */
    count: number;
    /** Minimum number of targets (default equals count) */
    minTargets?: number;
};

/**
 * Union type representing all possible pending selections.
 */
export type PendingSelection = 
    | PendingTargetSelection
    | PendingEnergySelection
    | PendingCardInHandSelection
    | PendingChoiceSelection
    | PendingMultiTargetSelection;

/**
 * Type guard functions for pending selection types
 */
export function isPendingTargetSelection(selection: PendingSelection): selection is PendingTargetSelection {
    return selection.selectionType === 'target';
}

export function isPendingEnergySelection(selection: PendingSelection): selection is PendingEnergySelection {
    return selection.selectionType === 'energy';
}

export function isPendingCardInHandSelection(selection: PendingSelection): selection is PendingCardInHandSelection {
    return selection.selectionType === 'card-in-hand';
}

export function isPendingChoiceSelection(selection: PendingSelection): selection is PendingChoiceSelection {
    return selection.selectionType === 'choice';
}

export function isPendingMultiTargetSelection(selection: PendingSelection): selection is PendingMultiTargetSelection {
    return selection.selectionType === 'multi-target';
}
