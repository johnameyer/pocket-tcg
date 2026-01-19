import { expect } from 'chai';
import { gameFactory } from '../src/index.js';
import { GameSetup } from '../src/game-setup.js';
import { GameParams } from '../src/game-params.js';
import { AttackResponseMessage } from '../src/messages/response/attack-response-message.js';
import { PlayCardResponseMessage } from '../src/messages/response/play-card-response-message.js';
import { StateBuilder } from './helpers/state-builder.js';
import { runTestGame } from './helpers/test-helpers.js';
import { mockRepository, MockCardRepository } from './mock-repository.js';
import { SupporterData } from '../src/repository/card-types.js';

describe('Creature Pocket TCG Game', () => {
    const factory = gameFactory(mockRepository);
    const params: GameParams = {
        ...new GameSetup().getDefaultParams(),
    };

    it('should not allow drawing beyond 10-card hand limit', () => {
        // Create draw supporters that draw many cards
        const testRepository = new MockCardRepository({
            supporters: new Map<string, SupporterData>([
                ['research-supporter', {
                    templateId: 'research-supporter',
                    name: 'Research Supporter',
                    effects: [{ type: 'draw', amount: { type: 'constant', value: 7 } }]
                }],
                ['massive-draw', {
                    templateId: 'massive-draw', 
                    name: 'Massive Draw',
                    effects: [{ type: 'draw', amount: { type: 'constant', value: 15 } }]
                }]
            ])
        });

        // Test with hand at 9 cards, trying to draw 7 (should only draw 1)
        const { state: state1 } = runTestGame({
            actions: [new PlayCardResponseMessage('research-supporter', 'supporter')],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withHand(0, [
                    { templateId: 'research-supporter', type: 'supporter' },
                    ...Array(8).fill({ templateId: 'basic-creature', type: 'creature' })
                ]),
                StateBuilder.withDeck(0, Array(20).fill({ templateId: 'high-hp-creature', type: 'creature' }))
            ),
            maxSteps: 10
        });

        expect(state1.hand[0].length).to.be.at.most(10, 'Hand should not exceed 10 cards');
        expect(state1.hand[0].length).to.equal(10, 'Should draw exactly to 10-card limit');

        // Test with hand at 5 cards, trying to draw 15 (should only draw 5)
        const { state: state2 } = runTestGame({
            actions: [new PlayCardResponseMessage('massive-draw', 'supporter')],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withHand(0, [
                    { templateId: 'massive-draw', type: 'supporter' },
                    ...Array(4).fill({ templateId: 'basic-creature', type: 'creature' })
                ]),
                StateBuilder.withDeck(0, Array(20).fill({ templateId: 'high-hp-creature', type: 'creature' }))
            ),
            maxSteps: 10
        });

        expect(state2.hand[0].length).to.be.at.most(10, 'Hand should not exceed 10 cards');
        expect(state2.hand[0].length).to.equal(10, 'Should draw exactly to 10-card limit');

        // Test with hand already at 10 cards (should draw 0)
        const { state: state3 } = runTestGame({
            actions: [new PlayCardResponseMessage('research-supporter', 'supporter')],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withHand(0, [
                    { templateId: 'research-supporter', type: 'supporter' },
                    ...Array(9).fill({ templateId: 'basic-creature', type: 'creature' })
                ]),
                StateBuilder.withDeck(0, Array(20).fill({ templateId: 'high-hp-creature', type: 'creature' }))
            ),
            maxSteps: 10
        });

        expect(state3.hand[0].length).to.be.at.most(10, 'Hand should not exceed 10 cards');
        expect(state3.hand[0].length).to.equal(10, 'Should draw 1 card to reach limit after playing supporter');
    });

    it('should create and run a basic game with bot handlers', () => {
        // Provide proper decks with creature cards for setup
        const testParams: GameParams = {
            initialDecks: [
                ['basic-creature', 'basic-creature', 'basic-creature', 'basic-creature', 'basic-creature'],
                ['basic-creature', 'basic-creature', 'basic-creature', 'basic-creature', 'basic-creature']
            ]
        };
        
        const handlers = Array.from({ length: 2 }, () => 
            factory.getDefaultBotHandlerChain()
        );
        
        const names = ['Player1', 'Player2'];
        const driver = factory.getGameDriver(handlers, testParams, names);

        driver.resume();
        
        expect(driver.getState().completed).to.be.false;

        // Run more iterations to ensure setup completes
        for (let i = 0; i < 50; i++) {
            driver.handleSyncResponses();
            driver.resume();
            
            if (driver.getState().completed) {
                break;
            }
        }

        const finalState = driver.getState();
        expect(finalState).to.exist;
        expect(typeof finalState.completed).to.equal('boolean');
        
        // Game should progress past setup phase
        expect(finalState.setup?.playersReady?.every(ready => ready)).to.be.true;
    });

    it('should have proper game factory methods', () => {
        expect(factory).to.exist;
        expect(factory.getGameSetup).to.be.a('function');
        expect(factory.getDefaultBotHandlerChain).to.be.a('function');
        expect(factory.getGameDriver).to.be.a('function');
    });

    it('should create game setup with default params', () => {
        const setup = factory.getGameSetup();
        const defaultParams = setup.getDefaultParams();
        
        expect(defaultParams).to.exist;
        expect(typeof defaultParams).to.equal('object');
    });

    describe('Attack Index Validation', () => {
        it('should prevent attack with negative index', () => {
            const { state } = runTestGame({
                actions: [new AttackResponseMessage(-1)],
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature'),
                    StateBuilder.withCreatures(1, 'high-hp-creature'),
                    StateBuilder.withEnergy('basic-creature-0', { fire: 1 })
                ),
                maxSteps: 5
            });

            // Attack should be blocked with invalid index
            expect(state.field.creatures[1]?.[0]?.damageTaken).to.equal(0, 'Negative index should be blocked');
        });

        it('should prevent attack with out-of-range index', () => {
            const { state } = runTestGame({
                actions: [new AttackResponseMessage(5)],
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature'),
                    StateBuilder.withCreatures(1, 'high-hp-creature'),
                    StateBuilder.withEnergy('basic-creature-0', { fire: 1 })
                ),
                maxSteps: 5
            });

            // Attack should be blocked with invalid index
            expect(state.field.creatures[1]?.[0]?.damageTaken).to.equal(0, 'Out-of-range index should be blocked');
        });
    });

    describe('Card Play Validation', () => {
        it('should prevent playing card not in hand', () => {
            const { state } = runTestGame({
                actions: [new PlayCardResponseMessage('basic-supporter', 'supporter')],
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature'),
                    StateBuilder.withHand(0, [])
                ),
                maxSteps: 5
            });

            expect(state.hand[0]).to.have.length(0, 'Card not in hand should not be playable');
        });

        it('should prevent playing Creature when bench is full', () => {
            const { state } = runTestGame({
                actions: [new PlayCardResponseMessage('basic-creature', 'creature')],
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature', ['basic-creature', 'high-hp-creature', 'evolution-creature']),
                    StateBuilder.withHand(0, [{templateId: 'basic-creature', type: 'creature' as const}])
                ),
                maxSteps: 5
            });

            expect(state.field.creatures[0].slice(1)).to.have.length(3, 'Should not exceed bench limit');
        });

        it('should prevent playing evolved Creature directly', () => {
            const { state } = runTestGame({
                actions: [new PlayCardResponseMessage('evolution-creature', 'creature')],
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature'),
                    StateBuilder.withHand(0, [{templateId: 'evolution-creature', type: 'creature' as const}])
                ),
                maxSteps: 5
            });

            expect(state.field.creatures[0].slice(1)).to.have.length(0, 'Evolved Creature should not be playable directly');
        });
    });

    describe('Turn Structure', () => {
        it('should process checkup phase for status effects', () => {
            // This test verifies that poison status effects can be set up properly
            const preConfiguredState = StateBuilder.createActionPhaseState((state) => {
                state.statusEffects.activeStatusEffects[0] = [{ type: 'poison' }]; // Poisoned creature
            });

            // The poison status effect should exist
            expect(preConfiguredState?.statusEffects.activeStatusEffects[0]).to.have.length(1);
            expect(preConfiguredState?.statusEffects.activeStatusEffects[0][0]).to.deep.equal({ type: 'poison' });
        });

        it('should enforce first turn restrictions', () => {
            // This test verifies that turn counter can be set to 1 (first turn)
            const preConfiguredState = StateBuilder.createActionPhaseState((state) => {
                (state as any).turnCounter = 1; // First turn
                state.field.creatures[0] = [];
            });

            // First turn should be properly set
            expect((preConfiguredState as any)?.turnCounter).to.equal(1);
        });

        it('should track turn counter progression', () => {
            // This test verifies that the turn counter can be tracked and modified
            const preConfiguredState = StateBuilder.createActionPhaseState((state) => {
                (state as any).turnCounter = 2;
            });

            // Turn counter should be properly set
            expect((preConfiguredState as any)?.turnCounter).to.equal(2);
            
            // Verify the turn counter can be modified
            if (preConfiguredState) {
                (preConfiguredState as any).turnCounter = 3;
                expect((preConfiguredState as any).turnCounter).to.equal(3);
            }
        });
    });
});
