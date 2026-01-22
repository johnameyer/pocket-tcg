import { expect } from 'chai';
import { runTestGame } from '../../helpers/test-helpers.js';
import { StateBuilder } from '../../helpers/state-builder.js';
import { PlayCardResponseMessage } from '../../../src/messages/response/play-card-response-message.js';
import { SelectTargetResponseMessage } from '../../../src/messages/response/select-target-response-message.js';
import { AttackResponseMessage } from '../../../src/messages/response/attack-response-message.js';
import { EnergyDictionary } from '../../../src/controllers/energy-controller.js';
import { createSupporterRepo } from '../../helpers/test-utils.js';
import { MockCardRepository } from '../../mock-repository.js';

const getTotalEnergy = (energyDict: EnergyDictionary): number => 
    Object.values(energyDict).reduce((sum, count) => sum + count, 0);

describe('Energy Effect', () => {
    it('should attach 1 fire energy (basic operation)', () => {
        const testRepository = createSupporterRepo('energy-supporter', 'Energy Supporter', [{
            type: 'energy',
            energyType: 'fire',
            amount: { type: 'constant', value: 1 },
            target: { type: 'fixed', player: 'self', position: 'active' },
            operation: 'attach'
        }]);

        const { state } = runTestGame({
            actions: [new PlayCardResponseMessage('energy-supporter', 'supporter')],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature'),
                StateBuilder.withHand(0, [{ templateId: 'energy-supporter', type: 'supporter' }])
            ),
            maxSteps: 10
        });

        const energyState = state.energy as any;
        expect(energyState.attachedEnergyByInstance['basic-creature-0'].fire).to.equal(1, 'Should attach 1 fire energy');
    });

    it('should discard energy instead of attach', () => {
        const testRepository = createSupporterRepo('discard-supporter', 'Discard Supporter', [{
            type: 'energy',
            energyType: 'fire',
            amount: { type: 'constant', value: 1 },
            target: { type: 'fixed', player: 'opponent', position: 'active' },
            operation: 'discard'
        }]);

        const { state } = runTestGame({
            actions: [new PlayCardResponseMessage('discard-supporter', 'supporter')],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature'),
                StateBuilder.withCreatures(1, 'basic-creature'),
                StateBuilder.withHand(0, [{ templateId: 'discard-supporter', type: 'supporter' }]),
                StateBuilder.withEnergy('basic-creature-1', { fire: 2, water: 1 })
            ),
            maxSteps: 10
        });

        const energyState = state.energy as any;
        expect(energyState.attachedEnergyByInstance['basic-creature-1'].fire).to.equal(1, 'Should discard 1 fire energy');
        expect(energyState.attachedEnergyByInstance['basic-creature-1'].water).to.equal(1, 'Should not affect water energy');
    });

    it('should attach different energy types (water)', () => {
        const testRepository = createSupporterRepo('water-supporter', 'Water Supporter', [{
            type: 'energy',
            energyType: 'water',
            amount: { type: 'constant', value: 1 },
            target: { type: 'fixed', player: 'self', position: 'active' },
            operation: 'attach'
        }]);

        const { state } = runTestGame({
            actions: [new PlayCardResponseMessage('water-supporter', 'supporter')],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature'),
                StateBuilder.withHand(0, [{ templateId: 'water-supporter', type: 'supporter' }])
            ),
            maxSteps: 10
        });

        const energyState = state.energy as any;
        expect(energyState.attachedEnergyByInstance['basic-creature-0'].water).to.equal(1, 'Should attach 1 water energy');
    });

    it('should attach different amounts (2 energy)', () => {
        const testRepository = createSupporterRepo('multi-energy-supporter', 'Multi Energy Supporter', [{
            type: 'energy',
            energyType: 'fire',
            amount: { type: 'constant', value: 2 },
            target: { type: 'fixed', player: 'self', position: 'active' },
            operation: 'attach'
        }]);

        const { state } = runTestGame({
            actions: [new PlayCardResponseMessage('multi-energy-supporter', 'supporter')],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature'),
                StateBuilder.withHand(0, [{ templateId: 'multi-energy-supporter', type: 'supporter' }])
            ),
            maxSteps: 10
        });

        const energyState = state.energy as any;
        expect(energyState.attachedEnergyByInstance['basic-creature-0'].fire).to.equal(2, 'Should attach 2 fire energy');
    });

    it('should target different Pokemon (choice)', () => {
        const testRepository = createSupporterRepo('choice-energy-supporter', 'Choice Energy Supporter', [{
            type: 'energy',
            energyType: 'grass',
            amount: { type: 'constant', value: 1 },
            target: {
                type: 'fixed',
                player: 'self', position: 'active'
            },
            operation: 'attach'
        }]);

        const { state } = runTestGame({
            actions: [new PlayCardResponseMessage('choice-energy-supporter', 'supporter')],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature'),
                StateBuilder.withHand(0, [{ templateId: 'choice-energy-supporter', type: 'supporter' }])
            ),
            maxSteps: 15
        });

        const energyState = state.energy as any;
        expect(energyState.attachedEnergyByInstance['basic-creature-0'].grass).to.equal(1, 'Should attach to active Pokemon');
    });

    it('should cap discard at available energy', () => {
        const testRepository = createSupporterRepo('big-discard-supporter', 'Big Discard Supporter', [{
            type: 'energy',
            energyType: 'fire',
            amount: { type: 'constant', value: 5 },
            target: { type: 'fixed', player: 'opponent', position: 'active' },
            operation: 'discard'
        }]);

        const { state } = runTestGame({
            actions: [new PlayCardResponseMessage('big-discard-supporter', 'supporter')],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature'),
                StateBuilder.withCreatures(1, 'basic-creature'),
                StateBuilder.withHand(0, [{ templateId: 'big-discard-supporter', type: 'supporter' }]),
                StateBuilder.withEnergy('basic-creature-1', { fire: 2 })
            ),
            maxSteps: 10
        });

        const energyState = state.energy as any;
        const opponentActiveEnergy = energyState.attachedEnergyByInstance['basic-creature-1'] || {};
        expect(opponentActiveEnergy.fire || 0).to.equal(0, 'Should discard all available fire energy');
    });

    describe('Energy Discard Tracking', () => {
        it('should track discarded energy from discard effects', () => {
            const testRepository = createSupporterRepo('energy-discard', 'Energy Discard', [{
                type: 'energy',
                energyType: 'fire',
                amount: { type: 'constant', value: 2 },
                target: { type: 'fixed', player: 'opponent', position: 'active' },
                operation: 'discard'
            }]);

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

            const discardedEnergy = state.energy.discardedEnergy[1];
            expect(discardedEnergy.fire).to.equal(2, 'Should discard 2 fire energy from effect');
            expect(discardedEnergy.water).to.equal(0, 'Should not discard water energy');
        });

        it('should track discarded energy when creature is knocked out', () => {
            const testRepository = new MockCardRepository({
                creatures: new Map([
                    ['attacker', { templateId: 'attacker', name: 'Attacker', type: 'fire', maxHp: 100, retreatCost: 1, 
                        weakness: 'water', attacks: [{ name: 'Big Attack', damage: 100, energyRequirements: [] }] }],
                    ['defender', { templateId: 'defender', name: 'Defender', type: 'water', maxHp: 50, retreatCost: 1, 
                        weakness: 'grass', attacks: [] }]
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

            const discardedEnergy = state.energy.discardedEnergy[1];
            expect(discardedEnergy.water).to.equal(2, 'Should discard 2 water energy');
            expect(discardedEnergy.fire).to.equal(1, 'Should discard 1 fire energy');
            expect(getTotalEnergy(discardedEnergy)).to.equal(3, 'Should discard all 3 energy from knocked out creature');
        });
    });
});
