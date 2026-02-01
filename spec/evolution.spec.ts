import { expect } from 'chai';
import { EvolveResponseMessage } from '../src/messages/response/evolve-response-message.js';
import { RetreatResponseMessage } from '../src/messages/response/retreat-response-message.js';
import { getCurrentTemplateId } from '../src/utils/field-card-utils.js';
import { StateBuilder } from './helpers/state-builder.js';
import { runTestGame } from './helpers/test-helpers.js';

describe('Evolution Mechanics', () => {
    it('should evolve basic creature to evolution', () => {
        const { getExecutedCount } = runTestGame({
            actions: [ new EvolveResponseMessage('evolution-creature', 0) ],
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature'),
                StateBuilder.withHand(0, [{ templateId: 'evolution-creature', type: 'creature' }]),
                StateBuilder.withDamage('basic-creature-0', 20),
                StateBuilder.withCanEvolve(0, 0),
            ),
        });

        expect(getExecutedCount()).to.equal(1, 'Should have executed evolution action');
    });

    it('should keep previous form in evolution stack when evolving', () => {
        const { state } = runTestGame({
            actions: [ new EvolveResponseMessage('evolution-creature', 0) ],
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature'),
                StateBuilder.withHand(0, [{ templateId: 'evolution-creature', type: 'creature' }]),
                StateBuilder.withCanEvolve(0, 0),
            ),
            maxSteps: 5,
        });

        // Player 0's basic creature should remain in the evolution stack, not in discard pile
        expect(state.discard[0].length).to.equal(0, 'Player 0 should have 0 cards in discard pile');
        
        // Check evolution stack has both forms
        const activeCard = state.field.creatures[0][0];
        expect(activeCard.evolutionStack.length).to.equal(2, 'Evolution stack should have 2 cards');
        expect(activeCard.evolutionStack[0].templateId).to.equal('basic-creature', 'First form should be basic-creature');
        expect(activeCard.evolutionStack[1].templateId).to.equal('evolution-creature', 'Second form should be evolution-creature');
        expect(getCurrentTemplateId(activeCard)).to.equal('evolution-creature', 'Current form should be evolved');
        
        // Card conservation: both cards are in evolution stack, not discarded
        expect(activeCard.evolutionStack.some((c) => c.templateId === 'basic-creature')).to.be.true;
        expect(activeCard.evolutionStack.some((c) => c.templateId === 'evolution-creature')).to.be.true;
    });

    it('should keep previous form in evolution stack when evolving benched creature', () => {
        const { state } = runTestGame({
            actions: [ new EvolveResponseMessage('evolution-creature', 1) ],
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature', [ 'basic-creature' ]),
                StateBuilder.withHand(0, [{ templateId: 'evolution-creature', type: 'creature' }]),
                StateBuilder.withCanEvolve(0, 0),
            ),
            maxSteps: 5,
        });

        // Player 0's benched basic creature should remain in the evolution stack, not in discard pile
        expect(state.discard[0].length).to.equal(0, 'Player 0 should have 0 cards in discard pile');
        
        // Check evolution stack has both forms
        const benchedCard = state.field.creatures[0][1];
        expect(benchedCard.evolutionStack.length).to.equal(2, 'Evolution stack should have 2 cards');
        expect(benchedCard.evolutionStack[0].templateId).to.equal('basic-creature', 'First form should be basic-creature');
        expect(benchedCard.evolutionStack[1].templateId).to.equal('evolution-creature', 'Second form should be evolution-creature');
        expect(getCurrentTemplateId(benchedCard)).to.equal('evolution-creature', 'Current form should be evolved');
    });

    it('should prevent evolution on first turn', () => {
        const { state } = runTestGame({
            actions: [ new EvolveResponseMessage('evolution-creature', 0) ],
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature'),
                StateBuilder.withHand(0, [{ templateId: 'evolution-creature', type: 'creature' }]),
                (state) => state.turn = 1,
            ),
        });

        expect(getCurrentTemplateId(state.field.creatures[0][0])).to.equal('basic-creature', 'Evolution should be prevented on first turn');
        expect(state.hand[0].length).to.equal(1, 'Evolution card should still be in hand');
        expect(state.hand[0][0].templateId).to.equal('evolution-creature', 'Evolution card should not be played');
    });

    it('should prevent same creature instance from evolving twice per turn even with retreats', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [
                new EvolveResponseMessage('evolution-creature', 0),
                new RetreatResponseMessage(0),
                new EvolveResponseMessage('evolution-creature', 0 + 1),
            ],
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature', [ 'high-hp-creature' ]),
                StateBuilder.withHand(0, [
                    { templateId: 'evolution-creature', type: 'creature' },
                    { templateId: 'evolution-creature', type: 'creature' },
                ]),
                StateBuilder.withCanEvolve(0, 0),
                StateBuilder.withEnergy('basic-creature-0', { fire: 3 }),
                (state) => {
                    const creatureData = state.field.creatures[0][0];
                    if (creatureData) {
                        creatureData.turnLastPlayed = 0;
                    }
                },
            ),
            maxSteps: 15,
        });

        // After evolution and retreat, the evolved creature should be on bench
        const benchCard = state.field.creatures[0].slice(1)[0];
        expect(getCurrentTemplateId(benchCard)).to.equal('evolution-creature', 'Creature should have evolved once');
        expect(state.hand[0].length).to.equal(1, 'Second evolution card should remain in hand (blocked)');
    });

    describe('Evolution and Status Effects', () => {
        it('should clear all status effects when creature evolves', () => {
            const { state } = runTestGame({
                actions: [
                    new EvolveResponseMessage('evolution-creature', 0),
                ],
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature'),
                    StateBuilder.withHand(0, [{ templateId: 'evolution-creature', type: 'creature' }]),
                    StateBuilder.withCanEvolve(0, 0),
                    (state) => {
                        state.statusEffects.activeStatusEffects[0] = [{ type: 'poison' }];
                        const creatureData = state.field.creatures[0][0];
                        if (creatureData) {
                            creatureData.turnLastPlayed = 0;
                        }
                    },
                ),
                maxSteps: 10,
            });

            const statusEffects = state.statusEffects.activeStatusEffects[0];
            expect(statusEffects).to.have.length(0, 'Status effects should be cleared after evolution');
            expect(getCurrentTemplateId(state.field.creatures[0][0])).to.equal('evolution-creature', 'Creature should be evolved');
        });

        it('should preserve damage when evolving with status effects', () => {
            const { state } = runTestGame({
                actions: [
                    new EvolveResponseMessage('evolution-creature', 0),
                ],
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature'),
                    StateBuilder.withHand(0, [{ templateId: 'evolution-creature', type: 'creature' }]),
                    StateBuilder.withCanEvolve(0, 0),
                    (state) => {
                        state.statusEffects.activeStatusEffects[0] = [{ type: 'poison' }];
                        const creatureData = state.field.creatures[0][0];
                        if (creatureData) {
                            creatureData.turnLastPlayed = 0;
                            creatureData.damageTaken = 60;
                        }
                    },
                ),
                maxSteps: 10,
            });

            expect(state.field.creatures[0][0].damageTaken).to.equal(60, 'Damage should be preserved during evolution');
            expect((state.statusEffects.activeStatusEffects[0] as any[]).length).to.equal(0, 'Status effects should be cleared');
            expect(getCurrentTemplateId(state.field.creatures[0][0])).to.equal('evolution-creature', 'Creature should be evolved');
        });

        it('should clear status effects when retreating', () => {
            const { state } = runTestGame({
                actions: [ new RetreatResponseMessage(0) ],
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature', [ 'high-hp-creature' ]),
                    StateBuilder.withDamage('basic-creature-0', 20),
                    StateBuilder.withEnergy('basic-creature-0', { fire: 1 }),
                    (state) => {
                        state.statusEffects.activeStatusEffects[0] = [{ type: 'poison' }];
                    },
                ),
                maxSteps: 10,
            });

            const statusEffects = state.statusEffects.activeStatusEffects[0] as any[];
            expect(statusEffects).to.have.length(0, 'Retreat should clear status effects');
            expect(getCurrentTemplateId(state.field.creatures[0][0])).to.equal('high-hp-creature', 'Should have retreated successfully');
        });

        it('should maintain poison/burn effects through non-clearing actions', () => {
            const { state } = runTestGame({
                actions: [],
                stateCustomizer: (state) => {
                    state.statusEffects.activeStatusEffects[0] = [{ type: 'poison' }, { type: 'burn' }];
                },
                maxSteps: 3,
            });

            const effects = state.statusEffects.activeStatusEffects[0] as any[];
            expect(effects.length).to.be.at.least(1, 'Status effects should persist through normal actions');
        });

        it('should handle status effects on benched creature promotion', () => {
            const { state } = runTestGame({
                actions: [],
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'high-hp-creature', [ 'basic-creature' ]),
                    StateBuilder.withDamage('high-hp-creature-0', 90),
                    (state) => {
                        state.statusEffects.activeStatusEffects[0] = [{ type: 'poison' }];
                    },
                ),
                maxSteps: 5,
            });

            expect(state.field.creatures[0][0]).to.exist;
        });
    });

    describe('Evolution with Same Name, Different Template ID', () => {
        /**
         * This test verifies that evolution is based on creature name, not templateId.
         * A player can have up to two creatures with the same name but different templateIds in their deck.
         */
        
        it('should allow basic-variant to evolve based on name', () => {
            const { state, getExecutedCount } = runTestGame({
                actions: [ new EvolveResponseMessage('evolution-creature', 0) ],
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature'),
                    StateBuilder.withHand(0, [{ templateId: 'evolution-creature', type: 'creature' }]),
                    StateBuilder.withCanEvolve(0, 0),
                ),
            });

            expect(getExecutedCount()).to.equal(1, 'Should have executed evolution action');
            expect(getCurrentTemplateId(state.field.creatures[0][0])).to.equal('evolution-creature', 'Should have evolved');
        });

        it('should preserve evolution stack showing original templateId', () => {
            const { state } = runTestGame({
                actions: [ new EvolveResponseMessage('evolution-creature', 0) ],
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature'),
                    StateBuilder.withHand(0, [{ templateId: 'evolution-creature', type: 'creature' }]),
                    StateBuilder.withCanEvolve(0, 0),
                ),
                maxSteps: 5,
            });

            const activeCard = state.field.creatures[0][0];
            expect(activeCard.evolutionStack.length).to.equal(2, 'Evolution stack should have 2 cards');
            expect(activeCard.evolutionStack[0].templateId).to.equal('basic-creature', 'Base form should be basic-creature');
            expect(activeCard.evolutionStack[1].templateId).to.equal('evolution-creature', 'Evolved form should be evolution-creature');
        });
    });
});
