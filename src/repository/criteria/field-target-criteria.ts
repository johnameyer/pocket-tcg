import { AttachableEnergyType } from '../energy-types.js';
import { CreatureCardCriteria } from './card-criteria.js';

/**
 * Criteria specific to field cards (creatures on field).
 * Composes CreatureCardCriteria for card-level properties with field-specific state properties.
 * 
 * @example { cardCriteria: { stage: 0 }, hasDamage: true } // Basic creatures with damage
 * @example { cardCriteria: { isType: 'water' }, hasEnergy: { water: 2 } } // Water types with 2+ water energy
 * @example { hasDamage: true } // Any creature with damage
 */
export type FieldCriteria = {
    cardCriteria?: CreatureCardCriteria;
    hasDamage?: boolean;
    hasEnergy?: Partial<Record<AttachableEnergyType, number>>;
};

/**
 * Represents criteria for targeting specific field cards or creatures.
 * Combines field location/position with creature criteria for flexible targeting.
 * 
 * @example { player: 'opponent', location: 'field', position: 'active' } // Opponent's active creature
 * @example { player: 'self', location: 'field', fieldCriteria: { hasDamage: true } } // Own damaged creatures
 * @example { location: 'field', fieldCriteria: { cardCriteria: { stage: 0 } } } // Any basic creatures on field
 */
export type FieldTargetCriteria = {
    player?: 'self' | 'opponent';
    position?: 'active' | 'bench';
    location?: 'field' | 'hand' | 'deck';
    fieldCriteria?: FieldCriteria;
};

