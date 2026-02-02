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
 * Represents an energy target on a field card.
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
