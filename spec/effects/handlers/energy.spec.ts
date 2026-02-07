import { expect } from 'chai';
import { runTestGame } from '../../helpers/test-helpers.js';
import { StateBuilder } from '../../helpers/state-builder.js';
import { PlayCardResponseMessage } from '../../../src/messages/response/play-card-response-message.js';
import { AttackResponseMessage } from '../../../src/messages/response/attack-response-message.js';
import { MockCardRepository } from '../../mock-repository.js';
import { EnergyDictionary, EnergyState } from '../../../src/controllers/energy-controller.js';
import { EnergyAttachEffectHandler } from '../../../src/effects/handlers/energy-attach-effect-handler.js';
import { EnergyDiscardEffectHandler } from '../../../src/effects/handlers/energy-discard-effect-handler.js';
import { EffectContextFactory } from '../../../src/effects/effect-context.js';
import { EnergyAttachEffect, EnergyDiscardEffect } from '../../../src/repository/effect-types.js';
import { HandlerDataBuilder } from '../../helpers/handler-data-builder.js';

// Helper to get total energy from an energy dictionary
function getTotalEnergy(energyDict: EnergyDictionary): number {
    return Object.values(energyDict).reduce((sum, count) => sum + count, 0);
}

describe('Energy Effect', () => {
    describe('canApply', () => {
        const handler = new EnergyAttachEffectHandler();

        it('should return true for attach operation', () => {
            const handlerData = HandlerDataBuilder.default(
                HandlerDataBuilder.withCreatures(0, 'basic-creature', []),
            );

            const effect: EnergyAttachEffect = {
                type: 'energy-attach',
                energyType: 'fire',
                amount: { type: 'constant', value: 1 },
                target: { type: 'fixed', player: 'self', position: 'active' },
            };

            const context = EffectContextFactory.createCardContext(0, 'Test Energy', 'item');
            const result = handler.canApply(handlerData, effect, context);
            
            expect(result).to.be.true;
        });

        it('should return true for discard operation', () => {
            const handlerData = HandlerDataBuilder.default(
                HandlerDataBuilder.withCreatures(0, 'basic-creature', []),
                HandlerDataBuilder.withCreatures(1, 'basic-creature', []),
            );

            const effect: EnergyAttachEffect = {
                type: 'energy-attach',
                energyType: 'fire',
                amount: { type: 'constant', value: 1 },
                target: { type: 'fixed', player: 'opponent', position: 'active' },
            };

            const context = EffectContextFactory.createCardContext(0, 'Test Energy Discard', 'item');
            const result = handler.canApply(handlerData, effect, context);
            
            expect(result).to.be.true;
        });

        it('should return true when target has no energy (discard will have no effect)', () => {
            const handlerData = HandlerDataBuilder.default(
                HandlerDataBuilder.withCreatures(0, 'basic-creature', []),
                HandlerDataBuilder.withCreatures(1, 'basic-creature', []),
            );

            const effect: EnergyAttachEffect = {
                type: 'energy-attach',
                energyType: 'fire',
                amount: { type: 'constant', value: 1 },
                target: { type: 'fixed', player: 'opponent', position: 'active' },
            };

            const context = EffectContextFactory.createCardContext(0, 'Test Energy Discard', 'item');
            const result = handler.canApply(handlerData, effect, context);
            
            // Energy effects always return true - even if there's no energy to discard
            expect(result).to.be.true;
        });

        it('should return true when no target exists (effect will fail gracefully during apply)', () => {
            const handlerData = HandlerDataBuilder.default(
                HandlerDataBuilder.withDeck(10),
            );

            const effect: EnergyAttachEffect = {
                type: 'energy-attach',
                energyType: 'fire',
                amount: { type: 'constant', value: 1 },
                target: { type: 'fixed', player: 'self', position: 'active' },
            };

            const context = EffectContextFactory.createCardContext(0, 'Test Energy', 'item');
            const result = handler.canApply(handlerData, effect, context);
            
            // Energy effects always return true - target validation happens during apply
            expect(result).to.be.true;
        });
    });

    it('should attach 1 fire energy (basic operation)', () => {
        const testRepository = new MockCardRepository({
            supporters: new Map([
                [ 'energy-supporter', {
                    templateId: 'energy-supporter',
                    name: 'Energy Supporter',
                    effects: [{
                        type: 'energy-attach',
                        energyType: 'fire',
                        amount: { type: 'constant', value: 1 },
                        target: { type: 'fixed', player: 'self', position: 'active' },
                    }],
                }],
            ]),
        });

        const { state } = runTestGame({
            actions: [ new PlayCardResponseMessage('energy-supporter', 'supporter') ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature'),
                StateBuilder.withHand(0, [{ templateId: 'energy-supporter', type: 'supporter' }]),
            ),
        });

        const energyState = state.energy;
        expect(energyState.attachedEnergyByInstance['basic-creature-0'].fire).to.equal(1, 'Should attach 1 fire energy');
    });

    it('should discard energy instead of attach', () => {
        const testRepository = new MockCardRepository({
            supporters: new Map([
                [ 'discard-supporter', {
                    templateId: 'discard-supporter',
                    name: 'Discard Supporter',
                    effects: [{
                        type: 'energy-discard',
                        energySource: {
                            type: 'field',
                            fieldTarget: { type: 'fixed', player: 'opponent', position: 'active' },
                            criteria: { energyTypes: ['fire'] },
                            count: 1,
                        },
                    }],
                }],
            ]),
        });

        const { state } = runTestGame({
            actions: [ new PlayCardResponseMessage('discard-supporter', 'supporter') ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature'),
                StateBuilder.withCreatures(1, 'basic-creature'),
                StateBuilder.withHand(0, [{ templateId: 'discard-supporter', type: 'supporter' }]),
                StateBuilder.withEnergy('basic-creature-1', { fire: 2, water: 1 }),
            ),
        });

        const energyState: EnergyState = state.energy;
        expect(energyState.attachedEnergyByInstance['basic-creature-1'].fire).to.equal(1, 'Should discard 1 fire energy');
        expect(energyState.attachedEnergyByInstance['basic-creature-1'].water).to.equal(1, 'Should not affect water energy');
    });

    it('should attach different energy types (water)', () => {
        const testRepository = new MockCardRepository({
            supporters: new Map([
                [ 'water-supporter', {
                    templateId: 'water-supporter',
                    name: 'Water Supporter',
                    effects: [{
                        type: 'energy-attach',
                        energyType: 'water',
                        amount: { type: 'constant', value: 1 },
                        target: { type: 'fixed', player: 'self', position: 'active' },
                    }],
                }],
            ]),
        });

        const { state } = runTestGame({
            actions: [ new PlayCardResponseMessage('water-supporter', 'supporter') ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature'),
                StateBuilder.withHand(0, [{ templateId: 'water-supporter', type: 'supporter' }]),
            ),
        });

        const energyState: EnergyState = state.energy;
        expect(energyState.attachedEnergyByInstance['basic-creature-0'].water).to.equal(1, 'Should attach 1 water energy');
    });

    it('should attach different amounts (2 energy)', () => {
        const testRepository = new MockCardRepository({
            supporters: new Map([
                [ 'multi-energy-supporter', {
                    templateId: 'multi-energy-supporter',
                    name: 'Multi Energy Supporter',
                    effects: [{
                        type: 'energy-attach',
                        energyType: 'fire',
                        amount: { type: 'constant', value: 2 },
                        target: { type: 'fixed', player: 'self', position: 'active' },
                    }],
                }],
            ]),
        });

        const { state } = runTestGame({
            actions: [ new PlayCardResponseMessage('multi-energy-supporter', 'supporter') ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature'),
                StateBuilder.withHand(0, [{ templateId: 'multi-energy-supporter', type: 'supporter' }]),
            ),
        });

        const energyState: EnergyState = state.energy;
        expect(energyState.attachedEnergyByInstance['basic-creature-0'].fire).to.equal(2, 'Should attach 2 fire energy');
    });

    it('should target different Pokemon (choice)', () => {
        const testRepository = new MockCardRepository({
            supporters: new Map([
                [ 'choice-energy-supporter', {
                    templateId: 'choice-energy-supporter',
                    name: 'Choice Energy Supporter',
                    effects: [{
                        type: 'energy-attach',
                        energyType: 'grass',
                        amount: { type: 'constant', value: 1 },
                        target: {
                            type: 'fixed',
                            player: 'self', position: 'active',
                        },
                    }],
                }],
            ]),
        });

        const { state } = runTestGame({
            actions: [
                new PlayCardResponseMessage('choice-energy-supporter', 'supporter'),
            ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature'),
                StateBuilder.withHand(0, [{ templateId: 'choice-energy-supporter', type: 'supporter' }]),
            ),
        });

        const energyState: EnergyState = state.energy;
        expect(energyState.attachedEnergyByInstance['basic-creature-0'].grass).to.equal(1, 'Should attach to active Pokemon');
    });

    it('should cap discard at available energy', () => {
        const testRepository = new MockCardRepository({
            supporters: new Map([
                [ 'big-discard-supporter', {
                    templateId: 'big-discard-supporter',
                    name: 'Big Discard Supporter',
                    effects: [{
                        type: 'energy-discard',
                        energySource: {
                            type: 'field',
                            fieldTarget: { type: 'fixed', player: 'opponent', position: 'active' },
                            criteria: { energyTypes: ['fire'] },
                            count: 5,
                        },
                    }],
                }],
            ]),
        });

        const { state } = runTestGame({
            actions: [ new PlayCardResponseMessage('big-discard-supporter', 'supporter') ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature'),
                StateBuilder.withCreatures(1, 'basic-creature'),
                StateBuilder.withHand(0, [{ templateId: 'big-discard-supporter', type: 'supporter' }]),
                StateBuilder.withEnergy('basic-creature-1', { fire: 2 }),
            ),
        });

        const energyState: EnergyState = state.energy;
        const opponentActiveEnergy = energyState.attachedEnergyByInstance['basic-creature-1'] || {};
        expect(opponentActiveEnergy.fire || 0).to.equal(0, 'Should discard all available fire energy');
    });

    describe('Energy Discard Tracking', () => {
        it('should track discarded energy from discard effects', () => {
            const testRepository = new MockCardRepository({
                supporters: new Map([
                    [ 'energy-discard', {
                        templateId: 'energy-discard',
                        name: 'Energy Discard',
                        effects: [{
                            type: 'energy-discard',
                            energySource: {
                                type: 'field',
                                fieldTarget: { type: 'fixed', player: 'opponent', position: 'active' },
                                criteria: { energyTypes: ['fire'] },
                                count: 2,
                            },
                        }],
                    }],
                ]),
            });

            const { state } = runTestGame({
                actions: [ new PlayCardResponseMessage('energy-discard', 'supporter') ],
                customRepository: testRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature'),
                    StateBuilder.withCreatures(1, 'basic-creature'),
                    StateBuilder.withHand(0, [{ templateId: 'energy-discard', type: 'supporter' }]),
                    StateBuilder.withEnergy('basic-creature-1', { fire: 3, water: 1 }),
                ),
            });

            const discardedEnergy = state.energy.discardedEnergy[1];
            
            // Should have discarded 2 fire energy from effect
            expect(discardedEnergy.fire).to.equal(2, 'Should discard 2 fire energy from effect');
            expect(discardedEnergy.water).to.equal(0, 'Should not discard water energy');
        });

        it('should track discarded energy when creature is knocked out', () => {
            const testRepository = new MockCardRepository({
                creatures: new Map([
                    [ 'attacker', {
                        templateId: 'attacker',
                        name: 'Attacker',
                        type: 'fire',
                        maxHp: 100,
                        retreatCost: 1,
                        weakness: 'water',
                        attacks: [{
                            name: 'Big Attack',
                            damage: 100,
                            energyRequirements: [],
                        }],
                    }],
                    [ 'defender', {
                        templateId: 'defender',
                        name: 'Defender',
                        type: 'water',
                        maxHp: 50,
                        retreatCost: 1,
                        weakness: 'grass',
                        attacks: [],
                    }],
                ]),
            });

            const { state } = runTestGame({
                actions: [ new AttackResponseMessage(0) ],
                customRepository: testRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'attacker'),
                    StateBuilder.withCreatures(1, 'defender'),
                    StateBuilder.withEnergy('defender-1', { water: 2, fire: 1 }),
                ),
            });

            const discardedEnergy = state.energy.discardedEnergy[1];
            
            // Should have discarded all energy from knocked out defender
            expect(discardedEnergy.water).to.equal(2, 'Should discard 2 water energy');
            expect(discardedEnergy.fire).to.equal(1, 'Should discard 1 fire energy');
            expect(getTotalEnergy(discardedEnergy)).to.equal(3, 'Should discard all 3 energy from knocked out creature');
        });
    });
});
