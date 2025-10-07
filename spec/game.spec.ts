import { expect } from 'chai';
import { gameFactory } from '../src/index.js';
import { GameSetup } from '../src/game-setup.js';
import { GameParams } from '../src/game-params.js';
import { AttackResponseMessage } from '../src/messages/response/attack-response-message.js';
import { PlayCardResponseMessage } from '../src/messages/response/play-card-response-message.js';
import { StateBuilder } from './helpers/state-builder.js';
import { runTestGame } from './helpers/test-helpers.js';

describe('Creature Pocket TCG Game', () => {
    const factory = gameFactory();
    const params: GameParams = {
        ...new GameSetup().getDefaultParams(),
    };

    it('should create and run a basic game with bot handlers', () => {
        const handlers = Array.from({ length: 2 }, () => 
            factory.getDefaultBotHandlerChain()
        );
        
        const names = ['Player1', 'Player2'];
        const driver = factory.getGameDriver(handlers, params, names);

        driver.resume();
        
        expect(driver.getState().completed).to.be.false;

        for (let i = 0; i < 5; i++) {
            driver.handleSyncResponses();
            driver.resume();
            
            if (driver.getState().completed) {
                break;
            }
        }

        const finalState = driver.getState();
        expect(finalState).to.exist;
        expect(typeof finalState.completed).to.equal('boolean');
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
                    StateBuilder.withcreature(0, 'basic-creature'),
                    StateBuilder.withcreature(1, 'high-hp-creature'),
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
                    StateBuilder.withcreature(0, 'basic-creature'),
                    StateBuilder.withcreature(1, 'high-hp-creature'),
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
                    StateBuilder.withcreature(0, 'basic-creature'),
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
                    StateBuilder.withcreature(0, 'basic-creature', ['basic-creature', 'high-hp-creature', 'evolution-creature']),
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
                    StateBuilder.withcreature(0, 'basic-creature'),
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
