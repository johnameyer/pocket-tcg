import { AttachableEnergyType } from './repository/energy-types.js';

export type GameParams = {
    readonly initialDecks?: string[][];
    readonly playerEnergyTypes?: AttachableEnergyType[][];
    readonly maxHandSize: number;
    readonly maxTurns: number;
};
