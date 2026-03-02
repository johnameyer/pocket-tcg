import { expect } from 'chai';
import { AttackResponseMessage } from '../../../src/messages/response/attack-response-message.js';
import { EndTurnResponseMessage } from '../../../src/messages/response/end-turn-response-message.js';
import { StateBuilder } from '../../helpers/state-builder.js';
import { runTestGame } from '../../helpers/test-helpers.js';
import { MockCardRepository } from '../../mock-repository.js';

const testRepository = new MockCardRepository({
    creatures: {
        'random-attacker': {
            templateId: 'random-attacker',
            name: 'Random Attacker',
            maxHp: 100,
            type: 'fighting',
            weakness: 'psychic',
            retreatCost: 1,
            attacks: [
                {
                    name: 'Scatter Shot',
                    damage: 0,
                    energyRequirements: [{ type: 'fighting', amount: 1 }],
                    effects: [{
                        type: 'hp',
                        operation: 'damage',
                        amount: { type: 'constant', value: 20 },
                        target: {
                            type: 'random-pick',
                            count: 3,
                            criteria: { player: 'opponent', location: 'field', position: 'bench' },
                        },
                    }],
                },
                {
                    name: 'Triple Strike',
                    damage: 0,
                    energyRequirements: [{ type: 'fighting', amount: 1 }],
                    effects: [{
                        type: 'hp',
                        operation: 'damage',
                        amount: { type: 'constant', value: 10 },
                        target: {
                            type: 'random-pick',
                            count: 3,
                            criteria: { player: 'opponent', location: 'field' },
                        },
                    }],
                },
            ],
        },
        'benched-creature': {
            templateId: 'benched-creature',
            name: 'Benched Creature',
            maxHp: 80,
            type: 'colorless',
            weakness: 'fighting',
            retreatCost: 1,
            attacks: [{ name: 'Smack', damage: 10, energyRequirements: [{ type: 'colorless', amount: 1 }] }],
        },
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

describe('Random Target Selection', () => {
    describe('random-pick field target (bench damage)', () => {
        it('should deal 20 damage to bench creature picked by random', () => {
            const { state, getExecutedCount } = runTestGame({
                actions: [ new AttackResponseMessage(0) ],
                customRepository: testRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'random-attacker'),
                    StateBuilder.withCreatures(1, 'benched-creature', [ 'benched-creature', 'benched-creature' ]),
                    StateBuilder.withEnergy('random-attacker-0', { fighting: 1 }),
                    // Pick: bench[0] (index 0), bench[0] (index 0), bench[1] (index 1)
                    // bench targets are fieldIndex 1 and 2 of player 1
                    // Available bench = [fieldIndex 1, fieldIndex 2], so pool size=2
                    // Picks: index 0, index 0, index 1 → bench[0] x2 (40dmg), bench[1] x1 (20dmg)
                    StateBuilder.withMockedRandomSelections([ 0, 0, 1 ]),
                ),
            });

            expect(getExecutedCount()).to.equal(1);
            // bench[0] (fieldIndex 1) picked twice → 40 damage
            expect(state.field.creatures[1][1].damageTaken).to.equal(40);
            // bench[1] (fieldIndex 2) picked once → 20 damage
            expect(state.field.creatures[1][2].damageTaken).to.equal(20);
        });

        it('should aggregate damage on same bench creature so trigger fires once', () => {
            const repository = new MockCardRepository({
                creatures: {
                    'trigger-attacker': {
                        templateId: 'trigger-attacker',
                        name: 'Trigger Attacker',
                        maxHp: 100,
                        type: 'fighting',
                        weakness: 'psychic',
                        retreatCost: 1,
                        attacks: [{
                            name: 'Random Hit',
                            damage: 0,
                            energyRequirements: [{ type: 'fighting', amount: 1 }],
                            effects: [{
                                type: 'hp',
                                operation: 'damage',
                                amount: { type: 'constant', value: 10 },
                                target: {
                                    type: 'random-pick',
                                    count: 3,
                                    criteria: { player: 'opponent', location: 'field', position: 'bench' },
                                },
                            }],
                        }],
                    },
                    'trigger-target': {
                        templateId: 'trigger-target',
                        name: 'Trigger Target',
                        maxHp: 100,
                        type: 'colorless',
                        weakness: 'fighting',
                        retreatCost: 1,
                        attacks: [{ name: 'Smack', damage: 10, energyRequirements: [{ type: 'colorless', amount: 1 }] }],
                        ability: {
                            name: 'Counter Damage',
                            trigger: { type: 'damaged' },
                            effects: [{
                                type: 'hp',
                                operation: 'damage',
                                amount: { type: 'constant', value: 10 },
                                target: { type: 'contextual', reference: 'attacker' },
                            }],
                        },
                    },
                },
            });

            const { state, getExecutedCount } = runTestGame({
                actions: [ new AttackResponseMessage(0) ],
                customRepository: repository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'trigger-attacker'),
                    // Active = trigger-target, bench[0] = trigger-target (has counter-damage ability)
                    StateBuilder.withCreatures(1, 'trigger-target', [ 'trigger-target' ]),
                    StateBuilder.withEnergy('trigger-attacker-0', { fighting: 1 }),
                    // bench[0] (fieldIndex 1) = trigger-target; all 3 picks → fieldIndex 1
                    StateBuilder.withMockedRandomSelections([ 0, 0, 0 ]),
                ),
            });

            expect(getExecutedCount()).to.equal(1);
            // trigger-target bench (fieldIndex 1) should take 30 damage (3 hits × 10) applied as one
            expect(state.field.creatures[1][1].damageTaken).to.equal(30);
            // trigger fires once → attacker takes 10 damage
            expect(state.field.creatures[0][0].damageTaken).to.equal(10);
        });

        it('should handle random-pick when only one benched creature exists', () => {
            const { state, getExecutedCount } = runTestGame({
                actions: [ new AttackResponseMessage(0) ],
                customRepository: testRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'random-attacker'),
                    StateBuilder.withCreatures(1, 'benched-creature', [ 'benched-creature' ]),
                    StateBuilder.withEnergy('random-attacker-0', { fighting: 1 }),
                    // Only one bench target, all 3 picks → same creature
                    StateBuilder.withMockedRandomSelections([ 0, 0, 0 ]),
                ),
            });

            expect(getExecutedCount()).to.equal(1);
            // Sole bench creature takes 60 damage (3 hits × 20)
            expect(state.field.creatures[1][1].damageTaken).to.equal(60);
        });

        it('should spread random damage across active and bench creatures', () => {
            const { state, getExecutedCount } = runTestGame({
                actions: [ new AttackResponseMessage(1) ],
                customRepository: testRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withTurn(1),
                    StateBuilder.withCreatures(0, 'benched-creature', [ 'benched-creature' ]),
                    StateBuilder.withCreatures(1, 'random-attacker'),
                    StateBuilder.withEnergy('random-attacker-1', { fighting: 1 }),
                    // Triple Strike (attack index 1) targets all opponent field (active=0 + bench[0]=1)
                    // Picks: 0, 1, 0 → active x2 (20dmg), bench[0] x1 (10dmg)
                    StateBuilder.withMockedRandomSelections([ 0, 1, 0 ]),
                ),
                playerPosition: 1,
            });

            expect(getExecutedCount()).to.equal(1);
            // active (fieldIndex 0) → 20 damage
            expect(state.field.creatures[0][0].damageTaken).to.equal(20);
            // bench[0] (fieldIndex 1) → 10 damage
            expect(state.field.creatures[0][1].damageTaken).to.equal(10);
        });
    });

    describe('random energy discard', () => {
        it('should randomly discard energy from a single creature', () => {
            const { state, getExecutedCount } = runTestGame({
                actions: [ new AttackResponseMessage(0) ],
                customRepository: testRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'energy-holder'),
                    StateBuilder.withCreatures(1, 'benched-creature'),
                    StateBuilder.withEnergy('energy-holder-0', { fire: 2, water: 1 }),
                    // Pick index 0 from pool [fire, fire, water] → fire
                    StateBuilder.withMockedRandomSelections([ 0 ]),
                ),
            });

            expect(getExecutedCount()).to.equal(1);
            // 1 fire energy should be discarded
            const remaining = state.energy.attachedEnergyByInstance['energy-holder-0'];
            expect(remaining.fire).to.equal(1);
            expect(remaining.water).to.equal(1);
        });

        it('should randomly discard energy from across all own creatures', () => {
            const { state, getExecutedCount } = runTestGame({
                actions: [ new AttackResponseMessage(1) ],
                customRepository: testRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'energy-holder', [ 'energy-holder' ]),
                    StateBuilder.withCreatures(1, 'benched-creature'),
                    // active: 1 fire; bench[0]: 1 water
                    StateBuilder.withEnergy('energy-holder-0', { fire: 1 }),
                    StateBuilder.withEnergy('energy-holder-0-0', { water: 1 }),
                    // Attack index 1 = Random All Energy Discard (count=2)
                    // Pool: [fire from active, water from bench]; picks index 0 then index 0 of remaining
                    StateBuilder.withMockedRandomSelections([ 0, 0 ]),
                ),
            });

            expect(getExecutedCount()).to.equal(1);
            // Both energy should be discarded
            const activeEnergy = state.energy.attachedEnergyByInstance['energy-holder-0'];
            const benchEnergy = state.energy.attachedEnergyByInstance['energy-holder-0-0'];
            expect((activeEnergy?.fire ?? 0)).to.equal(0);
            expect((benchEnergy?.water ?? 0)).to.equal(0);
        });
    });
});
