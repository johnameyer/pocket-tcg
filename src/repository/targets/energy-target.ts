import { AttachableEnergyType } from '../energy-types.js';
import { FieldTarget } from './field-target.js';

/**
 * Represents criteria for targeting energy.
 */
export type EnergyCriteria = {
    /** Specific energy types to target */
    energyTypes?: AttachableEnergyType[];
};

/**
 * Represents an energy target on a field card only.
 * For targeting energy, this combines a field target (which creature) with energy criteria (which types) and count.
 * 
 * Will randomly select if not fully defined.
 */
export type FieldEnergyTarget<TContextualRefs extends string = string> = {
    type: 'field';
    /** The field card to target energy on */
    fieldTarget: FieldTarget<TContextualRefs>;
    /** Criteria for which energy to target */
    criteria?: EnergyCriteria;
    /** Number of energy to target */
    count: number;
    /**
     * If true, select energy randomly from the pool rather than deterministically.
     * For all-matching field targets, picks randomly across all creatures' energy.
     */
    random?: boolean;
};

/**
 * Represents an energy target sourced from a player's discard pile (no field creature involved).
 * If the matching energy in the discard pile spans more than one type, the resolver will
 * prompt the player to choose which type to take (see EnergyTargetResolver).
 */
export type DiscardEnergyTarget = {
    type: 'discard';
    /** Criteria for which energy types to target; omit for any type */
    criteria?: EnergyCriteria;
    /** Number of energy to target */
    count: number;
};

/**
 * Union type for all energy target types: field-based (energy already attached to a creature)
 * or discard-based (energy sitting in the player's discard pile).
 */
export type EnergyTarget<TContextualRefs extends string = string> = FieldEnergyTarget<TContextualRefs> | DiscardEnergyTarget;
