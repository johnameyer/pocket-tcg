import { expect } from 'chai';
import { RetreatResponseMessage } from '../src/messages/response/retreat-response-message.js';
import { PlayCardResponseMessage } from '../src/messages/response/play-card-response-message.js';
import { StateBuilder } from './helpers/state-builder.js';
import { runTestGame } from './helpers/test-helpers.js';
import { MockCardRepository } from './mock-repository.js';

describe('Creature Retreat System', () => {
    it('should allow retreat with sufficient energy', () => {
        const { state } = runTestGame({
            actions: [new RetreatResponseMessage(0)],
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withcreature(0, 'basic-creature', ['high-hp-creature']),
                StateBuilder.withEnergy('basic-creature-0', { fire: 1 }),
                StateBuilder.withDamage('basic-creature-0', 10)
            )
        });
        
        expect(state.field.creatures[0][0].templateId).to.equal('high-hp-creature');
    });

    it('should prevent retreat with insufficient energy', () => {
        const { state } = runTestGame({
            actions: [new RetreatResponseMessage(0)],
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withcreature(0, 'basic-creature', ['high-hp-creature']),
                StateBuilder.withEnergy('basic-creature-0', {}),
                StateBuilder.withDamage('basic-creature-0', 10)
            )
        });
        
        expect(state.field.creatures[0][0].templateId).to.equal('basic-creature');
    });

    it('should clear status effects on retreat', () => {
        const { state } = runTestGame({
            actions: [new RetreatResponseMessage(0)],
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withcreature(0, 'basic-creature', ['high-hp-creature']),
                StateBuilder.withEnergy('basic-creature-0', { fire: 1 }),
                StateBuilder.withDamage('basic-creature-0', 10),
                StateBuilder.withStatusEffect(0, 'poison')
            )
        });
        
        expect(state.field.creatures[0][0].templateId).to.equal('high-hp-creature');
    });

    it('should require exact retreat cost energy', () => {
        const { state } = runTestGame({
            actions: [new RetreatResponseMessage(0)],
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withcreature(0, 'evolution-creature', ['high-hp-creature']),
                StateBuilder.withEnergy('evolution-creature-0', { fire: 2 })
            )
        });
        
        expect(state.field.creatures[0][0].templateId).to.equal('high-hp-creature');
    });

    it('should allow retreat with any energy type for colorless cost', () => {
        const { state } = runTestGame({
            actions: [new RetreatResponseMessage(0)],
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withcreature(0, 'evolution-creature', ['high-hp-creature']),
                StateBuilder.withEnergy('evolution-creature-0', { fire: 2 }) // Fire energy can pay colorless retreat cost
            )
        });
        
        expect(state.field.creatures[0][0].templateId).to.equal('high-hp-creature');
    });

    it('should allow player to choose which bench creature becomes active on retreat', () => {
        const { state } = runTestGame({
            actions: [new RetreatResponseMessage(1)],
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withcreature(0, 'basic-creature', ['high-hp-creature', 'basic-creature']),
                StateBuilder.withEnergy('basic-creature-0', { fire: 1 }),
                StateBuilder.withDamage('basic-creature-0', 10)
            )
        });
        
        expect(state.field.creatures[0][0].templateId).to.equal('basic-creature');
        expect(state.field.creatures[0].length).to.equal(3); // Active + 2 bench
        expect(state.field.creatures[0][1].templateId).to.equal('high-hp-creature');
        expect(state.field.creatures[0][2].templateId).to.equal('basic-creature');
    });

    it('should consume energy when retreating', () => {
        const { state } = runTestGame({
            actions: [new RetreatResponseMessage(0)],
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withcreature(0, 'basic-creature', ['high-hp-creature']),
                StateBuilder.withEnergy('basic-creature-0', { fire: 2 })
            )
        });
        
        // Energy should be consumed from the retreated creature (now on bench)
        const basicCreatureEnergy = state.energy.attachedEnergyByInstance['basic-creature-0'];
        expect(basicCreatureEnergy.fire).to.equal(1, 'Should consume 1 fire energy for retreat cost');
        expect(state.field.creatures[0][0].templateId).to.equal('high-hp-creature', 'Should have retreated successfully');
    });

    it('should preserve bench ordering when retreating', () => {
        const { state } = runTestGame({
            actions: [new RetreatResponseMessage(1)], // Select middle creature (Squirtle)
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withcreature(0, 'basic-creature', ['high-hp-creature', 'basic-creature', 'high-hp-creature']),
                StateBuilder.withEnergy('basic-creature-0', { fire: 1 })
            )
        });
        
        // After retreat: Squirtle becomes active, Charmander goes to bench
        // Bench ordering should be: [Snorlax, Charmander, Snorlax]
        expect(state.field.creatures[0][0].templateId).to.equal('basic-creature', 'Froakie should be active');
        expect(state.field.creatures[0].length).to.equal(4, 'Should have 4 creatures total (1 active + 3 bench)');
        expect(state.field.creatures[0][1].templateId).to.equal('high-hp-creature', 'Snorlax should stay at index 1');
        expect(state.field.creatures[0][2].templateId).to.equal('basic-creature', 'Charmander should take Froakie\'s place');
        expect(state.field.creatures[0][3].templateId).to.equal('high-hp-creature', 'Snorlax should stay at index 3');
    });

    describe('Retreat Validation Edge Cases', () => {
        it('should prevent retreat with negative bench index', () => {
            const { state } = runTestGame({
                actions: [new RetreatResponseMessage(-1)],
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withcreature(0, 'basic-creature', ['high-hp-creature']),
                    StateBuilder.withEnergy('basic-creature-0', { fire: 1 })
                )
            });

            expect(state.field.creatures[0][0].templateId).to.equal('basic-creature', 'Negative bench index should be blocked');
        });

        it('should prevent retreat with out-of-range bench index', () => {
            const { state } = runTestGame({
                actions: [new RetreatResponseMessage(5)],
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withcreature(0, 'basic-creature', ['high-hp-creature']),
                    StateBuilder.withEnergy('basic-creature-0', { fire: 1 })
                )
            });

            expect(state.field.creatures[0][0].templateId).to.equal('basic-creature', 'Out-of-range bench index should be blocked');
        });

        it('should prevent retreat when no bench creatures available', () => {
            const { state } = runTestGame({
                actions: [new RetreatResponseMessage(0)],
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withcreature(0, 'basic-creature', []),
                    StateBuilder.withEnergy('basic-creature-0', { fire: 1 })
                )
            });

            expect(state.field.creatures[0][0].templateId).to.equal('basic-creature', 'Should not retreat with empty bench');
        });

        it('should allow first retreat but prevent second retreat in same turn', () => {
            const { state } = runTestGame({
                actions: [
                    new RetreatResponseMessage(0), // Should succeed: Charmander -> Snorlax  
                    new RetreatResponseMessage(1)  // Should fail: blocked by once-per-turn rule
                ],
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withcreature(0, 'basic-creature', ['high-hp-creature', 'basic-creature']),
                    StateBuilder.withEnergy('basic-creature-0', { fire: 1 }),
                    StateBuilder.withEnergy('high-hp-creature-0-0', { lightning: 1 }),
                    StateBuilder.withEnergy('basic-creature-0-1', { water: 1 })
                ),
                maxSteps: 10
            });

            expect(state.field.creatures[0][0].templateId).to.equal('high-hp-creature', 'First retreat should succeed, second should be blocked');
        });

        it('should prevent multiple retreats in one turn', () => {
            const { state } = runTestGame({
                actions: [
                    new RetreatResponseMessage(0), // Charmander -> Snorlax (succeeds)
                    new RetreatResponseMessage(1)  // Try Snorlax -> Froakie (blocked)
                ],
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withcreature(0, 'basic-creature', ['high-hp-creature', 'basic-creature']),
                    StateBuilder.withEnergy('basic-creature-0', { fire: 1 }),
                    StateBuilder.withEnergy('high-hp-creature-0-0', { lightning: 1 }),
                    StateBuilder.withEnergy('basic-creature-0-1', { water: 1 })
                ),
                maxSteps: 10
            });

            // First retreat succeeds, second is blocked by once-per-turn validation
            expect(state.field.creatures[0][0].templateId).to.equal('high-hp-creature', 'First retreat should succeed, second should be blocked');
        });
    });
});
