import { Serializable } from '@cards-ts/core';
import { AttachableEnergyType } from './repository/energy-types.js';

export type GameParams = {
    readonly initialDecks?: string[][];
    readonly playerEnergyTypes?: AttachableEnergyType[][];
};
