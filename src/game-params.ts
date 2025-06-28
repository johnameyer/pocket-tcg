import { Serializable } from '@cards-ts/core';

export interface GameParams {
    readonly [key: string]: Serializable;
    
    readonly initialDecks?: string[][];
}
