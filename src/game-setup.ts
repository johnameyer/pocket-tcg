import { GameParams } from './game-params.js';
import { GenericGameSetup, Intermediary } from '@cards-ts/core';
import { CardRepository } from './repository/card-repository.js';

export class GameSetup implements GenericGameSetup<GameParams> {
    constructor(private cardRepository?: CardRepository) {}
    
    getDefaultParams(): GameParams {
        return {
            initialDecks: [],
            maxHandSize: 10,
            maxTurns: 30
        };
    }
    
    async setupForIntermediary(host: Intermediary): Promise<GameParams> {
        // In a real implementation, we would ask the user to select decks or cards
        // For now, we'll just return the default params
        return this.getDefaultParams();
    }
    
    verifyParams(params: GameParams): { readonly initialDecks?: string; } {
        const errors: { initialDecks?: string | undefined; } = {};
        // No validation needed for now
        return errors;
    }

    getYargs() {
        return {
            maxHandSize: {
                type: 'number',
                description: 'Maximum hand size (default: 10)',
                default: 10
            },
            maxTurns: {
                type: 'number',
                description: 'Maximum turns before tie (default: 30)',
                default: 30
            }
        } satisfies {[key: string]: import('yargs').Options};
    }

    setupForYargs(params: Record<string, unknown>): GameParams {
        const defaults = this.getDefaultParams();
        return {
            initialDecks: [],
            maxHandSize: typeof params.maxHandSize === 'number' ? params.maxHandSize : defaults.maxHandSize,
            maxTurns: typeof params.maxTurns === 'number' ? params.maxTurns : defaults.maxTurns
        };
    }
}
