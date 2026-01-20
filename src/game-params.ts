import { Serializable } from '@cards-ts/core';

export type GameParams = {
    readonly initialDecks?: string[][];
    readonly maxHandSize: number;
    readonly maxTurns: number;
};
