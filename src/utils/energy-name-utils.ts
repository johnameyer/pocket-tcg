import { EnergyRequirementType } from '../repository/energy-types.js';

/**
 * Maps energy types to their display names
 */
const ENERGY_NAMES: Record<EnergyRequirementType, string> = {
    fire: 'Fire',
    water: 'Water',
    grass: 'Grass',
    lightning: 'Lightning',
    psychic: 'Psychic',
    fighting: 'Fighting',
    darkness: 'Darkness',
    metal: 'Metal',
    colorless: 'Colorless',
};

/**
 * Get the display name for an energy type
 * @param energyType The energy type
 * @returns The display name for the energy type
 */
export function getEnergyName(energyType: EnergyRequirementType): string {
    return ENERGY_NAMES[energyType] || energyType;
}
