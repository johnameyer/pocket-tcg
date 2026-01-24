import { AttachableEnergyType } from './energy-types.js';

/**
 * Represents a componentized condition that can be evaluated to true or false.
 * This allows for more flexible and reusable condition definitions.
 * 
 * @property {Partial<Record<AttachableEnergyType, number>>} [hasEnergy] - Check if FieldCard has specific count of energy
 * @property {boolean} [hasDamage] - Check if FieldCard has damage
 * @property {number} [stage] - Check if FieldCard is specific stage (0=Basic, 1=Stage 1, 2=Stage 2)
 * @property {string} [evolvesFrom] - Check if FieldCard evolves from a specific creature
 * @property {AttachableEnergyType} [isCreatureType] - Check if FieldCard is specific type
 * @property {object} [attributes] - Check if FieldCard has specific attributes
 * @property {boolean} [attributes.ex] - Check if FieldCard is ex
 * @property {boolean} [attributes.mega] - Check if FieldCard is mega
 * @property {boolean} [attributes.ultraBeast] - Check if FieldCard is ultra beast
 * 
 * @example { hasEnergy: { fire: 4 } } // FieldCard has at least 4 fire energy
 * @example { hasEnergy: { water: 1 } } // FieldCard has at least 1 water energy
 * @example { hasDamage: true } // FieldCard has damage
 * @example { attributes: { ex: true }, hasDamage: true } // FieldCard is ex and has damage
 * @example { attributes: { mega: true } } // FieldCard is mega
 * @example { attributes: { ex: true, mega: true } } // FieldCard is mega ex
 * @example { isCreatureType: 'water', isActive: true } // FieldCard is a water type in the active spot
 * @example { stage: 2 } // FieldCard is a Stage 2 FieldCard
 */
export type Condition = {
    hasEnergy?: Partial<Record<AttachableEnergyType, number>>;
    hasDamage?: boolean;
    stage?: 0 | 1 | 2;
    evolvesFrom?: string;
    isType?: AttachableEnergyType;
    attributes?: {
        ex?: boolean;
        mega?: boolean;
        ultraBeast?: boolean;
    };
};
