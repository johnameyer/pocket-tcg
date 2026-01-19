import { expect } from 'chai';
import { StateBuilder } from './helpers/state-builder.js';
import { runTestGame } from './helpers/test-helpers.js';
import { EndTurnResponseMessage } from '../src/messages/response/end-turn-response-message.js';
import { PlayCardResponseMessage } from '../src/messages/response/play-card-response-message.js';
import { GameSetup } from '../src/game-setup.js';
import { gameFactory } from '../src/game-factory.js';
import { mockRepository } from './mock-repository.js';
import { buildProviders } from '../src/controllers/controllers.js';
import { GameParams } from '../src/game-params.js';
import { ParamsController } from '@cards-ts/core';

// Helper to create a mock params controller
function createMockParamsController(params: GameParams): ParamsController<GameParams> {
    return {
        get: () => params
    } as ParamsController<GameParams>;
}

describe('Game Limits', () => {
    describe('Hand Size Limit', () => {
        it('should enforce maximum hand size of 10 cards by default', () => {
            // Create a controller-level test for direct verification
            const providers = buildProviders(mockRepository);
            const handController = providers.hand.controller([], { 
                deck: providers.deck.controller([], {}),
                params: createMockParamsController({ maxHandSize: 10, maxTurns: 30, initialDecks: [] })
            });
            
            // Initialize the hand controller with test data
            handController.initialize(2);
            
            // Manually set hand to 10 cards
            for (let i = 0; i < 10; i++) {
                handController.getHand(0).push({
                    instanceId: `card-${i}`,
                    type: 'creature',
                    templateId: 'basic-creature'
                });
            }
            
            // Initialize deck with cards
            const deckController = providers.deck.controller([], {});
            deckController.initialize(2, [[{ instanceId: 'new-card', type: 'creature', templateId: 'basic-creature' }], []]);
            
            // Try to draw a card when at max hand size
            const drawnCard = handController.drawCard(0);
            
            // Should not draw a card when at max hand size
            expect(drawnCard).to.be.undefined;
            expect(handController.getHandSize(0)).to.equal(10);
        });

        it('should allow drawing when hand is below max size', () => {
            // Create a controller-level test for direct verification
            const providers = buildProviders(mockRepository);
            
            // Create deck first with cards
            const deckState: any = [
                [{ instanceId: 'new-card', type: 'creature', templateId: 'basic-creature' }],
                []
            ];
            const deckController = providers.deck.controller(deckState, {});
            deckController.initialize(2, deckState);
            
            const handController = providers.hand.controller([], { 
                deck: deckController,
                params: createMockParamsController({ maxHandSize: 10, maxTurns: 30, initialDecks: [] })
            });
            
            // Initialize the hand controller with test data
            handController.initialize(2);
            
            // Set hand to 9 cards (below max)
            for (let i = 0; i < 9; i++) {
                handController.getHand(0).push({
                    instanceId: `card-${i}`,
                    type: 'creature',
                    templateId: 'basic-creature'
                });
            }
            
            // Try to draw a card when below max hand size
            const drawnCard = handController.drawCard(0);
            
            // Should draw a card when below max hand size
            expect(drawnCard).to.not.be.undefined;
            expect(handController.getHandSize(0)).to.equal(10);
        });

        it('should respect custom max hand size parameter', () => {
            // Create a controller-level test for direct verification
            const providers = buildProviders(mockRepository);
            
            // Create deck first with cards
            const deckState: any = [
                [{ instanceId: 'new-card', type: 'creature', templateId: 'basic-creature' }],
                []
            ];
            const deckController = providers.deck.controller(deckState, {});
            deckController.initialize(2, deckState);
            
            const handController = providers.hand.controller([], { 
                deck: deckController,
                params: createMockParamsController({ maxHandSize: 5, maxTurns: 30, initialDecks: [] })
            });
            
            // Initialize the hand controller
            handController.initialize(2);
            
            // Set hand to 5 cards (at custom max)
            for (let i = 0; i < 5; i++) {
                handController.getHand(0).push({
                    instanceId: `card-${i}`,
                    type: 'creature',
                    templateId: 'basic-creature'
                });
            }
            
            // Try to draw a card when at custom max hand size
            const drawnCard = handController.drawCard(0);
            
            // Should not draw a card when at custom max hand size
            expect(drawnCard).to.be.undefined;
            expect(handController.getHandSize(0)).to.equal(5);
        });
    });

    describe('Turn Limit', () => {
        it('should detect when max turns reached', () => {
            // Create a controller-level test for direct verification
            const providers = buildProviders(mockRepository);
            const turnCounterController = providers.turnCounter.controller(
                { turnNumber: 30 },
                {
                    params: createMockParamsController({ maxHandSize: 10, maxTurns: 30, initialDecks: [] })
                }
            );
            
            // Check if max turns is reached
            expect(turnCounterController.isMaxTurnsReached()).to.be.true;
        });

        it('should detect when turns are below limit', () => {
            // Create a controller-level test for direct verification
            const providers = buildProviders(mockRepository);
            const turnCounterController = providers.turnCounter.controller(
                { turnNumber: 15 },
                {
                    params: createMockParamsController({ maxHandSize: 10, maxTurns: 30, initialDecks: [] })
                }
            );
            
            // Check if max turns is not reached
            expect(turnCounterController.isMaxTurnsReached()).to.be.false;
        });

        it('should respect custom max turn parameter', () => {
            // Create a controller-level test for direct verification
            const providers = buildProviders(mockRepository);
            const turnCounterController = providers.turnCounter.controller(
                { turnNumber: 10 },
                {
                    params: createMockParamsController({ maxHandSize: 10, maxTurns: 10, initialDecks: [] })
                }
            );
            
            // Check if custom max turns is reached
            expect(turnCounterController.isMaxTurnsReached()).to.be.true;
        });

        it('should end game in tie when max turns reached', () => {
            const params = {
                ...new GameSetup().getDefaultParams(),
                maxTurns: 2, // Set very low turn limit for testing
                initialDecks: []
            };
            
            const handlers = Array.from({ length: 2 }, () => 
                gameFactory(mockRepository).getDefaultBotHandlerChain()
            );
            
            const preConfiguredState = StateBuilder.createActionPhaseState(
                StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature'),
                    StateBuilder.withCreatures(1, 'basic-creature'),
                    (state) => {
                        // Start at turn 1 (next turn will be 2, triggering the limit)
                        state.turnCounter.turnNumber = 1;
                    }
                )
            );
            
            const driver = gameFactory(mockRepository).getGameDriver(handlers, params, ['TestPlayer', 'OpponentPlayer'], preConfiguredState as any);
            
            // Run the game for enough steps to trigger turn limit
            driver.resume();
            for (let step = 0; step < 20 && !driver.getState().completed; step++) {
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
            
            // Game should be completed due to turn limit
            expect(state.completed).to.equal(true, 'Game should be completed when turn limit reached');
            expect(state.turnCounter.turnNumber).to.be.gte(2, 'Turn counter should have reached or exceeded the limit');
        });
    });
});
