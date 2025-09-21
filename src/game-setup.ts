import { GameParams } from './game-params.js';
import { GenericGameSetup, Intermediary } from '@cards-ts/core';
import { CardRepository } from './repository/card-repository.js';

export class GameSetup implements GenericGameSetup<GameParams> {
    constructor(private cardRepository?: CardRepository) {}
    
    getDefaultParams(): GameParams {
        return {
            // Default empty params
            initialDecks: []
        };
    }
    
    async setupForIntermediary(host: Intermediary): Promise<GameParams> {
        // In a real implementation, we would ask the user to select decks or cards
        // For now, we'll just return empty initialDecks
        return {
            initialDecks: []
        };
    }
    
    verifyParams(params: GameParams): { readonly initialDecks?: string; } {
        const errors: { initialDecks?: string | undefined; } = {};
        // No validation needed for now
        return errors;
    }

    getYargs() {
        return {
            // No command line arguments needed for now
        } satisfies {[key: string]: import('yargs').Options};
    }

    setupForYargs(params: Record<string, unknown>): GameParams {
        return {
            initialDecks: []
        };
    }
}
