import { AttachableEnergyType, EnergyDictionary } from '../controllers/energy-controller.js';

/**
 * Create an empty energy dictionary with all energy types set to 0
 */
export function emptyEnergyDict(): EnergyDictionary {
    return {
        grass: 0, 
        fire: 0, 
        water: 0, 
        lightning: 0,
        psychic: 0, 
        fighting: 0, 
        darkness: 0, 
        metal: 0
    };
}
