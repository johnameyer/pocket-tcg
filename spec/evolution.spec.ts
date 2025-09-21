import { expect } from 'chai';
import { EvolveResponseMessage } from '../src/messages/response/evolve-response-message.js';
import { RetreatResponseMessage } from '../src/messages/response/retreat-response-message.js';
import { StateBuilder } from './helpers/state-builder.js';
import { runTestGame } from './helpers/test-helpers.js';

describe('Evolution Mechanics', () => {
    it('should evolve basic creature to evolution', () => {
        const { getExecutedCount } = runTestGame({
            actions: [new EvolveResponseMessage('evolution-creature', 0)],
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withcreature(0, 'basic-creature'),
                StateBuilder.withHand(0, [{templateId: 'evolution-creature', type: 'creature'}]), // Need evolution card in hand
                StateBuilder.withDamage('basic-creature-0', 20),
                StateBuilder.withCanEvolve(0, 0)
            )
        });

        expect(getExecutedCount()).to.equal(1, 'Should have executed evolution action');
    });

    it('should prevent evolution on first turn', () => {
        const { state } = runTestGame({
            actions: [new EvolveResponseMessage('evolution-creature', 0)],
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withcreature(0, 'basic-creature'),
                (state) => state.turn = 1
            )
        });

        expect(state.field.creatures[0][0].templateId).to.equal('basic-creature', 'Evolution should be prevented on first turn');
    });

    it('should prevent same creature instance from evolving twice per turn even with retreats', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [
                new EvolveResponseMessage('evolution-creature', 0), // Evolve active creature
                new RetreatResponseMessage(0), // Retreat to bench (now at bench position 0)
                new EvolveResponseMessage('evolution-creature', 0+1) // Try to evolve the same creature again (now on bench)
            ],
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withcreature(0, 'basic-creature', ['high-hp-creature']),
                StateBuilder.withHand(0, [
                    {templateId: 'evolution-creature', type: 'creature'},
                    {templateId: 'evolution-creature', type: 'creature'}
                ]),
                StateBuilder.withCanEvolve(0, 0),
                StateBuilder.withEnergy('basic-creature-0', { fire: 3 }),
                (state) => {
                    const creatureData = state.field.creatures[0][0];
                    if (creatureData) {
                        creatureData.turnPlayed = 0; // Ensure it can evolve
                    }
                }
            ),
            maxSteps: 15
        });

        // Verify that the creature evolved once but not twice
        expect(state.field.creatures[0].slice(1)[0].templateId).to.equal('evolution-creature', 'Creature should have evolved once');
        expect(state.hand[0].length).to.equal(1, 'Second evolution card should remain in hand (blocked)');
    });

    describe('Evolution and Status Effects', () => {
        it('should preserve damage when evolving', () => {
            const { state } = runTestGame({
                actions: [
                    new EvolveResponseMessage('evolution-creature', 0)
                ],
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withcreature(0, 'basic-creature'),
                    StateBuilder.withHand(0, [{templateId: 'evolution-creature', type: 'creature'}]),
                    StateBuilder.withCanEvolve(0, 0),
                    (state) => {
                        const creatureData = state.field.creatures[0][0];
                        if (creatureData) {
                            creatureData.turnPlayed = 0;
                            creatureData.damageTaken = 60; // Add damage to preserve
                        }
                    }
                ),
                maxSteps: 10
            });

            expect(state.field.creatures[0][0].damageTaken).to.equal(60, 'Damage should be preserved during evolution');
            expect(state.field.creatures[0][0].templateId).to.equal('evolution-creature', 'Creature should be evolved');
        });

        it('should handle benched creature promotion', () => {
            const { state } = runTestGame({
                actions: [],
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withcreature(0, 'high-hp-creature', ['basic-creature']),
                    StateBuilder.withDamage('high-hp-creature-0', 90)
                ),
                maxSteps: 5
            });

            expect(state.field.creatures[0][0]).to.exist;
        });
    });
});
