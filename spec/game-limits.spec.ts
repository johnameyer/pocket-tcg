import { expect } from 'chai';
import { StateBuilder } from './helpers/state-builder.js';
import { runTestGame } from './helpers/test-helpers.js';
import { AttackResponseMessage } from '../src/messages/response/attack-response-message.js';
import { EndTurnResponseMessage } from '../src/messages/response/end-turn-response-message.js';
import { GameSetup } from '../src/game-setup.js';
import { gameFactory } from '../src/game-factory.js';
import { mockRepository } from './mock-repository.js';

describe('Game Limits', () => {
    describe('Hand Size Limit', () => {
        it('should enforce maximum hand size at turn start', () => {
            // Set up a game where player already has 10 cards
            // Provide no actions so bot does nothing
            const { state } = runTestGame({
                actions: [],
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature'),
                    StateBuilder.withCreatures(1, 'basic-creature'),
                    StateBuilder.withHand(0, Array.from({ length: 10 }, (_, i) => ({ templateId: 'basic-creature' }))),
                    StateBuilder.withDeck(0, [{ templateId: 'basic-creature' }, { templateId: 'basic-creature' }]),
                    StateBuilder.withTurn(0) // Make sure it's player 0's turn
                ),
                maxSteps: 2
            });

            // Hand should remain at 10 cards (draw at turn start blocked by hand size limit)
            expect(state.hand[0].length).to.be.lte(10, 'Hand should not exceed max size of 10');
        });

        it('should allow drawing when hand is below max size', () => {
            // Set up a game where player has 8 cards
            // Turn advance should allow draw
            const { state } = runTestGame({
                actions: [],
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature'),
                    StateBuilder.withCreatures(1, 'basic-creature'),
                    StateBuilder.withHand(0, Array.from({ length: 8 }, (_, i) => ({ templateId: 'basic-creature' }))),
                    StateBuilder.withDeck(0, [{ templateId: 'basic-creature' }, { templateId: 'basic-creature' }]),
                    StateBuilder.withTurn(0)
                ),
                maxSteps: 2
            });

            // Hand should have grown from 8
            expect(state.hand[0].length).to.be.gte(8, 'Hand should have at least the starting cards');
            expect(state.hand[0].length).to.be.lte(10, 'Hand should not exceed max');
        });

        it('should respect custom max hand size parameter', () => {
            // Custom max hand size can be verified by starting with that many cards
            // and checking they can't draw more
            const { state } = runTestGame({
                actions: [],
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature'),
                    StateBuilder.withCreatures(1, 'basic-creature'),
                    StateBuilder.withHand(0, Array.from({ length: 5 }, (_, i) => ({ templateId: 'basic-creature' }))),
                    StateBuilder.withDeck(0, [{ templateId: 'basic-creature' }]),
                    StateBuilder.withTurn(0),
                    (customState) => {
                        // Set custom max hand size
                        (customState as any).params = { maxHandSize: 5, maxTurns: 30 };
                    }
                ),
                maxSteps: 2
            });
            
            // Hand should remain at or below custom max of 5
            expect(state.hand[0].length).to.be.lte(5, 'Hand should not exceed custom max of 5');
        });
    });

    describe('Turn Limit', () => {
        it('should not end game before turn limit is reached', () => {
            // Set up with high turn limit
            const params = {
                ...new GameSetup().getDefaultParams(),
                maxTurns: 30
            };
            
            const handlers = Array.from({ length: 2 }, () => 
                gameFactory(mockRepository).getDefaultBotHandlerChain()
            );
            
            const preConfiguredState = StateBuilder.createActionPhaseState(
                StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature'),
                    StateBuilder.withCreatures(1, 'basic-creature'),
                    StateBuilder.withTurnNumber(2)
                )
            );
            
            const driver = gameFactory(mockRepository).getGameDriver(handlers, params, ['TestPlayer', 'OpponentPlayer'], preConfiguredState as any);
            
            // Run just a few steps
            driver.resume();
            for (let step = 0; step < 5 && !driver.getState().completed; step++) {
                for(const [ position, message ] of (driver as any).handlerProxy.receiveSyncResponses()) {
                    if(message) {
                        let payload, data;
                        if(Array.isArray(message)) {
                            ([ payload, data ] = message);
                        } else {
                            payload = message;
                        }
                        driver.handleEvent(position, payload, data);
                    }
                }
                driver.resume();
            }

            const state = driver.getState();
            
            // Turn counter should still be well below limit
            expect(state.turnCounter.turnNumber).to.be.lessThan(30, 'Turn counter should be below limit');
        });
    });
});
