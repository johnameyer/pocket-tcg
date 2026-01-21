import { expect } from 'chai';
import { runTestGame } from '../helpers/test-helpers.js';
import { StateBuilder } from '../helpers/state-builder.js';
import { PlayCardResponseMessage } from '../../src/messages/response/play-card-response-message.js';
import { SelectTargetResponseMessage } from '../../src/messages/response/select-target-response-message.js';
import { MockCardRepository } from '../mock-repository.js';
import { SupporterData } from '../../src/repository/card-types.js';
import { getCurrentTemplateId } from '../../src/utils/field-card-utils.js';

describe('Target Matching', () => {
    describe('Fixed Targets', () => {
        it('should target self-active', () => {
            const testRepository = new MockCardRepository({
                supporters: new Map<string, SupporterData>([
                    ['self-target', {
                        templateId: 'self-target',
                        name: 'Self Target',
                        effects: [{
                            type: 'hp',
                            amount: { type: 'constant', value: 30 },
                            target: { type: 'fixed', player: 'self', position: 'active' },
                            operation: 'heal'
                        }]
                    }]
                ])
            });

            const { state } = runTestGame({
                actions: [new PlayCardResponseMessage('self-target', 'supporter')],
                customRepository: testRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature'),
                    StateBuilder.withCreatures(1, 'basic-creature'),
                    StateBuilder.withHand(0, [{ templateId: 'self-target', type: 'supporter' }]),
                    StateBuilder.withDamage('basic-creature-0', 40),
                    StateBuilder.withDamage('basic-creature-1', 40)
                ),
                maxSteps: 10
            });

            expect(state.field.creatures[0][0].damageTaken).to.equal(10, 'Should heal self active');
            expect(state.field.creatures[1][0].damageTaken).to.equal(40, 'Should not heal opponent');
        });

        it('should target opponent-active', () => {
            const testRepository = new MockCardRepository({
                supporters: new Map<string, SupporterData>([
                    ['opponent-target', {
                        templateId: 'opponent-target',
                        name: 'Opponent Target',
                        effects: [{
                            type: 'hp',
                            amount: { type: 'constant', value: 25 },
                            target: { type: 'fixed', player: 'opponent', position: 'active' },
                            operation: 'damage'
                        }]
                    }]
                ])
            });

            const { state } = runTestGame({
                actions: [new PlayCardResponseMessage('opponent-target', 'supporter')],
                customRepository: testRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature'),
                    StateBuilder.withCreatures(1, 'basic-creature'),
                    StateBuilder.withHand(0, [{ templateId: 'opponent-target', type: 'supporter' }])
                ),
                maxSteps: 10
            });

            expect(state.field.creatures[0][0].damageTaken).to.equal(0, 'Should not damage self');
            expect(state.field.creatures[1][0].damageTaken).to.equal(25, 'Should damage opponent active');
        });
    });

    describe('Single Choice Targets', () => {
        it('should require target selection', () => {
            const testRepository = new MockCardRepository({
                supporters: new Map<string, SupporterData>([
                    ['choice-target', {
                        templateId: 'choice-target',
                        name: 'Choice Target',
                        effects: [{
                            type: 'hp',
                            amount: { type: 'constant', value: 20 },
                            target: {
                                type: 'single-choice',
                                chooser: 'self',
                                criteria: { player: 'self', location: 'field' }
                            },
                            operation: 'heal'
                        }]
                    }]
                ])
            });

            const { state } = runTestGame({
                actions: [
                    new PlayCardResponseMessage('choice-target', 'supporter'),
                    new SelectTargetResponseMessage(0, 1)
                ],
                customRepository: testRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature', ['basic-creature']),
                    StateBuilder.withHand(0, [{ templateId: 'choice-target', type: 'supporter' }]),
                    StateBuilder.withDamage('basic-creature-0', 30),
                    StateBuilder.withDamage('basic-creature-0-0', 25) // Damage to first bench creature
                ),
                maxSteps: 15
            });

            expect(state.field.creatures[0][0].damageTaken).to.equal(30, 'Should not heal active');
            expect(state.field.creatures[0][1].damageTaken).to.equal(5, 'Should heal selected bench'); // 25 - 20 = 5
        });

        it('should respect chooser (opponent choice)', () => {
            const testRepository = new MockCardRepository({
                supporters: new Map<string, SupporterData>([
                    ['opponent-choice', {
                        templateId: 'opponent-choice',
                        name: 'Opponent Choice',
                        effects: [{
                            type: 'hp',
                            amount: { type: 'constant', value: 15 },
                            target: {
                                type: 'single-choice',
                                chooser: 'opponent',
                                criteria: { player: 'self', location: 'field' }
                            },
                            operation: 'heal'
                        }]
                    }]
                ])
            });

            const { state } = runTestGame({
                actions: [
                    new PlayCardResponseMessage('opponent-choice', 'supporter'),
                    new SelectTargetResponseMessage(0, 0)
                ],
                customRepository: testRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature'),
                    StateBuilder.withCreatures(1, 'basic-creature'),
                    StateBuilder.withHand(0, [{ templateId: 'opponent-choice', type: 'supporter' }]),
                    StateBuilder.withDamage('basic-creature-0', 20)
                ),
                maxSteps: 15
            });

            expect(state.field.creatures[0][0].damageTaken).to.equal(5, 'Opponent should choose our active');
        });
    });

    describe('All Matching Targets', () => {
        it('should target all creature in scope', () => {
            const testRepository = new MockCardRepository({
                supporters: new Map<string, SupporterData>([
                    ['all-target', {
                        templateId: 'all-target',
                        name: 'All Target',
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
                ])
            });

            const { state } = runTestGame({
                actions: [new PlayCardResponseMessage('all-target', 'supporter')],
                customRepository: testRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature'),
                    StateBuilder.withHand(0, [{ templateId: 'all-target', type: 'supporter' }]),
                    StateBuilder.withDamage('basic-creature-0', 20),
                    (state) => {
                        state.field.creatures[0].push({
                            evolutionStack: [{ instanceId: "field-card-1", templateId: 'basic-creature' }],
                            damageTaken: 15,
                            turnLastPlayed: 0
                        });
                        state.field.creatures[0].push({
                            evolutionStack: [{ instanceId: "field-card-2", templateId: 'basic-creature' }],
                            damageTaken: 25,
                            turnLastPlayed: 0
                        });
                    }
                ),
                maxSteps: 10
            });

            expect(state.field.creatures[0][0].damageTaken).to.equal(10, 'Should heal active');
            expect(state.field.creatures[0][1].damageTaken).to.equal(5, 'Should heal bench 1');
            expect(state.field.creatures[0][2].damageTaken).to.equal(15, 'Should heal bench 2');
        });

        it('should filter by condition (damaged only)', () => {
            const testRepository = new MockCardRepository({
                supporters: new Map<string, SupporterData>([
                    ['damaged-only', {
                        templateId: 'damaged-only',
                        name: 'Damaged Only',
                        effects: [{
                            type: 'hp',
                            amount: { type: 'constant', value: 10 },
                            target: {
                                type: 'all-matching',
                                criteria: { player: 'self', location: 'field', condition: { hasDamage: true } }
                            },
                            operation: 'heal'
                        }]
                    }]
                ])
            });

            const { state } = runTestGame({
                actions: [new PlayCardResponseMessage('damaged-only', 'supporter')],
                customRepository: testRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature'),
                    StateBuilder.withHand(0, [{ templateId: 'damaged-only', type: 'supporter' }]),
                    StateBuilder.withDamage('basic-creature-0', 20),
                    (state) => {
                        state.field.creatures[0].push({
                            evolutionStack: [{ instanceId: "field-card-1", templateId: 'basic-creature' }],
                            damageTaken: 0,
                            turnLastPlayed: 0
                        });
                        state.field.creatures[0].push({
                            evolutionStack: [{ instanceId: "field-card-2", templateId: 'basic-creature' }],
                            damageTaken: 15,
                            turnLastPlayed: 0
                        });
                    }
                ),
                maxSteps: 10
            });

            expect(state.field.creatures[0][0].damageTaken).to.equal(10, 'Should heal damaged active');
            expect(state.field.creatures[0][1].damageTaken).to.equal(0, 'Should not heal undamaged bench');
            expect(state.field.creatures[0][2].damageTaken).to.equal(5, 'Should heal damaged bench');
        });
    });

    describe('Scope Filtering', () => {
        it('should respect self-field scope', () => {
            const testRepository = new MockCardRepository({
                supporters: new Map<string, SupporterData>([
                    ['self-scope', {
                        templateId: 'self-scope',
                        name: 'Self Scope',
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
                ])
            });

            const { state } = runTestGame({
                actions: [new PlayCardResponseMessage('self-scope', 'supporter')],
                customRepository: testRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature'),
                    StateBuilder.withCreatures(1, 'basic-creature'),
                    StateBuilder.withHand(0, [{ templateId: 'self-scope', type: 'supporter' }]),
                    StateBuilder.withDamage('basic-creature-0', 20),
                    StateBuilder.withDamage('basic-creature-1', 20)
                ),
                maxSteps: 10
            });

            expect(state.field.creatures[0][0].damageTaken).to.equal(10, 'Should heal self');
            expect(state.field.creatures[1][0].damageTaken).to.equal(20, 'Should not heal opponent');
        });

        it('should respect opponent-field scope', () => {
            const testRepository = new MockCardRepository({
                supporters: new Map<string, SupporterData>([
                    ['opponent-scope', {
                        templateId: 'opponent-scope',
                        name: 'Opponent Scope',
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
                ])
            });

            const { state } = runTestGame({
                actions: [new PlayCardResponseMessage('opponent-scope', 'supporter')],
                customRepository: testRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature'),
                    StateBuilder.withCreatures(1, 'basic-creature'),
                    StateBuilder.withHand(0, [{ templateId: 'opponent-scope', type: 'supporter' }]),
                    (state) => {
                        state.field.creatures[1].push({
                        evolutionStack: [{ instanceId: "field-card-1", templateId: 'basic-creature' }],
                        damageTaken: 0,
                        turnLastPlayed: 0
                    });
                    }
                ),
                maxSteps: 10
            });

            expect(state.field.creatures[0][0].damageTaken).to.equal(0, 'Should not damage self');
            expect(state.field.creatures[1][0].damageTaken).to.equal(15, 'Should damage opponent active');
            expect(state.field.creatures[1][1].damageTaken).to.equal(15, 'Should damage opponent bench');
        });
    });
});
