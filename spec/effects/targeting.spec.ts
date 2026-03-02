import { expect } from 'chai';
import { runTestGame } from '../helpers/test-helpers.js';
import { StateBuilder } from '../helpers/state-builder.js';
import { PlayCardResponseMessage } from '../../src/messages/response/play-card-response-message.js';
import { SelectTargetResponseMessage } from '../../src/messages/response/select-target-response-message.js';
import { UseAbilityResponseMessage } from '../../src/messages/response/use-ability-response-message.js';
import { AttackResponseMessage } from '../../src/messages/response/attack-response-message.js';
import { MockCardRepository } from '../mock-repository.js';

describe('Effect Targeting', () => {
    describe('Fixed Targets', () => {
        it('should target self-active creature', () => {
            const testRepository = new MockCardRepository({ supporters: {
                'self-heal-supporter': {
                    templateId: 'self-heal-supporter',
                    name: 'Self Heal Supporter',
                    effects: [{
                        type: 'hp',
                        amount: { type: 'constant', value: 30 },
                        target: { type: 'fixed', player: 'self', position: 'active' },
                        operation: 'heal',
                    }],
                },
            }});

            const { state } = runTestGame({
                actions: [ new PlayCardResponseMessage('self-heal-supporter', 'supporter') ],
                customRepository: testRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature'),
                    StateBuilder.withHand(0, [{ templateId: 'self-heal-supporter', type: 'supporter' }]),
                    StateBuilder.withDamage('basic-creature-0', 50),
                ),
            });

            expect(state.field.creatures[0][0].damageTaken).to.equal(20, 'Should heal 30 damage from self-active');
        });

        it('should target opponent-active creature', () => {
            const testRepository = new MockCardRepository({ supporters: {
                'opponent-damage-supporter': {
                    templateId: 'opponent-damage-supporter',
                    name: 'Opponent Damage Supporter',
                    effects: [{
                        type: 'hp',
                        amount: { type: 'constant', value: 40 },
                        target: { type: 'fixed', player: 'opponent', position: 'active' },
                        operation: 'damage',
                    }],
                },
            }});

            const { state } = runTestGame({
                actions: [ new PlayCardResponseMessage('opponent-damage-supporter', 'supporter') ],
                customRepository: testRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature'),
                    StateBuilder.withCreatures(1, 'basic-creature'),
                    StateBuilder.withHand(0, [{ templateId: 'opponent-damage-supporter', type: 'supporter' }]),
                ),
            });

            expect(state.field.creatures[1][0].damageTaken).to.equal(40, 'Should damage opponent-active');
        });

        it('should target source creature from bench', () => {
            const testRepository = new MockCardRepository({
                creatures: {
                    'bench-healer': {
                        templateId: 'bench-healer',
                        name: 'Bench Healer',
                        maxHp: 80,
                        type: 'colorless',
                        weakness: 'fighting',
                        retreatCost: 1,
                        attacks: [{ name: 'Basic Attack', damage: 20, energyRequirements: [{ type: 'colorless', amount: 1 }] }],
                        ability: {
                            name: 'Self Heal',
                            trigger: { type: 'manual', unlimited: true },
                            effects: [{
                                type: 'hp',
                                amount: { type: 'constant', value: 30 },
                                target: { type: 'fixed', player: 'self', position: 'source' },
                                operation: 'heal',
                            }],
                        },
                    },
                },
            });

            const { state } = runTestGame({
                actions: [ new UseAbilityResponseMessage(1) ],
                customRepository: testRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature', [ 'bench-healer' ]),
                    StateBuilder.withDamage('bench-healer-0-0', 40),
                ),
            });

            expect(state.field.creatures[0][1].damageTaken).to.equal(10, 'Should heal 30 HP from bench creature');
        });
    });

    describe('Single Choice Targets', () => {
        it('should require target selection for single-choice', () => {
            const testRepository = new MockCardRepository({ supporters: {
                'choice-heal-supporter': {
                    templateId: 'choice-heal-supporter',
                    name: 'Choice Heal Supporter',
                    effects: [{
                        type: 'hp',
                        amount: { type: 'constant', value: 50 },
                        target: {
                            type: 'single-choice',
                            chooser: 'self',
                            criteria: { player: 'self', location: 'field' },
                        },
                        operation: 'heal',
                    }],
                },
            }});

            const { state } = runTestGame({
                actions: [
                    new PlayCardResponseMessage('choice-heal-supporter', 'supporter'),
                    new SelectTargetResponseMessage([{ playerId: 0, fieldIndex: 1 }]), // Select bench position 1
                ],
                customRepository: testRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature', [ 'basic-creature' ]),
                    StateBuilder.withHand(0, [{ templateId: 'choice-heal-supporter', type: 'supporter' }]),
                    StateBuilder.withDamage('basic-creature-0-0', 40), // Damage to first bench creature
                ),
            });

            expect(state.field.creatures[0][1].damageTaken).to.equal(0, 'Should heal selected bench creature');
            expect(state.field.creatures[0][0].damageTaken).to.equal(0, 'Active creature should remain undamaged');
        });
    });

    describe('All Matching Targets', () => {
        it('should target all matching creature', () => {
            const testRepository = new MockCardRepository({ supporters: {
                'mass-heal-supporter': {
                    templateId: 'mass-heal-supporter',
                    name: 'Mass Heal Supporter',
                    effects: [{
                        type: 'hp',
                        amount: { type: 'constant', value: 20 },
                        target: {
                            type: 'all-matching',
                            criteria: { player: 'self', location: 'field', fieldCriteria: { hasDamage: true }},
                        },
                        operation: 'heal',
                    }],
                },
            }});

            const { state } = runTestGame({
                actions: [ new PlayCardResponseMessage('mass-heal-supporter', 'supporter') ],
                customRepository: testRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature'),
                    StateBuilder.withHand(0, [{ templateId: 'mass-heal-supporter', type: 'supporter' }]),
                    StateBuilder.withDamage('basic-creature-0', 30),
                    // Add damaged bench creature
                    (state) => {
                        state.field.creatures[0].push({
                            fieldInstanceId: 'test-field-id',
                            evolutionStack: [{ instanceId: 'field-card-1', templateId: 'basic-creature' }],
                            damageTaken: 25,
                            turnLastPlayed: 0,
                        });
                        state.field.creatures[0].push({
                            fieldInstanceId: 'test-field-id-2',
                            evolutionStack: [{ instanceId: 'field-card-2', templateId: 'basic-creature' }],
                            damageTaken: 0,
                            turnLastPlayed: 0,
                        });
                    },
                ),
            });

            expect(state.field.creatures[0][0].damageTaken).to.equal(10, 'Should heal damaged active creature');
            expect(state.field.creatures[0][1].damageTaken).to.equal(5, 'Should heal damaged bench creature');
            expect(state.field.creatures[0][2].damageTaken).to.equal(0, 'Should not heal undamaged creature');
        });
    });

    describe('Scope Filtering', () => {
        it('should filter by self-field scope', () => {
            const testRepository = new MockCardRepository({ supporters: {
                'self-field-supporter': {
                    templateId: 'self-field-supporter',
                    name: 'Self Field Supporter',
                    effects: [{
                        type: 'hp',
                        amount: { type: 'constant', value: 10 },
                        target: {
                            type: 'all-matching',
                            criteria: { player: 'self', location: 'field' },
                        },
                        operation: 'heal',
                    }],
                },
            }});

            const { state } = runTestGame({
                actions: [ new PlayCardResponseMessage('self-field-supporter', 'supporter') ],
                customRepository: testRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature'),
                    StateBuilder.withCreatures(1, 'basic-creature'),
                    StateBuilder.withHand(0, [{ templateId: 'self-field-supporter', type: 'supporter' }]),
                    StateBuilder.withDamage('basic-creature-0', 20),
                    (state) => {
                        state.field.creatures[1][0].damageTaken = 30; 
                    },
                ),
            });

            expect(state.field.creatures[0][0].damageTaken).to.equal(10, 'Should heal own creature');
            expect(state.field.creatures[1][0].damageTaken).to.equal(30, 'Should not heal opponent creature');
        });

        it('should filter by opponent-field scope', () => {
            const testRepository = new MockCardRepository({ supporters: {
                'opponent-field-supporter': {
                    templateId: 'opponent-field-supporter',
                    name: 'Opponent Field Supporter',
                    effects: [{
                        type: 'hp',
                        amount: { type: 'constant', value: 15 },
                        target: {
                            type: 'all-matching',
                            criteria: { player: 'opponent', location: 'field' },
                        },
                        operation: 'damage',
                    }],
                },
            }});

            const { state } = runTestGame({
                actions: [ new PlayCardResponseMessage('opponent-field-supporter', 'supporter') ],
                customRepository: testRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature'),
                    StateBuilder.withCreatures(1, 'basic-creature'),
                    StateBuilder.withHand(0, [{ templateId: 'opponent-field-supporter', type: 'supporter' }]),
                ),
            });

            expect(state.field.creatures[0][0].damageTaken).to.equal(0, 'Should not damage own creature');
            expect(state.field.creatures[1][0].damageTaken).to.equal(15, 'Should damage opponent creature');
        });
    });

    // Multi Choice Targets - TODO: Implement multi-target selection system

    describe('All Matching Targets', () => {
        it('should target all matching creatures automatically', () => {
            const testRepository = new MockCardRepository({ 
                supporters: {
                    'all-bench-damage-supporter': {
                        templateId: 'all-bench-damage-supporter',
                        name: 'All Bench Damage Supporter',
                        effects: [{
                            type: 'hp',
                            amount: { type: 'constant', value: 20 },
                            target: { type: 'fixed', player: 'opponent', position: 'active' },
                            operation: 'damage',
                        }],
                    },
                },
            });

            const { state } = runTestGame({
                actions: [ new PlayCardResponseMessage('all-bench-damage-supporter', 'supporter') ],
                customRepository: testRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature'),
                    StateBuilder.withCreatures(1, 'basic-creature', [ 'high-hp-creature', 'basic-creature' ]),
                    StateBuilder.withHand(0, [{ templateId: 'all-bench-damage-supporter', type: 'supporter' }]),
                ),
            });

            expect(state.field.creatures[1][0].damageTaken).to.equal(20, 'Active creature should take damage');
        });
    });

    describe('Random Targets', () => {
        const randomTargetRepository = new MockCardRepository({
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
                                    type: 'all-matching',
                                    random: true,
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
                                    type: 'all-matching',
                                    random: true,
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
            },
        });

        it('should deal damage to bench creatures picked at random', () => {
            const { state, getExecutedCount } = runTestGame({
                actions: [ new AttackResponseMessage(0) ],
                customRepository: randomTargetRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'random-attacker'),
                    StateBuilder.withCreatures(1, 'benched-creature', [ 'benched-creature', 'benched-creature' ]),
                    StateBuilder.withEnergy('random-attacker-0', { fighting: 1 }),
                    // Available bench = [fieldIndex 1, fieldIndex 2], pool size=2
                    // Picks: 0, 0, 1 → bench[0] ×2 (40 damage), bench[1] ×1 (20 damage)
                    StateBuilder.withMockedRandomSelections([ 0, 0, 1 ]),
                ),
            });

            expect(getExecutedCount()).to.equal(1);
            expect(state.field.creatures[1][1].damageTaken).to.equal(40, 'bench[0] picked twice → 40 damage');
            expect(state.field.creatures[1][2].damageTaken).to.equal(20, 'bench[1] picked once → 20 damage');
        });

        it('should aggregate hits on the same creature so its on-damage trigger fires once', () => {
            const triggerRepository = new MockCardRepository({
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
                                    type: 'all-matching',
                                    random: true,
                                    count: 3,
                                    criteria: { player: 'opponent', location: 'field', position: 'bench' },
                                },
                            }],
                        }],
                    },
                    'counter-creature': {
                        templateId: 'counter-creature',
                        name: 'Counter Creature',
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
                customRepository: triggerRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'trigger-attacker'),
                    // bench[0] = counter-creature with 'damaged' trigger
                    StateBuilder.withCreatures(1, 'counter-creature', [ 'counter-creature' ]),
                    StateBuilder.withEnergy('trigger-attacker-0', { fighting: 1 }),
                    // All 3 picks → bench[0] (fieldIndex 1)
                    StateBuilder.withMockedRandomSelections([ 0, 0, 0 ]),
                ),
            });

            expect(getExecutedCount()).to.equal(1);
            // bench[0] takes 30 damage (3 hits × 10) as one application
            expect(state.field.creatures[1][1].damageTaken).to.equal(30, 'bench[0] takes 30 total damage');
            // trigger fires exactly once → attacker takes 10
            expect(state.field.creatures[0][0].damageTaken).to.equal(10, 'trigger fires once');
        });

        it('should apply all hits to the only benched creature', () => {
            const { state, getExecutedCount } = runTestGame({
                actions: [ new AttackResponseMessage(0) ],
                customRepository: randomTargetRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'random-attacker'),
                    StateBuilder.withCreatures(1, 'benched-creature', [ 'benched-creature' ]),
                    StateBuilder.withEnergy('random-attacker-0', { fighting: 1 }),
                    StateBuilder.withMockedRandomSelections([ 0, 0, 0 ]),
                ),
            });

            expect(getExecutedCount()).to.equal(1);
            expect(state.field.creatures[1][1].damageTaken).to.equal(60, 'sole bench creature takes 60 (3×20) damage');
        });

        it('should spread random damage across active and benched creatures', () => {
            const { state, getExecutedCount } = runTestGame({
                actions: [ new AttackResponseMessage(1) ],
                customRepository: randomTargetRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withTurn(1),
                    StateBuilder.withCreatures(0, 'benched-creature', [ 'benched-creature' ]),
                    StateBuilder.withCreatures(1, 'random-attacker'),
                    StateBuilder.withEnergy('random-attacker-1', { fighting: 1 }),
                    // Triple Strike; picks 0, 1, 0 → active ×2 (20 damage), bench[0] ×1 (10 damage)
                    StateBuilder.withMockedRandomSelections([ 0, 1, 0 ]),
                ),
                playerPosition: 1,
            });

            expect(getExecutedCount()).to.equal(1);
            expect(state.field.creatures[0][0].damageTaken).to.equal(20, 'active takes 20 damage');
            expect(state.field.creatures[0][1].damageTaken).to.equal(10, 'bench[0] takes 10 damage');
        });
    });
});
