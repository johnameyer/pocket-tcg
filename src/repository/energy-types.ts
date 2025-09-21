/**
 * Represents the different types of energy that can be attached to creature.
 */
export type AttachableEnergyType = 'fire' | 'water' | 'grass' | 'lightning' | 'psychic' | 'fighting' | 'darkness' | 'metal';

/**
 * Represents energy requirement types (includes colorless for costs)
 */
export type EnergyRequirementType = AttachableEnergyType | 'colorless';

