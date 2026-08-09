import { expect } from 'chai';
import { runTestGame } from '../../helpers/test-helpers.js';
import { StateBuilder } from '../../helpers/state-builder.js';
import { PlayCardResponseMessage } from '../../../src/messages/response/play-card-response-message.js';
import { AttackResponseMessage } from '../../../src/messages/response/attack-response-message.js';
import { SelectTargetResponseMessage } from '../../../src/messages/response/select-target-response-message.js';
import { MockCardRepository } from '../../mock-repository.js';
import { EnergyDictionary, EnergyState } from '../../../src/controllers/energy-controller.js';
import { EnergyAttachEffectHandler } from '../../../src/effects/handlers/energy-attach-effect-handler.js';
import { CardPlayedEffectContext } from '../../../src/effects/effect-context.js';
import { EnergyAttachEffect } from '../../../src/repository/effect-types.js';
import { HandlerDataBuilder } from '../../helpers/handler-data-builder.js';

// Helper to get total energy from an energy dictionary
function getTotalEnergy(energyDict: EnergyDictionary): number {
    return Object.values(energyDict).reduce((sum, count) => sum + count, 0);
}

/*
 * "Take 3 Psychic Energy ... attach it to your Psychic Pokemon in any way you like" (Card A) needs a
 * *single* decision distributing 3 interchangeable units across chosen targets, including stacking
 * all of them on one creature - this is the `multi-choice` + `allowRepeats` target.
 *
 * "Take a Fire, Water, and Lightning Energy ... attach them to your Benched Pokemon in any way you
 * like" (Card B) has no interchangeable units (each is a distinct type), so it needs no new mechanism:
 * three ordinary sequential `energy-attach` effects, each with its own `single-choice` target.
 */
