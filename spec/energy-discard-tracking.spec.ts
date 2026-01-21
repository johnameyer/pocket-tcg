import { expect } from 'chai';
import { runTestGame } from './helpers/test-helpers.js';
import { StateBuilder } from './helpers/state-builder.js';
import { RetreatResponseMessage } from '../src/messages/response/retreat-response-message.js';
import { AttackResponseMessage } from '../src/messages/response/attack-response-message.js';
import { PlayCardResponseMessage } from '../src/messages/response/play-card-response-message.js';
import { MockCardRepository } from './mock-repository.js';

describe('Energy Discard Tracking', () => {
    describe('Retreat Energy Discard', () => {
        it('should track discarded energy when retreating', () => {
            const { state } = runTestGame({
                actions: [new RetreatResponseMessage(0)],
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'evolution-creature', ['basic-creature']),  // retreat cost = 2
                    StateBuilder.withEnergy('evolution-creature-0', { fire: 2, water: 1 })
                ),
                maxSteps: 10
            });

            const energyState = state.energy as any;
            const discardedEnergy = energyState.discardedEnergy[0];
            
            // Should have discarded exactly 2 energy (retreat cost)
            const totalDiscarded = Object.values(discardedEnergy).reduce((sum: number, count) => sum + (count as number), 0);
            expect(totalDiscarded).to.equal(2, 'Should discard 2 energy for retreat cost');
        });

        it('should track multiple energy types discarded during retreat', () => {
            const { state } = runTestGame({
                actions: [new RetreatResponseMessage(0)],
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'high-hp-creature', ['basic-creature']),  // retreat cost = 3
                    StateBuilder.withEnergy('high-hp-creature-0', { fire: 1, water: 1, grass: 1 })
                ),
                maxSteps: 10
            });

            const energyState = state.energy as any;
            const discardedEnergy = energyState.discardedEnergy[0];
            
            // Should have discarded 3 energy total
            const totalDiscarded = Object.values(discardedEnergy).reduce((sum: number, count) => sum + (count as number), 0);
            expect(totalDiscarded).to.equal(3, 'Should discard 3 energy for retreat cost');
            
            // Should have discarded at least one of each type (depending on discard order)
            expect(discardedEnergy.fire + discardedEnergy.water + discardedEnergy.grass).to.equal(3);
        });

        it('should not track energy when retreating with cost 1', () => {
            const { state } = runTestGame({
                actions: [new RetreatResponseMessage(0)],
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature', ['high-hp-creature']),  // retreat cost = 1
                    StateBuilder.withEnergy('basic-creature-0', { fire: 2 })
                ),
                maxSteps: 10
            });

            const energyState = state.energy as any;
            const discardedEnergy = energyState.discardedEnergy[0];
            
            // Should have discarded 1 energy
            const totalDiscarded = Object.values(discardedEnergy).reduce((sum: number, count) => sum + (count as number), 0);
            expect(totalDiscarded).to.equal(1, 'Should discard 1 energy for retreat cost of 1');
        });
    });

    describe('Knockout Energy Discard', () => {
        it('should track discarded energy when creature is knocked out', () => {
            const testRepository = new MockCardRepository({
                creatures: new Map([
                    ['attacker', {
                        templateId: 'attacker',
                        name: 'Attacker',
                        type: 'fire',
                        maxHp: 100,
                        retreatCost: 1,
                        weakness: 'water',
                        attacks: [{
                            name: 'Big Attack',
                            damage: 100,
                            energyRequirements: []
                        }]
                    }],
                    ['defender', {
                        templateId: 'defender',
                        name: 'Defender',
                        type: 'water',
                        maxHp: 50,
                        retreatCost: 1,
                        weakness: 'grass',
                        attacks: []
                    }]
                ])
            });

            const { state } = runTestGame({
                actions: [new AttackResponseMessage(0)],
                customRepository: testRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'attacker'),
                    StateBuilder.withCreatures(1, 'defender'),
                    StateBuilder.withEnergy('defender-1', { water: 2, fire: 1 })
                ),
                maxSteps: 15
            });

            const energyState = state.energy as any;
            const discardedEnergy = energyState.discardedEnergy[1];
            
            // Should have discarded all energy from knocked out defender
            expect(discardedEnergy.water).to.equal(2, 'Should discard 2 water energy');
            expect(discardedEnergy.fire).to.equal(1, 'Should discard 1 fire energy');
            
            const totalDiscarded = Object.values(discardedEnergy).reduce((sum: number, count) => sum + (count as number), 0);
            expect(totalDiscarded).to.equal(3, 'Should discard all 3 energy from knocked out creature');
        });
    });

    describe('Effect-based Energy Discard', () => {
        it('should track discarded energy from discard effects', () => {
            const testRepository = new MockCardRepository({
                supporters: new Map([
                    ['energy-discard', {
                        templateId: 'energy-discard',
                        name: 'Energy Discard',
                        effects: [{
                            type: 'energy',
                            energyType: 'fire',
                            amount: { type: 'constant', value: 2 },
                            target: { type: 'fixed', player: 'opponent', position: 'active' },
                            operation: 'discard'
                        }]
                    }]
                ])
            });

            const { state } = runTestGame({
                actions: [new PlayCardResponseMessage('energy-discard', 'supporter')],
                customRepository: testRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature'),
                    StateBuilder.withCreatures(1, 'basic-creature'),
                    StateBuilder.withHand(0, [{ templateId: 'energy-discard', type: 'supporter' }]),
                    StateBuilder.withEnergy('basic-creature-1', { fire: 3, water: 1 })
                ),
                maxSteps: 10
            });

            const energyState = state.energy as any;
            const discardedEnergy = energyState.discardedEnergy[1];
            
            // Should have discarded 2 fire energy from effect
            expect(discardedEnergy.fire).to.equal(2, 'Should discard 2 fire energy from effect');
            expect(discardedEnergy.water).to.equal(0, 'Should not discard water energy');
        });
    });

    describe('Multiple Discards Accumulation', () => {
        it('should accumulate energy from multiple discard events', () => {
            const testRepository = new MockCardRepository({
                supporters: new Map([
                    ['energy-discard', {
                        templateId: 'energy-discard',
                        name: 'Energy Discard',
                        effects: [{
                            type: 'energy',
                            energyType: 'fire',
                            amount: { type: 'constant', value: 1 },
                            target: { type: 'fixed', player: 'self', position: 'active' },
                            operation: 'discard'
                        }]
                    }]
                ])
            });

            const { state } = runTestGame({
                actions: [
                    new PlayCardResponseMessage('energy-discard', 'supporter'),
                    new RetreatResponseMessage(0)
                ],
                customRepository: testRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'evolution-creature', ['basic-creature']),  // retreat cost = 2
                    StateBuilder.withHand(0, [{ templateId: 'energy-discard', type: 'supporter' }]),
                    StateBuilder.withEnergy('evolution-creature-0', { fire: 4 })
                ),
                maxSteps: 15
            });

            const energyState = state.energy as any;
            const discardedEnergy = energyState.discardedEnergy[0];
            
            // Should have discarded 1 from effect + 2 from retreat = 3 total
            expect(discardedEnergy.fire).to.equal(3, 'Should accumulate discarded fire energy from both events');
        });
    });
});
