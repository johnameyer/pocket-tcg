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
 * Union type for all energy target types.
 * Currently only includes field-based energy targeting.
 */
export type EnergyTarget = FieldEnergyTarget;
