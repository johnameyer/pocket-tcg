import { expect } from 'chai';
import { runTestGame } from '../helpers/test-helpers.js';
import { StateBuilder } from '../helpers/state-builder.js';
import { PlayCardResponseMessage } from '../../src/messages/response/play-card-response-message.js';
import { SelectTargetResponseMessage } from '../../src/messages/response/select-target-response-message.js';
import { UseAbilityResponseMessage } from '../../src/messages/response/use-ability-response-message.js';
import { MockCardRepository } from '../mock-repository.js';
import { SupporterData } from '../../src/repository/card-types.js';

describe('Effect Targeting', () => {
    describe('Fixed Targets', () => {
        it('should target self-active creature', () => {
            const testRepository = new MockCardRepository({ supporters: new Map([
                ['self-heal-supporter', {
                    templateId: 'self-heal-supporter',
                    name: 'Self Heal Supporter',
                    effects: [{
                        type: 'hp',
                        amount: { type: 'constant', value: 30 },
                        target: { type: 'fixed', player: 'self', position: 'active' },
                        operation: 'heal'
                    }]
                }]
            ]) });

            const { state } = runTestGame({
                actions: [new PlayCardResponseMessage('self-heal-supporter', 'supporter')],
                customRepository: testRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature'),
                    StateBuilder.withHand(0, [{ templateId: 'self-heal-supporter', type: 'supporter' }]),
                    StateBuilder.withDamage('basic-creature-0', 50)
                ),
                maxSteps: 10
            });

            expect(state.field.creatures[0][0].damageTaken).to.equal(20, 'Should heal 30 damage from self-active');
        });

        it('should target opponent-active creature', () => {
            const testRepository = new MockCardRepository({ supporters: new Map([
                ['opponent-damage-supporter', {
                    templateId: 'opponent-damage-supporter',
                    name: 'Opponent Damage Supporter',
                    effects: [{
                        type: 'hp',
                        amount: { type: 'constant', value: 40 },
                        target: { type: 'fixed', player: 'opponent', position: 'active' },
                        operation: 'damage'
                    }]
                }]
            ]) });

            const { state } = runTestGame({
                actions: [new PlayCardResponseMessage('opponent-damage-supporter', 'supporter')],
                customRepository: testRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature'),
                    StateBuilder.withCreatures(1, 'basic-creature'),
                    StateBuilder.withHand(0, [{ templateId: 'opponent-damage-supporter', type: 'supporter' }])
                ),
                maxSteps: 10
            });

            expect(state.field.creatures[1][0].damageTaken).to.equal(40, 'Should damage opponent-active');
        });

        it('should target source creature from bench', () => {
            const testRepository = new MockCardRepository({
                creatures: new Map([
                    ['bench-healer', {
                        templateId: 'bench-healer',
                        name: 'Bench Healer',
                        maxHp: 80,
                        type: 'colorless',
                        weakness: 'fighting',
                        retreatCost: 1,
                        attacks: [{ name: 'Basic Attack', damage: 20, energyRequirements: [{ type: 'colorless', amount: 1 }] }],
                        abilities: [{
                            name: 'Self Heal',
                            trigger: { type: 'manual', unlimited: true },
                            effects: [{
                                type: 'hp',
                                amount: { type: 'constant', value: 30 },
                                target: { type: 'fixed', player: 'self', position: 'source' },
                                operation: 'heal'
                            }]
                        }]
                    }]
                ])
            });

            const { state } = runTestGame({
                actions: [new UseAbilityResponseMessage(0, 1)],
                customRepository: testRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature', ['bench-healer']),
                    StateBuilder.withDamage('bench-healer-0-0', 40)
                )
            });

            expect(state.field.creatures[0][1].damageTaken).to.equal(10, 'Should heal 30 HP from bench creature');
        });
    });

    describe('Single Choice Targets', () => {
        it('should require target selection for single-choice', () => {
            const testRepository = new MockCardRepository({ supporters: new Map([
                ['choice-heal-supporter', {
                    templateId: 'choice-heal-supporter',
                    name: 'Choice Heal Supporter',
                    effects: [{
                        type: 'hp',
                        amount: { type: 'constant', value: 50 },
                        target: {
                            type: 'single-choice',
                            chooser: 'self',
                            criteria: { player: 'self', location: 'field' }
                        },
                        operation: 'heal'
                    }]
                }]
            ]) });

            const { state } = runTestGame({
                actions: [
                    new PlayCardResponseMessage('choice-heal-supporter', 'supporter'),
                    new SelectTargetResponseMessage(0, 1) // Select bench position 1
                ],
                customRepository: testRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature', ['basic-creature']),
                    StateBuilder.withHand(0, [{ templateId: 'choice-heal-supporter', type: 'supporter' }]),
                    StateBuilder.withDamage('basic-creature-0-0', 40) // Damage to first bench creature
                ),
                maxSteps: 15
            });

            expect(state.field.creatures[0][1].damageTaken).to.equal(0, 'Should heal selected bench creature');
            expect(state.field.creatures[0][0].damageTaken).to.equal(0, 'Active creature should remain undamaged');
        });
    });

    describe('All Matching Targets', () => {
        it('should target all matching creature', () => {
            const testRepository = new MockCardRepository({ supporters: new Map([
                ['mass-heal-supporter', {
                    templateId: 'mass-heal-supporter',
                    name: 'Mass Heal Supporter',
                    effects: [{
                        type: 'hp',
                        amount: { type: 'constant', value: 20 },
                        target: {
                            type: 'all-matching',
                            criteria: { player: 'self', location: 'field', condition: { hasDamage: true } }
                        },
                        operation: 'heal'
                    }]
                }]
            ]) });

            const { state } = runTestGame({
                actions: [new PlayCardResponseMessage('mass-heal-supporter', 'supporter')],
                customRepository: testRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature'),
                    StateBuilder.withHand(0, [{ templateId: 'mass-heal-supporter', type: 'supporter' }]),
                    StateBuilder.withDamage('basic-creature-0', 30),
                    // Add damaged bench creature
                    (state) => {
                        state.field.creatures[0].push({
                            instanceId: "field-card-1", damageTaken: 25, templateId: 'basic-creature',
                        });
                        state.field.creatures[0].push({
                            instanceId: "field-card-2", damageTaken: 0, templateId: 'basic-creature', // Not damaged
                        });
                    }
                ),
                maxSteps: 10
            });

            expect(state.field.creatures[0][0].damageTaken).to.equal(10, 'Should heal damaged active creature');
            expect(state.field.creatures[0][1].damageTaken).to.equal(5, 'Should heal damaged bench creature');
            expect(state.field.creatures[0][2].damageTaken).to.equal(0, 'Should not heal undamaged creature');
        });
    });

    describe('Scope Filtering', () => {
        it('should filter by self-field scope', () => {
            const testRepository = new MockCardRepository({ supporters: new Map([
                ['self-field-supporter', {
                    templateId: 'self-field-supporter',
                    name: 'Self Field Supporter',
                    effects: [{
                        type: 'hp',
                        amount: { type: 'constant', value: 10 },
                        target: {
                            type: 'all-matching',
                            criteria: { player: 'self', location: 'field' }
                        },
                        operation: 'heal'
                    }]
                }]
            ]) });

            const { state } = runTestGame({
                actions: [new PlayCardResponseMessage('self-field-supporter', 'supporter')],
                customRepository: testRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature'),
                    StateBuilder.withCreatures(1, 'basic-creature'),
                    StateBuilder.withHand(0, [{ templateId: 'self-field-supporter', type: 'supporter' }]),
                    StateBuilder.withDamage('basic-creature-0', 20),
                    (state) => { state.field.creatures[1][0].damageTaken = 30; }
                ),
                maxSteps: 10
            });

            expect(state.field.creatures[0][0].damageTaken).to.equal(10, 'Should heal own creature');
            expect(state.field.creatures[1][0].damageTaken).to.equal(30, 'Should not heal opponent creature');
        });

        it('should filter by opponent-field scope', () => {
            const testRepository = new MockCardRepository({ supporters: new Map([
                ['opponent-field-supporter', {
                    templateId: 'opponent-field-supporter',
                    name: 'Opponent Field Supporter',
                    effects: [{
                        type: 'hp',
                        amount: { type: 'constant', value: 15 },
                        target: {
                            type: 'all-matching',
                            criteria: { player: 'opponent', location: 'field' }
                        },
                        operation: 'damage'
                    }]
                }]
            ]) });

            const { state } = runTestGame({
                actions: [new PlayCardResponseMessage('opponent-field-supporter', 'supporter')],
                customRepository: testRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature'),
                    StateBuilder.withCreatures(1, 'basic-creature'),
                    StateBuilder.withHand(0, [{ templateId: 'opponent-field-supporter', type: 'supporter' }])
                ),
                maxSteps: 10
            });

            expect(state.field.creatures[0][0].damageTaken).to.equal(0, 'Should not damage own creature');
            expect(state.field.creatures[1][0].damageTaken).to.equal(15, 'Should damage opponent creature');
        });
    });

    // Multi Choice Targets - TODO: Implement multi-target selection system

    describe('All Matching Targets', () => {
        it('should target all matching creatures automatically', () => {
            const testRepository = new MockCardRepository({ 
                supporters: new Map([
                    ['all-bench-damage-supporter', {
                        templateId: 'all-bench-damage-supporter',
                        name: 'All Bench Damage Supporter',
                        effects: [{
                            type: 'hp',
                            amount: { type: 'constant', value: 20 },
                            target: { type: 'fixed', player: 'opponent', position: 'active' },
                            operation: 'damage'
                        }]
                    }]
                ])
            });

            const { state } = runTestGame({
                actions: [new PlayCardResponseMessage('all-bench-damage-supporter', 'supporter')],
                customRepository: testRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature'),
                    StateBuilder.withCreatures(1, 'basic-creature', ['high-hp-creature', 'basic-creature']),
                    StateBuilder.withHand(0, [{ templateId: 'all-bench-damage-supporter', type: 'supporter' }])
                ),
                maxSteps: 10
            });

            expect(state.field.creatures[1][0].damageTaken).to.equal(20, 'Active creature should take damage');
        });
    });
});
