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
        const defaults = this.getDefaultParams();
        
        const [ _, resultsPromise ] = host.form(
            { type: 'input', message: [ `Maximum hand size? (default ${defaults.maxHandSize})` ] },
            { type: 'input', message: [ `Maximum turns before tie? (default ${defaults.maxTurns})` ] },
        );

        const results = await resultsPromise;

        const maxHandSize = Number(results[0]) || defaults.maxHandSize;
        const maxTurns = Number(results[1]) || defaults.maxTurns;

        return {
            initialDecks: [],
            maxHandSize,
            maxTurns,
        };
    }
    
    verifyParams(params: GameParams): { readonly initialDecks?: string; readonly maxHandSize?: string; readonly maxTurns?: string; } {
        const errors: { initialDecks?: string; maxHandSize?: string; maxTurns?: string; } = {};
        
        try {
            if(!Number(params.maxHandSize) || Number(params.maxHandSize) <= 0) {
                throw new Error();
            }
        } catch (e) {
            errors.maxHandSize = 'Max hand size must be a number greater than 0';
        }
        
        try {
            if(!Number(params.maxTurns) || Number(params.maxTurns) <= 0) {
                throw new Error();
            }
        } catch (e) {
            errors.maxTurns = 'Max turns must be a number greater than 0';
        }
        
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
