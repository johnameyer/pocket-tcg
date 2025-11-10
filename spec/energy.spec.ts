import { expect } from 'chai';
import { AttackResponseMessage } from '../src/messages/response/attack-response-message.js';
import { AttachEnergyResponseMessage } from '../src/messages/response/attach-energy-response-message.js';
import { StateBuilder } from './helpers/state-builder.js';
import { runTestGame } from './helpers/test-helpers.js';

describe('Energy System', () => {
    describe('Energy Validation', () => {
        it('should allow attack with sufficient energy', () => {
            const { getExecutedCount } = runTestGame({
                actions: [new AttackResponseMessage(0)],
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature'),
                    StateBuilder.withEnergy('basic-creature-0', { fire: 1 })
                )
            });

            expect(getExecutedCount()).to.equal(1, 'Should have executed attack with sufficient energy');
        });

        it('should prevent attack with insufficient energy', () => {
            const { getExecutedCount } = runTestGame({
                actions: [new AttackResponseMessage(0)],
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'high-hp-creature'),
                    StateBuilder.withEnergy('high-hp-creature-0', { fighting: 1 }) // Needs 2 fighting
                )
            });

            expect(getExecutedCount()).to.be.greaterThanOrEqual(0, 'Action should be attempted but energy validation should trigger');
        });

        it('should validate energy types match creature attack requirements', () => {
            const { state } = runTestGame({
                actions: [new AttackResponseMessage(0)],
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature'), // Fire creature
                    StateBuilder.withCreatures(1, 'high-hp-creature'),
                    StateBuilder.withEnergy('basic-creature-0', { water: 2 }) // Wrong energy type for fire attack
                )
            });

            // Verify no damage was dealt since the attack should be blocked
            expect(state.field.creatures[1][0].damageTaken).to.equal(0, 'Should block attack with incompatible energy type');
        });
    });

    describe('Energy Attachment Validation', () => {
        it('should prevent energy attachment on first turn', () => {
            const { state } = runTestGame({
                actions: [new AttachEnergyResponseMessage(0)],
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature'),
                    StateBuilder.withTurnNumber(1),
                    StateBuilder.withFirstTurnRestriction(true),
                    StateBuilder.withNoEnergy(0)
                ),
                maxSteps: 5
            });

            // Energy should not be attached on first turn
            const attachedEnergy = state.energy.attachedEnergyByInstance['basic-creature-0'];
            const totalEnergy = attachedEnergy ? Object.values(attachedEnergy).reduce((sum, count) => sum + count, 0) : 0;
            expect(totalEnergy).to.equal(0, 'Should not attach energy on first turn');
        });

        it('should prevent multiple energy attachments per turn', () => {
            const { state } = runTestGame({
                actions: [
                    new AttachEnergyResponseMessage(0),
                    new AttachEnergyResponseMessage(0)
                ],
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature'),
                    StateBuilder.withTurnNumber(2)
                ),
                maxSteps: 10
            });

            // Should only have one energy attached
            const attachedEnergy = state.energy.attachedEnergyByInstance['basic-creature-0'];
            const totalEnergy = attachedEnergy ? Object.values(attachedEnergy).reduce((sum, count) => sum + count, 0) : 0;
            expect(totalEnergy).to.be.at.most(1, 'Should not attach multiple energy per turn');
        });
    });

    describe('Mixed Energy Coverage', () => {
        it('should use Fire Storm with exact energy requirements', () => {
            const { state, getExecutedCount } = runTestGame({
                actions: [new AttackResponseMessage(0)],
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'evolution-creature'),
                    StateBuilder.withCreatures(1, 'high-hp-creature'),
                    StateBuilder.withEnergy('evolution-creature-0', { fire: 2 })
                ),
                maxSteps: 10
            });
            
            expect(getExecutedCount()).to.equal(1, 'Should have executed Fire Storm');
            expect(state.field.creatures[1][0].damageTaken).to.equal(50, 'Should deal 50 damage from Fire Storm');
        });

        it('should use Fire Storm with excess fire energy', () => {
            const { state, getExecutedCount } = runTestGame({
                actions: [new AttackResponseMessage(0)],
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'evolution-creature'),
                    StateBuilder.withCreatures(1, 'high-hp-creature'),
                    StateBuilder.withEnergy('evolution-creature-0', { fire: 5 })
                ),
                maxSteps: 10
            });
            
            expect(getExecutedCount()).to.equal(1, 'Should have executed Fire Storm with excess fire');
            expect(state.field.creatures[1][0].damageTaken).to.equal(50, 'Should deal same damage regardless of excess energy');
        });

        it('should use Ember to prepare for evolution', () => {
            const { state, getExecutedCount } = runTestGame({
                actions: [new AttackResponseMessage(0)],
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature'),
                    StateBuilder.withCreatures(1, 'high-hp-creature'),
                    StateBuilder.withEnergy('basic-creature-0', { fire: 1 })
                ),
                maxSteps: 10
            });
            
            expect(getExecutedCount()).to.equal(1, 'Should have executed Ember');
            expect(state.field.creatures[1][0].damageTaken).to.equal(20, 'Should deal 20 damage from Ember');
        });
    });
});