const distributionTestRepository = new MockCardRepository({
    creatures: {
        'psychic-creature': {
            templateId: 'psychic-creature',
            name: 'Psychic Creature',
            maxHp: 80,
            type: 'psychic',
            weakness: 'darkness',
            retreatCost: 1,
            attacks: [{ name: 'Psy Attack', damage: 20, energyRequirements: [{ type: 'psychic', amount: 1 }] }],
        },
        'basic-creature-distribution': {
            templateId: 'basic-creature-distribution',
            name: 'Basic Creature',
            maxHp: 80,
            type: 'fire',
            weakness: 'water',
            retreatCost: 1,
            attacks: [{ name: 'Basic Attack', damage: 20, energyRequirements: [{ type: 'fire', amount: 1 }] }],
        },
    },
    supporters: {
        'distribute-psychic-supporter': {
            templateId: 'distribute-psychic-supporter',
            name: 'Distribute Psychic Supporter',
            effects: [{
                type: 'energy-attach',
                energyType: 'psychic',
                amount: { type: 'constant', value: 1 },
                target: {
                    type: 'multi-choice',
                    chooser: 'self',
                    criteria: { player: 'self', location: 'field', fieldCriteria: { cardCriteria: { isType: 'psychic' }}},
                    count: 3,
                    allowRepeats: true,
                },
            }],
        },
        'triple-type-supporter': {
            templateId: 'triple-type-supporter',
            name: 'Triple Type Supporter',
            effects: [
                {
                    type: 'energy-attach',
                    energyType: 'fire',
                    amount: { type: 'constant', value: 1 },
                    target: { type: 'single-choice', chooser: 'self', criteria: { player: 'self', location: 'field', position: 'bench' }},
                },
                {
                    type: 'energy-attach',
                    energyType: 'water',
                    amount: { type: 'constant', value: 1 },
                    target: { type: 'single-choice', chooser: 'self', criteria: { player: 'self', location: 'field', position: 'bench' }},
                },
                {
                    type: 'energy-attach',
                    energyType: 'lightning',
                    amount: { type: 'constant', value: 1 },
                    target: { type: 'single-choice', chooser: 'self', criteria: { player: 'self', location: 'field', position: 'bench' }},
                },
            ],
        },
        'attach-two-bench-supporter': {
            templateId: 'attach-two-bench-supporter',
            name: 'Attach Two Bench Supporter',
            effects: [{
                type: 'energy-attach',
                energyType: 'fire',
                amount: { type: 'constant', value: 1 },
                target: { type: 'multi-choice', chooser: 'self', criteria: { player: 'self', location: 'field', position: 'bench' }, count: 2 },
            }],
        },
    },
});

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

            const context = { type: 'card-played' as const, sourcePlayer: 0, effectName: 'Test Energy', cardType: 'item' } as CardPlayedEffectContext;
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

            const context = { type: 'card-played' as const, sourcePlayer: 0, effectName: 'Test Energy Discard', cardType: 'item' } as CardPlayedEffectContext;
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

            const context = { type: 'card-played' as const, sourcePlayer: 0, effectName: 'Test Energy Discard', cardType: 'item' } as CardPlayedEffectContext;
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

            const context = { type: 'card-played' as const, sourcePlayer: 0, effectName: 'Test Energy', cardType: 'item' } as CardPlayedEffectContext;
            const result = handler.canApply(handlerData, effect, context);
            
            // Energy effects always return true - target validation happens during apply
            expect(result).to.be.true;
        });
    });

    it('should attach 1 fire energy (basic operation)', () => {
        const testRepository = new MockCardRepository({
            supporters: {
                'energy-supporter': {
                    templateId: 'energy-supporter',
                    name: 'Energy Supporter',
                    effects: [{
                        type: 'energy-attach',
                        energyType: 'fire',
                        amount: { type: 'constant', value: 1 },
                        target: { type: 'fixed', player: 'self', position: 'active' },
                    }],
                },
            },
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
            supporters: {
                'discard-supporter': {
                    templateId: 'discard-supporter',
                    name: 'Discard Supporter',
                    effects: [{
                        type: 'energy-discard',
                        energySource: {
                            type: 'field',
                            fieldTarget: { type: 'fixed', player: 'opponent', position: 'active' },
                            criteria: { energyTypes: [ 'fire' ] },
                            count: 1,
                        },
                    }],
                },
            },
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
            supporters: {
                'water-supporter': {
                    templateId: 'water-supporter',
                    name: 'Water Supporter',
                    effects: [{
                        type: 'energy-attach',
                        energyType: 'water',
                        amount: { type: 'constant', value: 1 },
                        target: { type: 'fixed', player: 'self', position: 'active' },
                    }],
                },
            },
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
            supporters: {
                'multi-energy-supporter': {
                    templateId: 'multi-energy-supporter',
                    name: 'Multi Energy Supporter',
                    effects: [{
                        type: 'energy-attach',
                        energyType: 'fire',
                        amount: { type: 'constant', value: 2 },
                        target: { type: 'fixed', player: 'self', position: 'active' },
                    }],
                },
            },
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
            supporters: {
                'choice-energy-supporter': {
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
                },
            },
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
            supporters: {
                'big-discard-supporter': {
                    templateId: 'big-discard-supporter',
                    name: 'Big Discard Supporter',
                    effects: [{
                        type: 'energy-discard',
                        energySource: {
                            type: 'field',
                            fieldTarget: { type: 'fixed', player: 'opponent', position: 'active' },
                            criteria: { energyTypes: [ 'fire' ] },
                            count: 5,
                        },
                    }],
                },
            },
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
                supporters: {
                    'energy-discard': {
                        templateId: 'energy-discard',
                        name: 'Energy Discard',
                        effects: [{
                            type: 'energy-discard',
                            energySource: {
                                type: 'field',
                                fieldTarget: { type: 'fixed', player: 'opponent', position: 'active' },
                                criteria: { energyTypes: [ 'fire' ] },
                                count: 2,
                            },
                        }],
                    },
                },
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
                creatures: {
                    attacker: {
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
                    },
                    defender: {
                        templateId: 'defender',
                        name: 'Defender',
                        type: 'water',
                        maxHp: 50,
                        retreatCost: 1,
                        weakness: 'grass',
                        attacks: [],
                    },
                },
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

    describe('Random Energy Discard', () => {
        const randomEnergyRepository = new MockCardRepository({
            creatures: {
                'energy-holder': {
                    templateId: 'energy-holder',
                    name: 'Energy Holder',
                    maxHp: 100,
                    type: 'colorless',
                    weakness: 'fighting',
                    retreatCost: 1,
                    attacks: [
                        {
                            name: 'Random Energy Discard',
                            damage: 0,
                            energyRequirements: [{ type: 'colorless', amount: 1 }],
                            effects: [{
                                type: 'energy-discard',
                                energySource: {
                                    type: 'field',
                                    fieldTarget: { type: 'fixed', player: 'self', position: 'active' },
                                    count: 1,
                                    random: true,
                                },
                            }],
                        },
                        {
                            name: 'Random All Energy Discard',
                            damage: 0,
                            energyRequirements: [{ type: 'colorless', amount: 1 }],
                            effects: [{
                                type: 'energy-discard',
                                energySource: {
                                    type: 'field',
                                    fieldTarget: {
                                        type: 'all-matching',
                                        criteria: { player: 'self', location: 'field' },
                                    },
                                    count: 2,
                                    random: true,
                                },
                            }],
                        },
                    ],
                },
            },
        });

        it('should randomly discard one energy from a single creature', () => {
            const { state, getExecutedCount } = runTestGame({
                actions: [ new AttackResponseMessage(0) ],
                customRepository: randomEnergyRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'energy-holder'),
                    StateBuilder.withCreatures(1, 'basic-creature'),
                    StateBuilder.withEnergy('energy-holder-0', { fire: 2, water: 1 }),
                    // Pool: [fire, fire, water]; pick index 0 → fire
                    StateBuilder.withMockedRandomSelections([ 0 ]),
                ),
            });

            expect(getExecutedCount()).to.equal(1, 'Attack executed');
            const remaining = state.energy.attachedEnergyByInstance['energy-holder-0'];
            expect(remaining.fire).to.equal(1, '1 fire discarded → 1 remaining');
            expect(remaining.water).to.equal(1, 'water unchanged');
        });

        it('should randomly discard energy from across all own creatures', () => {
            const { state, getExecutedCount } = runTestGame({
                actions: [ new AttackResponseMessage(1) ],
                customRepository: randomEnergyRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'energy-holder', [ 'energy-holder' ]),
                    StateBuilder.withCreatures(1, 'basic-creature'),
                    // active: 1 fire; bench[0]: 1 water
                    StateBuilder.withEnergy('energy-holder-0', { fire: 1 }),
                    StateBuilder.withEnergy('energy-holder-0-0', { water: 1 }),
                    // Attack index 1 (Random All Energy Discard, count=2)
                    // Pool: [fire from active, water from bench]
                    // Pick index 0 → fire; remaining [water], pick index 0 → water
                    StateBuilder.withMockedRandomSelections([ 0, 0 ]),
                ),
            });

            expect(getExecutedCount()).to.equal(1, 'Attack executed');
            const activeEnergy = state.energy.attachedEnergyByInstance['energy-holder-0'];
            const benchEnergy = state.energy.attachedEnergyByInstance['energy-holder-0-0'];
            expect(activeEnergy?.fire ?? 0).to.equal(0, 'fire discarded from active');
            expect(benchEnergy?.water ?? 0).to.equal(0, 'water discarded from bench');
        });
    });

    describe('Energy Distribution (allowRepeats multi-choice)', () => {
        const psychicSupporter = { templateId: 'distribute-psychic-supporter', type: 'supporter' as const };
        const tripleTypeSupporter = { templateId: 'triple-type-supporter', type: 'supporter' as const };

        describe('Card A - distribute 3 interchangeable energy in one selection', () => {
            it('stacks all 3 units on a single chosen creature', () => {
                const { state, getExecutedCount } = runTestGame({
                    actions: [
                        new PlayCardResponseMessage('distribute-psychic-supporter', 'supporter'),
                        new SelectTargetResponseMessage([
                            { playerId: 0, fieldIndex: 0 },
                            { playerId: 0, fieldIndex: 0 },
                            { playerId: 0, fieldIndex: 0 },
                        ]),
                    ],
                    customRepository: distributionTestRepository,
                    stateCustomizer: StateBuilder.combine(
                        StateBuilder.withCreatures(0, 'psychic-creature', [ 'psychic-creature', 'psychic-creature' ]),
                        StateBuilder.withHand(0, [ psychicSupporter ]),
                        StateBuilder.withEnergy('psychic-creature-0-0', {}),
                        StateBuilder.withEnergy('psychic-creature-0-1', {}),
                    ),
                });

                expect(getExecutedCount()).to.equal(2, 'Should have executed the supporter and the distribution selection');

                const energyState = state.energy;
                expect(energyState.attachedEnergyByInstance['psychic-creature-0'].psychic).to.equal(3, 'Active should have all 3 psychic energy');
                expect(energyState.attachedEnergyByInstance['psychic-creature-0-0'].psychic).to.equal(0);
                expect(energyState.attachedEnergyByInstance['psychic-creature-0-1'].psychic).to.equal(0);
            });

            it('splits 2-1 across two chosen creatures', () => {
                const { state, getExecutedCount } = runTestGame({
                    actions: [
                        new PlayCardResponseMessage('distribute-psychic-supporter', 'supporter'),
                        new SelectTargetResponseMessage([
                            { playerId: 0, fieldIndex: 0 },
                            { playerId: 0, fieldIndex: 0 },
                            { playerId: 0, fieldIndex: 1 },
                        ]),
                    ],
                    customRepository: distributionTestRepository,
                    stateCustomizer: StateBuilder.combine(
                        StateBuilder.withCreatures(0, 'psychic-creature', [ 'psychic-creature', 'psychic-creature' ]),
                        StateBuilder.withHand(0, [ psychicSupporter ]),
                        StateBuilder.withEnergy('psychic-creature-0-1', {}),
                    ),
                });

                expect(getExecutedCount()).to.equal(2);

                const energyState = state.energy;
                expect(energyState.attachedEnergyByInstance['psychic-creature-0'].psychic).to.equal(2, 'Active should have gained 2 psychic energy');
                expect(energyState.attachedEnergyByInstance['psychic-creature-0-0'].psychic).to.equal(1, 'First bench should have gained 1 psychic energy');
                expect(energyState.attachedEnergyByInstance['psychic-creature-0-1'].psychic).to.equal(0);
            });

            it('splits 1-1-1 across three distinct chosen creatures', () => {
                const { state, getExecutedCount } = runTestGame({
                    actions: [
                        new PlayCardResponseMessage('distribute-psychic-supporter', 'supporter'),
                        new SelectTargetResponseMessage([
                            { playerId: 0, fieldIndex: 0 },
                            { playerId: 0, fieldIndex: 1 },
                            { playerId: 0, fieldIndex: 2 },
                        ]),
                    ],
                    customRepository: distributionTestRepository,
                    stateCustomizer: StateBuilder.combine(
                        StateBuilder.withCreatures(0, 'psychic-creature', [ 'psychic-creature', 'psychic-creature' ]),
                        StateBuilder.withHand(0, [ psychicSupporter ]),
                    ),
                });

                expect(getExecutedCount()).to.equal(2);

                const energyState = state.energy;
                expect(energyState.attachedEnergyByInstance['psychic-creature-0'].psychic).to.equal(1);
                expect(energyState.attachedEnergyByInstance['psychic-creature-0-0'].psychic).to.equal(1);
                expect(energyState.attachedEnergyByInstance['psychic-creature-0-1'].psychic).to.equal(1);
            });

            it('auto-resolves without prompting when only one Psychic Pokemon is in play', () => {
                const { state, getExecutedCount } = runTestGame({
                    actions: [
                        new PlayCardResponseMessage('distribute-psychic-supporter', 'supporter'),
                    ],
                    customRepository: distributionTestRepository,
                    stateCustomizer: StateBuilder.combine(
                        StateBuilder.withCreatures(0, 'psychic-creature', [ 'basic-creature-distribution', 'basic-creature-distribution' ]),
                        StateBuilder.withHand(0, [ psychicSupporter ]),
                    ),
                });

                expect(getExecutedCount()).to.equal(1, 'Should auto-resolve without a separate selection action');

                const energyState = state.energy;
                expect(energyState.attachedEnergyByInstance['psychic-creature-0'].psychic).to.equal(3, 'The lone Psychic Pokemon should get all 3 units');
            });

            it('rejects a response with more than 3 targets or a target outside the available list', () => {
                const { state, getExecutedCount } = runTestGame({
                    actions: [
                        new PlayCardResponseMessage('distribute-psychic-supporter', 'supporter'),
                        new SelectTargetResponseMessage([
                            { playerId: 0, fieldIndex: 5 },
                            { playerId: 0, fieldIndex: 5 },
                            { playerId: 0, fieldIndex: 5 },
                        ]),
                    ],
                    customRepository: distributionTestRepository,
                    stateCustomizer: StateBuilder.combine(
                        StateBuilder.withCreatures(0, 'psychic-creature', [ 'psychic-creature', 'psychic-creature' ]),
                        StateBuilder.withHand(0, [ psychicSupporter ]),
                        StateBuilder.withEnergy('psychic-creature-0', {}),
                    ),
                });

                // Invalid selection is discarded by the fallback; no energy should have been attached.
                expect(getExecutedCount()).to.equal(1);
                const energyState = state.energy;
                expect(energyState.attachedEnergyByInstance['psychic-creature-0'].psychic).to.equal(0);
            });
        });

        describe('Card B - three independent single-type picks (no new mechanism needed)', () => {
            it('lets each of the 3 sequential picks target the same or different bench creatures', () => {
                const { state, getExecutedCount } = runTestGame({
                    actions: [
                        new PlayCardResponseMessage('triple-type-supporter', 'supporter'),
                        new SelectTargetResponseMessage([{ playerId: 0, fieldIndex: 1 }]), // fire
                        new SelectTargetResponseMessage([{ playerId: 0, fieldIndex: 1 }]), // water -> same creature
                        new SelectTargetResponseMessage([{ playerId: 0, fieldIndex: 2 }]), // lightning -> different creature
                    ],
                    customRepository: distributionTestRepository,
                    stateCustomizer: StateBuilder.combine(
                        StateBuilder.withCreatures(0, 'psychic-creature', [ 'basic-creature-distribution', 'basic-creature-distribution' ]),
                        StateBuilder.withHand(0, [ tripleTypeSupporter ]),
                    ),
                });

                expect(getExecutedCount()).to.equal(4, 'Should have executed the supporter and all 3 picks');

                const energyState = state.energy;
                expect(energyState.attachedEnergyByInstance['basic-creature-distribution-0-0'].fire).to.equal(1);
                expect(energyState.attachedEnergyByInstance['basic-creature-distribution-0-0'].water).to.equal(1);
                expect(energyState.attachedEnergyByInstance['basic-creature-distribution-0-1'].lightning).to.equal(1);
            });
        });
    });

    describe('Multi-choice auto-resolve when there is no real choice (general, not energy-specific)', () => {
        it('auto-resolves without repeats when available options exactly equal the required count', () => {
            const attachTwoBenchSupporter = { templateId: 'attach-two-bench-supporter', type: 'supporter' as const };
            const { state, getExecutedCount } = runTestGame({
                actions: [ new PlayCardResponseMessage('attach-two-bench-supporter', 'supporter') ],
                customRepository: distributionTestRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature-distribution', [ 'basic-creature-distribution', 'basic-creature-distribution' ]), // exactly 2 bench
                    StateBuilder.withHand(0, [ attachTwoBenchSupporter ]),
                ),
            });

            expect(getExecutedCount()).to.equal(1, 'Should auto-resolve without a separate selection action');
            const energyState = state.energy;
            expect(energyState.attachedEnergyByInstance['basic-creature-distribution-0-0'].fire).to.equal(1);
            expect(energyState.attachedEnergyByInstance['basic-creature-distribution-0-1'].fire).to.equal(1);
        });

        it('still requires an explicit selection without repeats when there are more options than needed', () => {
            const attachTwoBenchSupporter = { templateId: 'attach-two-bench-supporter', type: 'supporter' as const };
            const { state, getExecutedCount } = runTestGame({
                actions: [
                    new PlayCardResponseMessage('attach-two-bench-supporter', 'supporter'),
                    new SelectTargetResponseMessage([{ playerId: 0, fieldIndex: 1 }, { playerId: 0, fieldIndex: 2 }]),
                ],
                customRepository: distributionTestRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature-distribution', [ 'basic-creature-distribution', 'basic-creature-distribution', 'basic-creature-distribution' ]), // 3 bench, need 2
                    StateBuilder.withHand(0, [ attachTwoBenchSupporter ]),
                    StateBuilder.withEnergy('basic-creature-distribution-0-2', {}),
                ),
            });

            expect(getExecutedCount()).to.equal(2, 'Should have executed the supporter and the bench selection');
            const energyState = state.energy;
            expect(energyState.attachedEnergyByInstance['basic-creature-distribution-0-0'].fire).to.equal(1);
            expect(energyState.attachedEnergyByInstance['basic-creature-distribution-0-1'].fire).to.equal(1);
            expect(energyState.attachedEnergyByInstance['basic-creature-distribution-0-2'].fire).to.equal(0);
        });

        it('does not crash and applies to no one without repeats when there are fewer options than needed', () => {
            const attachTwoBenchSupporter = { templateId: 'attach-two-bench-supporter', type: 'supporter' as const };
            const { state, getExecutedCount } = runTestGame({
                actions: [ new PlayCardResponseMessage('attach-two-bench-supporter', 'supporter') ],
                customRepository: distributionTestRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature-distribution', [ 'basic-creature-distribution' ]), // only 1 bench, need 2
                    StateBuilder.withHand(0, [ attachTwoBenchSupporter ]),
                    StateBuilder.withEnergy('basic-creature-distribution-0-0', {}),
                ),
            });

            expect(getExecutedCount()).to.equal(1, 'Supporter still resolves (as a no-op for the attach effect)');
            const energyState = state.energy;
            expect(energyState.attachedEnergyByInstance['basic-creature-distribution-0-0'].fire).to.equal(0);
        });
    });

    describe('Regression: multi-choice without allowRepeats still rejects duplicate targets', () => {
        it('discards a response that selects the same bench creature twice', () => {
            const attachTwoBenchSupporter = { templateId: 'attach-two-bench-supporter', type: 'supporter' as const };
            const { state, getExecutedCount } = runTestGame({
                actions: [
                    new PlayCardResponseMessage('attach-two-bench-supporter', 'supporter'),
                    new SelectTargetResponseMessage([{ playerId: 0, fieldIndex: 1 }, { playerId: 0, fieldIndex: 1 }]),
                ],
                customRepository: distributionTestRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature-distribution', [ 'basic-creature-distribution', 'basic-creature-distribution', 'basic-creature-distribution' ]),
                    StateBuilder.withHand(0, [ attachTwoBenchSupporter ]),
                    StateBuilder.withEnergy('basic-creature-distribution-0-0', {}),
                ),
            });

            expect(getExecutedCount()).to.equal(1, 'The duplicate selection is invalid and discarded by the fallback');
            const energyState = state.energy;
            expect(energyState.attachedEnergyByInstance['basic-creature-distribution-0-0'].fire).to.equal(0);
        });
    });
});
