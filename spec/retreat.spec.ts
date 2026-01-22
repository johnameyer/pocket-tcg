import { expect } from 'chai';
import { RetreatResponseMessage } from '../src/messages/response/retreat-response-message.js';
import { PlayCardResponseMessage } from '../src/messages/response/play-card-response-message.js';
import { StateBuilder } from './helpers/state-builder.js';
import { runTestGame } from './helpers/test-helpers.js';
import { MockCardRepository } from './mock-repository.js';
import { EnergyDictionary } from '../src/controllers/energy-controller.js';
import { getCurrentTemplateId } from '../src/utils/field-card-utils.js';
import { createSupporterRepo } from './helpers/test-utils.js';

const getTotalEnergy = (energyDict: EnergyDictionary): number => 
    Object.values(energyDict).reduce((sum, count) => sum + count, 0);

describe('Creature Retreat System', () => {
    it('should allow retreat with sufficient energy', () => {
        const { state } = runTestGame({
            actions: [new RetreatResponseMessage(0)],
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature', ['high-hp-creature']),
                StateBuilder.withEnergy('basic-creature-0', { fire: 1 }),
                StateBuilder.withDamage('basic-creature-0', 10)
            )
        });
        
        expect(getCurrentTemplateId(state.field.creatures[0][0])).to.equal('high-hp-creature');
    });

    it('should prevent retreat with insufficient energy', () => {
        const { state } = runTestGame({
            actions: [new RetreatResponseMessage(0)],
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature', ['high-hp-creature']),
                StateBuilder.withEnergy('basic-creature-0', {}),
                StateBuilder.withDamage('basic-creature-0', 10)
            )
        });
        
        expect(getCurrentTemplateId(state.field.creatures[0][0])).to.equal('basic-creature');
    });

    it('should clear status effects on retreat', () => {
        const { state } = runTestGame({
            actions: [new RetreatResponseMessage(0)],
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature', ['high-hp-creature']),
                StateBuilder.withEnergy('basic-creature-0', { fire: 1 }),
                StateBuilder.withDamage('basic-creature-0', 10),
                StateBuilder.withStatusEffect(0, 'poison')
            )
        });
        
        expect(getCurrentTemplateId(state.field.creatures[0][0])).to.equal('high-hp-creature');
    });

    it('should require exact retreat cost energy', () => {
        const { state } = runTestGame({
            actions: [new RetreatResponseMessage(0)],
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'evolution-creature', ['high-hp-creature']),
                StateBuilder.withEnergy('evolution-creature-0', { fire: 2 })
            )
        });
        
        expect(getCurrentTemplateId(state.field.creatures[0][0])).to.equal('high-hp-creature');
    });

    it('should allow retreat with any energy type for colorless cost', () => {
        const { state } = runTestGame({
            actions: [new RetreatResponseMessage(0)],
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'evolution-creature', ['high-hp-creature']),
                StateBuilder.withEnergy('evolution-creature-0', { fire: 2 }) // Fire energy can pay colorless retreat cost
            )
        });
        
        expect(getCurrentTemplateId(state.field.creatures[0][0])).to.equal('high-hp-creature');
    });

    it('should allow player to choose which bench creature becomes active on retreat', () => {
        const { state } = runTestGame({
            actions: [new RetreatResponseMessage(1)],
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature', ['high-hp-creature', 'basic-creature']),
                StateBuilder.withEnergy('basic-creature-0', { fire: 1 }),
                StateBuilder.withDamage('basic-creature-0', 10)
            )
        });
        
        expect(getCurrentTemplateId(state.field.creatures[0][0])).to.equal('basic-creature');
        expect(state.field.creatures[0].length).to.equal(3); // Active + 2 bench
        expect(getCurrentTemplateId(state.field.creatures[0][1])).to.equal('high-hp-creature');
        expect(getCurrentTemplateId(state.field.creatures[0][2])).to.equal('basic-creature');
    });

    it('should consume energy when retreating', () => {
        const { state } = runTestGame({
            actions: [new RetreatResponseMessage(0)],
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature', ['high-hp-creature']),
                StateBuilder.withEnergy('basic-creature-0', { fire: 2 })
            )
        });
        
        // Energy should be consumed from the retreated creature (now on bench)
        const basicCreatureEnergy = state.energy.attachedEnergyByInstance['basic-creature-0'];
        expect(basicCreatureEnergy.fire).to.equal(1, 'Should consume 1 fire energy for retreat cost');
        expect(getCurrentTemplateId(state.field.creatures[0][0])).to.equal('high-hp-creature', 'Should have retreated successfully');
    });

    it('should preserve bench ordering when retreating', () => {
        const { state } = runTestGame({
            actions: [new RetreatResponseMessage(1)], // Select middle creature (Squirtle)
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature', ['high-hp-creature', 'basic-creature', 'high-hp-creature']),
                StateBuilder.withEnergy('basic-creature-0', { fire: 1 })
            )
        });
        
        // After retreat: Squirtle becomes active, Charmander goes to bench
        // Bench ordering should be: [Snorlax, Charmander, Snorlax]
        expect(getCurrentTemplateId(state.field.creatures[0][0])).to.equal('basic-creature', 'Froakie should be active');
        expect(state.field.creatures[0].length).to.equal(4, 'Should have 4 creatures total (1 active + 3 bench)');
        expect(getCurrentTemplateId(state.field.creatures[0][1])).to.equal('high-hp-creature', 'Snorlax should stay at index 1');
        expect(getCurrentTemplateId(state.field.creatures[0][2])).to.equal('basic-creature', 'Charmander should take Froakie\'s place');
        expect(getCurrentTemplateId(state.field.creatures[0][3])).to.equal('high-hp-creature', 'Snorlax should stay at index 3');
    });

    describe('Retreat Validation Edge Cases', () => {
        it('should prevent retreat with negative bench index', () => {
            const { state } = runTestGame({
                actions: [new RetreatResponseMessage(-1)],
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature', ['high-hp-creature']),
                    StateBuilder.withEnergy('basic-creature-0', { fire: 1 })
                )
            });

            expect(getCurrentTemplateId(state.field.creatures[0][0])).to.equal('basic-creature', 'Negative bench index should be blocked');
        });

        it('should prevent retreat with out-of-range bench index', () => {
            const { state } = runTestGame({
                actions: [new RetreatResponseMessage(5)],
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature', ['high-hp-creature']),
                    StateBuilder.withEnergy('basic-creature-0', { fire: 1 })
                )
            });

            expect(getCurrentTemplateId(state.field.creatures[0][0])).to.equal('basic-creature', 'Out-of-range bench index should be blocked');
        });

        it('should prevent retreat when no bench creatures available', () => {
            const { state } = runTestGame({
                actions: [new RetreatResponseMessage(0)],
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature', []),
                    StateBuilder.withEnergy('basic-creature-0', { fire: 1 })
                )
            });

            expect(getCurrentTemplateId(state.field.creatures[0][0])).to.equal('basic-creature', 'Should not retreat with empty bench');
        });

        it('should allow first retreat but prevent second retreat in same turn', () => {
            const { state } = runTestGame({
                actions: [
                    new RetreatResponseMessage(0), // Should succeed: Charmander -> Snorlax  
                    new RetreatResponseMessage(1)  // Should fail: blocked by once-per-turn rule
                ],
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature', ['high-hp-creature', 'basic-creature']),
                    StateBuilder.withEnergy('basic-creature-0', { fire: 1 }),
                    StateBuilder.withEnergy('high-hp-creature-0-0', { lightning: 1 }),
                    StateBuilder.withEnergy('basic-creature-0-1', { water: 1 })
                ),
                maxSteps: 10
            });

            expect(getCurrentTemplateId(state.field.creatures[0][0])).to.equal('high-hp-creature', 'First retreat should succeed, second should be blocked');
        });

        it('should prevent multiple retreats in one turn', () => {
            const { state } = runTestGame({
                actions: [
                    new RetreatResponseMessage(0), // Charmander -> Snorlax (succeeds)
                    new RetreatResponseMessage(1)  // Try Snorlax -> Froakie (blocked)
                ],
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature', ['high-hp-creature', 'basic-creature']),
                    StateBuilder.withEnergy('basic-creature-0', { fire: 1 }),
                    StateBuilder.withEnergy('high-hp-creature-0-0', { lightning: 1 }),
                    StateBuilder.withEnergy('basic-creature-0-1', { water: 1 })
                ),
                maxSteps: 10
            });

            // First retreat succeeds, second is blocked by once-per-turn validation
            expect(getCurrentTemplateId(state.field.creatures[0][0])).to.equal('high-hp-creature', 'First retreat should succeed, second should be blocked');
        });
    });

    describe('Energy Discard Tracking', () => {
        it('should track discarded energy when retreating (2 cost)', () => {
            const { state } = runTestGame({
                actions: [new RetreatResponseMessage(0)],
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'evolution-creature', ['basic-creature']),  // retreat cost = 2
                    StateBuilder.withEnergy('evolution-creature-0', { fire: 2, water: 1 })
                ),
                maxSteps: 10
            });

            const discardedEnergy = state.energy.discardedEnergy[0];
            
            // Should have discarded exactly 2 energy (retreat cost)
            expect(getTotalEnergy(discardedEnergy)).to.equal(2, 'Should discard 2 energy for retreat cost');
        });

        it('should track multiple energy types discarded during retreat (3 cost)', () => {
            const { state } = runTestGame({
                actions: [new RetreatResponseMessage(0)],
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'high-hp-creature', ['basic-creature']),  // retreat cost = 3
                    StateBuilder.withEnergy('high-hp-creature-0', { fire: 1, water: 1, grass: 1 })
                ),
                maxSteps: 10
            });

            const discardedEnergy = state.energy.discardedEnergy[0];
            
            // Should have discarded 3 energy total
            expect(getTotalEnergy(discardedEnergy)).to.equal(3, 'Should discard 3 energy for retreat cost');
            
            // Should have discarded all available energy
            expect(discardedEnergy.fire + discardedEnergy.water + discardedEnergy.grass).to.equal(3);
        });

        it('should track discarded energy for basic retreat (1 cost)', () => {
            const { state } = runTestGame({
                actions: [new RetreatResponseMessage(0)],
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature', ['high-hp-creature']),  // retreat cost = 1
                    StateBuilder.withEnergy('basic-creature-0', { fire: 2 })
                ),
                maxSteps: 10
            });

            const discardedEnergy = state.energy.discardedEnergy[0];
            
            // Should have discarded 1 energy
            expect(getTotalEnergy(discardedEnergy)).to.equal(1, 'Should discard 1 energy for retreat cost of 1');
        });

        it('should accumulate discarded energy across multiple retreats in different turns', () => {
            const testRepository = createSupporterRepo('energy-discard', 'Energy Discard', [{
                type: 'energy',
                energyType: 'fire',
                amount: { type: 'constant', value: 1 },
                target: { type: 'fixed', player: 'self', position: 'active' },
                operation: 'discard'
            }]);

            const { state } = runTestGame({
                actions: [
                    new PlayCardResponseMessage('energy-discard', 'supporter'),
                    new RetreatResponseMessage(0)
                ],
                customRepository: testRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'evolution-creature', ['basic-creature']),
                    StateBuilder.withHand(0, [{ templateId: 'energy-discard', type: 'supporter' }]),
                    StateBuilder.withEnergy('evolution-creature-0', { fire: 4 })
                ),
                maxSteps: 15
            });

            const discardedEnergy = state.energy.discardedEnergy[0];
            expect(discardedEnergy.fire).to.equal(3, 'Should accumulate discarded fire energy from both events');
        });
    });
});
