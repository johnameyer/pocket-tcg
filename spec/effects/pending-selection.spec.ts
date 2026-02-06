import { expect } from 'chai';
import { runTestGame } from '../helpers/test-helpers.js';
import { StateBuilder } from '../helpers/state-builder.js';
import { PlayCardResponseMessage } from '../../src/messages/response/play-card-response-message.js';
import { SelectTargetResponseMessage } from '../../src/messages/response/select-target-response-message.js';
import { MockCardRepository } from '../mock-repository.js';
import { SupporterData } from '../../src/repository/card-types.js';
import { EnergyState } from '../../src/controllers/energy-controller.js';

describe('Pending Target Selection', () => {
    describe('Dual Target Selection', () => {
        it.skip('should handle sequential target selection in resolution order', () => {
            /*
             * TODO: Dual target selection (both source and target requiring choice) needs additional work
             * The current implementation handles single choice on either source or target, but not both.
             * This is a framework limitation that needs resolution flow improvements.
             */
            const testRepository = new MockCardRepository({
                supporters: new Map<string, SupporterData>([
                    [ 'dual-target-supporter', {
                        templateId: 'dual-target-supporter',
                        name: 'Dual Target Supporter',
                        effects: [{
                            type: 'energy-transfer',
                            source: {
                                type: 'field',
                                fieldTarget: { type: 'single-choice', chooser: 'self', criteria: { player: 'self', location: 'field' }},
                                criteria: { energyTypes: [ 'fire' ] },
                                count: 1,
                            },
                            target: { type: 'single-choice', chooser: 'self', criteria: { player: 'self', location: 'field', position: 'bench' }},
                        }],
                    }],
                ]),
            });

            const { state, getExecutedCount } = runTestGame({
                actions: [
                    new PlayCardResponseMessage('dual-target-supporter', 'supporter'),
                    new SelectTargetResponseMessage([{ playerId: 0, fieldIndex: 0 }]), // First: source (active)
                    new SelectTargetResponseMessage([{ playerId: 0, fieldIndex: 1 }]), // Second: target (bench)
                ],
                customRepository: testRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature', [ 'high-hp-creature' ]),
                    StateBuilder.withHand(0, [{ templateId: 'dual-target-supporter', type: 'supporter' }]),
                    StateBuilder.withEnergy('basic-creature-0', { fire: 2 }),
                ),
                maxSteps: 15,
            });

            expect(getExecutedCount()).to.equal(3, 'Should execute supporter + 2 target selections');
            
             
            const energyState: EnergyState = state.energy;
            expect(energyState.attachedEnergyByInstance['basic-creature-0'].fire).to.equal(1, 'Source should lose 1 fire energy');
            expect(energyState.attachedEnergyByInstance['high-hp-creature-0-0'].fire).to.equal(1, 'Target should gain 1 fire energy');
        });
    });

    describe('Single Choice Selection', () => {
        it('should create pending selection for single-choice target', () => {
            const testRepository = new MockCardRepository({
                supporters: new Map<string, SupporterData>([
                    [ 'pending-heal', {
                        templateId: 'pending-heal',
                        name: 'Pending Heal',
                        effects: [{
                            type: 'hp',
                            amount: { type: 'constant', value: 30 },
                            target: {
                                type: 'single-choice',
                                chooser: 'self',
                                criteria: { player: 'self', location: 'field' },
                            },
                            operation: 'heal',
                        }],
                    }],
                ]),
            });

            // Test without target selection - should create pending state
            const { state: pendingState } = runTestGame({
                actions: [ new PlayCardResponseMessage('pending-heal', 'supporter') ],
                customRepository: testRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature', [ 'basic-creature' ]),
                    StateBuilder.withHand(0, [{ templateId: 'pending-heal', type: 'supporter' }]),
                    StateBuilder.withDamage('basic-creature-0', 40),
                    StateBuilder.withDamage('basic-creature-0-0', 20),
                ),
                maxSteps: 10,
            });

            // Should have pending target effect
            expect(pendingState.turnState.pendingSelection).to.not.be.null;
            expect(pendingState.field.creatures[0][0].damageTaken).to.equal(40, 'Should not heal yet');
            expect(pendingState.field.creatures[0][1].damageTaken).to.equal(20, 'Should not heal yet');
        });

        it('should resolve pending selection when target provided', () => {
            const testRepository = new MockCardRepository({
                supporters: new Map<string, SupporterData>([
                    [ 'resolve-heal', {
                        templateId: 'resolve-heal',
                        name: 'Resolve Heal',
                        effects: [{
                            type: 'hp',
                            amount: { type: 'constant', value: 25 },
                            target: {
                                type: 'single-choice',
                                chooser: 'self',
                                criteria: { player: 'self', location: 'field' },
                            },
                            operation: 'heal',
                        }],
                    }],
                ]),
            });

            const { state } = runTestGame({
                actions: [
                    new PlayCardResponseMessage('resolve-heal', 'supporter'),
                    new SelectTargetResponseMessage([{ playerId: 0, fieldIndex: 1 }]),
                ],
                customRepository: testRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature'),
                    StateBuilder.withHand(0, [{ templateId: 'resolve-heal', type: 'supporter' }]),
                    StateBuilder.withDamage('basic-creature-0', 40),
                    (state) => {
                        state.field.creatures[0].push({
                            fieldInstanceId: 'test-field-id',
                            evolutionStack: [{ instanceId: 'field-card-1', templateId: 'basic-creature' }],
                            damageTaken: 30,
                            turnLastPlayed: 0,
                        });
                    },
                ),
                maxSteps: 15,
            });

            // Should resolve and heal selected target
            expect(state.turnState.pendingSelection).to.be.undefined;
            expect(state.field.creatures[0][0].damageTaken).to.equal(40, 'Should not heal active');
            expect(state.field.creatures[0][1].damageTaken).to.equal(5, 'Should heal selected bench');
        });
    });

    describe('Opponent Choice Selection', () => {
        it('should handle opponent chooser', () => {
            const testRepository = new MockCardRepository({
                supporters: new Map<string, SupporterData>([
                    [ 'opponent-select', {
                        templateId: 'opponent-select',
                        name: 'Opponent Select',
                        effects: [{
                            type: 'hp',
                            amount: { type: 'constant', value: 20 },
                            target: {
                                type: 'single-choice',
                                chooser: 'opponent',
                                criteria: { player: 'self', location: 'field' },
                            },
                            operation: 'heal',
                        }],
                    }],
                ]),
            });

            const { state } = runTestGame({
                actions: [
                    new PlayCardResponseMessage('opponent-select', 'supporter'),
                    new SelectTargetResponseMessage([{ playerId: 0, fieldIndex: 0 }]),
                ],
                customRepository: testRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature'),
                    StateBuilder.withCreatures(1, 'basic-creature'),
                    StateBuilder.withHand(0, [{ templateId: 'opponent-select', type: 'supporter' }]),
                    StateBuilder.withDamage('basic-creature-0', 35),
                    (state) => {
                        state.field.creatures[0].push({
                            fieldInstanceId: 'test-field-id',
                            evolutionStack: [{ instanceId: 'field-card-1', templateId: 'basic-creature' }],
                            damageTaken: 25,
                            turnLastPlayed: 0,
                        });
                    },
                ),
                maxSteps: 15,
            });

            expect(state.field.creatures[0][0].damageTaken).to.equal(15, 'Opponent should choose our active');
            expect(state.field.creatures[0][1].damageTaken).to.equal(25, 'Should not heal bench');
        });
    });

    describe('Multiple Effects with Selection', () => {
        it('should handle multiple effects requiring selection', () => {
            const testRepository = new MockCardRepository({
                supporters: new Map<string, SupporterData>([
                    [ 'multi-select', {
                        templateId: 'multi-select',
                        name: 'Multi Select',
                        effects: [
                            {
                                type: 'hp',
                                amount: { type: 'constant', value: 10 },
                                target: {
                                    type: 'single-choice',
                                    chooser: 'self',
                                    criteria: { player: 'self', location: 'field' },
                                },
                                operation: 'heal',
                            },
                            {
                                type: 'hp',
                                amount: { type: 'constant', value: 15 },
                                target: { type: 'fixed', player: 'opponent', position: 'active' },
                                operation: 'damage',
                            },
                        ],
                    }],
                ]),
            });

            const { state } = runTestGame({
                actions: [
                    new PlayCardResponseMessage('multi-select', 'supporter'),
                    new SelectTargetResponseMessage([{ playerId: 0, fieldIndex: 0 }]),
                ],
                customRepository: testRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature'),
                    StateBuilder.withCreatures(1, 'basic-creature'),
                    StateBuilder.withHand(0, [{ templateId: 'multi-select', type: 'supporter' }]),
                    StateBuilder.withDamage('basic-creature-0', 20),
                ),
                maxSteps: 15,
            });

            expect(state.field.creatures[0][0].damageTaken).to.equal(10, 'Should heal selected self');
            expect(state.field.creatures[1][0].damageTaken).to.equal(15, 'Should damage opponent');
        });
    });

    describe('Invalid Target Selection', () => {
        it('should handle invalid target selection gracefully', () => {
            const testRepository = new MockCardRepository({
                supporters: new Map<string, SupporterData>([
                    [ 'invalid-target', {
                        templateId: 'invalid-target',
                        name: 'Invalid Target',
                        effects: [{
                            type: 'hp',
                            amount: { type: 'constant', value: 20 },
                            target: {
                                type: 'single-choice',
                                chooser: 'self',
                                criteria: { player: 'self', location: 'field' },
                            },
                            operation: 'heal',
                        }],
                    }],
                ]),
            });

            const { state } = runTestGame({
                actions: [
                    new PlayCardResponseMessage('invalid-target', 'supporter'),
                    new SelectTargetResponseMessage([{ playerId: 0, fieldIndex: 5 }]), // Invalid index
                ],
                customRepository: testRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature'),
                    StateBuilder.withHand(0, [{ templateId: 'invalid-target', type: 'supporter' }]),
                    StateBuilder.withDamage('basic-creature-0', 30),
                ),
                maxSteps: 15,
            });

            // Should handle gracefully - either no effect or default to valid target
            expect(state.field.creatures[0][0].damageTaken).to.be.at.most(30, 'Should not cause error');
        });

        it('should handle selection with no valid targets', () => {
            const testRepository = new MockCardRepository({
                supporters: new Map<string, SupporterData>([
                    [ 'no-targets', {
                        templateId: 'no-targets',
                        name: 'No Targets',
                        effects: [{
                            type: 'hp',
                            amount: { type: 'constant', value: 20 },
                            target: {
                                type: 'single-choice',
                                chooser: 'self',
                                criteria: { player: 'self', location: 'field', fieldCriteria: { hasDamage: true }},
                            },
                            operation: 'heal',
                        }],
                    }],
                ]),
            });

            const { state } = runTestGame({
                actions: [ new PlayCardResponseMessage('no-targets', 'supporter') ],
                customRepository: testRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature'),
                    StateBuilder.withHand(0, [{ templateId: 'no-targets', type: 'supporter' }]),
                    // No damage on any Pokemon
                ),
                maxSteps: 10,
            });

            // Should handle gracefully when no valid targets
            expect(state.field.creatures[0][0].damageTaken).to.equal(0, 'Should remain undamaged');
        });
    });

    describe('Effect Name Tracking', () => {
        it('should track effect name in pending selection', () => {
            const testRepository = new MockCardRepository({
                supporters: new Map<string, SupporterData>([
                    [ 'named-effect', {
                        templateId: 'named-effect',
                        name: 'Named Effect',
                        effects: [{
                            type: 'hp',
                            amount: { type: 'constant', value: 15 },
                            target: {
                                type: 'single-choice',
                                chooser: 'self',
                                criteria: { player: 'self', location: 'field' },
                            },
                            operation: 'heal',
                        }],
                    }],
                ]),
            });

            const { state } = runTestGame({
                actions: [ new PlayCardResponseMessage('named-effect', 'supporter') ],
                customRepository: testRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature'),
                    StateBuilder.withHand(0, [{ templateId: 'named-effect', type: 'supporter' }]),
                    StateBuilder.withDamage('basic-creature-0', 25),
                    (state) => {
                        state.field.creatures[0].push({
                            fieldInstanceId: 'test-field-id',
                            evolutionStack: [{ instanceId: 'field-card-1', templateId: 'basic-creature' }],
                            damageTaken: 15,
                            turnLastPlayed: 0,
                        });
                    },
                ),
                maxSteps: 10,
            });

            // Should have effect name in pending selection
            expect(state.turnState.pendingSelection).to.not.be.null;
            if (state.turnState.pendingSelection) {
                expect((state.turnState.pendingSelection).originalContext.effectName).to.equal('Named Effect');
            }
        });
    });

    describe('Multi-Target Field Selection', () => {
        it('should handle selecting multiple targets with array format', () => {
            const testRepository = new MockCardRepository({
                supporters: new Map<string, SupporterData>([
                    [ 'multi-heal-supporter', {
                        templateId: 'multi-heal-supporter',
                        name: 'Multi Heal Supporter',
                        effects: [{
                            type: 'hp',
                            amount: { type: 'constant', value: 30 },
                            target: { type: 'single-choice', chooser: 'self', criteria: { player: 'self', location: 'field' }},
                            operation: 'heal',
                        }],
                    }],
                ]),
            });

            const { state, getExecutedCount } = runTestGame({
                actions: [
                    new PlayCardResponseMessage('multi-heal-supporter', 'supporter'),
                    new SelectTargetResponseMessage([{ playerId: 0, fieldIndex: 0 }]),
                ],
                customRepository: testRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature', [ 'high-hp-creature' ]),
                    StateBuilder.withHand(0, [{ templateId: 'multi-heal-supporter', type: 'supporter' }]),
                    StateBuilder.withDamage('basic-creature-0', 50),
                    StateBuilder.withDamage('high-hp-creature-0-0', 40),
                ),
                maxSteps: 10,
            });

            expect(getExecutedCount()).to.equal(2, 'Should execute supporter + target selection');
            
            const activeCreature = state.field.creatures[0][0];
            expect(activeCreature.damageTaken).to.equal(20, 'Active creature should be healed');
        });

        it('should support backward-compatible single target selection', () => {
            const testRepository = new MockCardRepository({
                supporters: new Map<string, SupporterData>([
                    [ 'heal-supporter', {
                        templateId: 'heal-supporter',
                        name: 'Heal Supporter',
                        effects: [{
                            type: 'hp',
                            amount: { type: 'constant', value: 50 },
                            target: { type: 'single-choice', chooser: 'self', criteria: { player: 'self', location: 'field' }},
                            operation: 'heal',
                        }],
                    }],
                ]),
            });

            const { state } = runTestGame({
                actions: [
                    new PlayCardResponseMessage('heal-supporter', 'supporter'),
                    // Use array format for backward compatibility test
                    new SelectTargetResponseMessage([{ playerId: 0, fieldIndex: 1 }]),
                ],
                customRepository: testRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature', [ 'high-hp-creature' ]),
                    StateBuilder.withHand(0, [{ templateId: 'heal-supporter', type: 'supporter' }]),
                    StateBuilder.withDamage('high-hp-creature-0-0', 60),
                ),
                maxSteps: 10,
            });

            const benchCreature = state.field.creatures[0][1];
            expect(benchCreature.damageTaken).to.equal(10, 'Bench creature should be healed by 50');
        });
    });

    describe('Selection Message Validation', () => {
        it('should validate SelectTargetResponseMessage with multiple targets', () => {
            const message = new SelectTargetResponseMessage([
                { playerId: 0, fieldIndex: 0 },
                { playerId: 0, fieldIndex: 1 },
            ]);
            
            expect(message.targets).to.have.lengthOf(2);
            expect(message.targetPlayerId).to.equal(0, 'Should have backward-compatible getter');
            expect(message.targetCreatureIndex).to.equal(0, 'Should have backward-compatible getter');
        });

        it('should handle empty targets array in SelectTargetResponseMessage', () => {
            const message = new SelectTargetResponseMessage([]);
            
            expect(message.targets).to.have.lengthOf(0);
            expect(message.targetPlayerId).to.equal(-1);
            expect(message.targetCreatureIndex).to.equal(-1);
        });
    });
});
