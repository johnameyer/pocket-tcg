import { expect } from 'chai';
import { PlayCardResponseMessage } from '../../../src/messages/response/play-card-response-message.js';
import { SelectTargetResponseMessage } from '../../../src/messages/response/select-target-response-message.js';
import { SelectEnergyResponseMessage } from '../../../src/messages/response/select-energy-response-message.js';
import { StateBuilder } from '../../helpers/state-builder.js';
import { runTestGame } from '../../helpers/test-helpers.js';
import { MockCardRepository } from '../../mock-repository.js';
import { EnergyTransferEffectHandler } from '../../../src/effects/handlers/energy-transfer-effect-handler.js';
import { CardPlayedEffectContext } from '../../../src/effects/effect-context.js';
import { EnergyTransferEffect } from '../../../src/repository/effect-types.js';
import { HandlerDataBuilder } from '../../helpers/handler-data-builder.js';

describe('Energy Transfer Effect', () => {
    describe('canApply', () => {
        const handler = new EnergyTransferEffectHandler();
        const mockRepository = new MockCardRepository();

        it('should return true when source has required energy', () => {
            const handlerData = HandlerDataBuilder.default(
                HandlerDataBuilder.withCreatures(0, 'basic-creature', [ 'basic-creature' ]),
            );
            // Set up energy on active creature
            handlerData.energy.attachedEnergyByInstance['basic-creature-0'] = {
                grass: 0, fire: 2, water: 0, lightning: 0,
                psychic: 0, fighting: 0, darkness: 0, metal: 0,
            };

            const effect: EnergyTransferEffect = {
                type: 'energy-transfer',
                source: {
                    type: 'field',
                    fieldTarget: { type: 'fixed', player: 'self', position: 'active' },
                    criteria: { energyTypes: [ 'fire' ] },
                    count: 1,
                },
                target: { type: 'single-choice', chooser: 'self', criteria: { player: 'self', location: 'field', position: 'bench' }},
            };

            const context = { type: 'card-played' as const, sourcePlayer: 0, effectName: 'Test Transfer', cardType: 'item' } as CardPlayedEffectContext;
            const result = handler.canApply(handlerData, effect, context, mockRepository);
            
            expect(result).to.be.true;
        });

        it('should return false when source has no required energy (target resolution failure)', () => {
            const handlerData = HandlerDataBuilder.default(
                HandlerDataBuilder.withCreatures(0, 'basic-creature', [ 'basic-creature' ]),
            );
            // No energy on active creature
            handlerData.energy.attachedEnergyByInstance['basic-creature-0'] = {
                grass: 0, fire: 0, water: 0, lightning: 0,
                psychic: 0, fighting: 0, darkness: 0, metal: 0,
            };

            const effect: EnergyTransferEffect = {
                type: 'energy-transfer',
                source: {
                    type: 'field',
                    fieldTarget: { type: 'fixed', player: 'self', position: 'active' },
                    criteria: { energyTypes: [ 'fire' ] },
                    count: 1,
                },
                target: { type: 'single-choice', chooser: 'self', criteria: { player: 'self', location: 'field', position: 'bench' }},
            };

            const context = { type: 'card-played' as const, sourcePlayer: 0, effectName: 'Test Transfer', cardType: 'item' } as CardPlayedEffectContext;
            const result = handler.canApply(handlerData, effect, context, mockRepository);
            
            expect(result).to.be.false;
        });

        it('should return false when no valid destination (target resolution failure)', () => {
            const handlerData = HandlerDataBuilder.default(
                HandlerDataBuilder.withCreatures(0, 'basic-creature', []),
            );
            handlerData.energy.attachedEnergyByInstance['basic-creature-0'] = {
                grass: 0, fire: 2, water: 0, lightning: 0,
                psychic: 0, fighting: 0, darkness: 0, metal: 0,
            };

            const effect: EnergyTransferEffect = {
                type: 'energy-transfer',
                source: {
                    type: 'field',
                    fieldTarget: { type: 'fixed', player: 'self', position: 'active' },
                    criteria: { energyTypes: [ 'fire' ] },
                    count: 1,
                },
                target: { type: 'single-choice', chooser: 'self', criteria: { player: 'self', location: 'field', position: 'bench' }},
            };

            const context = { type: 'card-played' as const, sourcePlayer: 0, effectName: 'Test Transfer', cardType: 'item' } as CardPlayedEffectContext;
            const result = handler.canApply(handlerData, effect, context, mockRepository);
            
            expect(result).to.be.false;
        });
    });

    const basicCreature = { templateId: 'basic-creature', type: 'creature' as const };
    const highHpCreature = { templateId: 'high-hp-creature', type: 'creature' as const };
    const transferSupporter = { templateId: 'transfer-supporter', type: 'supporter' as const };

    const testRepository = new MockCardRepository({
        creatures: {
            'basic-creature': {
                templateId: 'basic-creature',
                name: 'Basic Creature',
                maxHp: 80,
                type: 'fire',
                weakness: 'water',
                retreatCost: 1,
                attacks: [{ name: 'Basic Attack', damage: 20, energyRequirements: [{ type: 'fire', amount: 1 }] }],
            },
            'high-hp-creature': {
                templateId: 'high-hp-creature',
                name: 'High HP Creature',
                maxHp: 140,
                type: 'water',
                weakness: 'grass',
                retreatCost: 2,
                attacks: [{ name: 'Water Attack', damage: 30, energyRequirements: [{ type: 'water', amount: 2 }] }],
            },
        },
        supporters: {
            'transfer-supporter': {
                templateId: 'transfer-supporter',
                name: 'Transfer Supporter',
                effects: [{
                    type: 'energy-transfer',
                    source: {
                        type: 'field',
                        fieldTarget: { type: 'fixed', player: 'self', position: 'active' },
                        criteria: { energyTypes: [ 'fire' ] },
                        count: 1,
                    },
                    target: { type: 'single-choice', chooser: 'self', criteria: { player: 'self', location: 'field', position: 'bench' }},
                }],
            },
            'choice-transfer-supporter': {
                templateId: 'choice-transfer-supporter',
                name: 'Choice Transfer Supporter',
                effects: [{
                    type: 'energy-transfer',
                    source: {
                        type: 'field',
                        fieldTarget: { type: 'single-choice', chooser: 'self', criteria: { player: 'self', location: 'field' }},
                        criteria: { energyTypes: [ 'fire', 'water' ] },
                        count: 1,
                    },
                    target: { type: 'single-choice', chooser: 'self', criteria: { player: 'self', location: 'field', position: 'bench' }},
                }],
            },
            'multi-transfer-supporter': {
                templateId: 'multi-transfer-supporter',
                name: 'Multi Transfer Supporter',
                effects: [{
                    type: 'energy-transfer',
                    source: {
                        type: 'field',
                        fieldTarget: { type: 'fixed', player: 'self', position: 'active' },
                        criteria: { energyTypes: [ 'fire' ] },
                        count: 2,
                    },
                    target: { type: 'single-choice', chooser: 'self', criteria: { player: 'self', location: 'field', position: 'bench' }},
                }],
            },
            'water-transfer-supporter': {
                templateId: 'water-transfer-supporter',
                name: 'Water Transfer Supporter',
                effects: [{
                    type: 'energy-transfer',
                    source: {
                        type: 'field',
                        fieldTarget: { type: 'fixed', player: 'self', position: 'active' },
                        criteria: { energyTypes: [ 'water' ] },
                        count: 1,
                    },
                    target: { type: 'single-choice', chooser: 'self', criteria: { player: 'self', location: 'field', position: 'bench' }},
                }],
            },
            'any-energy-transfer-supporter': {
                templateId: 'any-energy-transfer-supporter',
                name: 'Any Energy Transfer Supporter',
                effects: [{
                    type: 'energy-transfer',
                    source: {
                        type: 'field',
                        fieldTarget: { type: 'fixed', player: 'self', position: 'active' },
                        criteria: { energyTypes: [ 'fire', 'water', 'grass', 'lightning', 'psychic', 'fighting', 'darkness', 'metal' ] },
                        count: 1,
                    },
                    target: { type: 'single-choice', chooser: 'self', criteria: { player: 'self', location: 'field', position: 'bench' }},
                }],
            },
            'multi-target-transfer-supporter': {
                templateId: 'multi-target-transfer-supporter',
                name: 'Multi Target Transfer Supporter',
                effects: [{
                    type: 'energy-transfer',
                    source: {
                        type: 'field',
                        fieldTarget: { type: 'fixed', player: 'self', position: 'active' },
                        criteria: { energyTypes: [ 'lightning' ] },
                        count: 2,
                    },
                    target: { type: 'multi-choice', chooser: 'self', criteria: { player: 'self', location: 'field', position: 'bench' }, count: 2 },
                }],
            },
        },
    });

    const choiceTransferSupporter = { templateId: 'choice-transfer-supporter', type: 'supporter' as const };
    const multiTransferSupporter = { templateId: 'multi-transfer-supporter', type: 'supporter' as const };
    const waterTransferSupporter = { templateId: 'water-transfer-supporter', type: 'supporter' as const };
    const anyEnergyTransferSupporter = { templateId: 'any-energy-transfer-supporter', type: 'supporter' as const };

    it('should transfer 1 fire energy from active to bench (basic operation)', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [ new PlayCardResponseMessage('transfer-supporter', 'supporter') ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature', [ 'high-hp-creature' ]),
                StateBuilder.withHand(0, [ transferSupporter ]),
                StateBuilder.withEnergy('basic-creature-0', { fire: 2 }),
                StateBuilder.withEnergy('high-hp-creature-0-0', { water: 1 }),
            ),
        });

        expect(getExecutedCount()).to.equal(1, 'Should have executed transfer supporter');
        
        const energyState = state.energy;
        expect(energyState.attachedEnergyByInstance['basic-creature-0'].fire).to.equal(1, 'Active should have 1 fire energy remaining');
        expect(energyState.attachedEnergyByInstance['high-hp-creature-0-0'].fire).to.equal(1, 'Bench should have gained 1 fire energy');
        expect(energyState.attachedEnergyByInstance['high-hp-creature-0-0'].water).to.equal(1, 'Bench should keep existing water energy');
    });

    it('should transfer different energy types (water)', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [ new PlayCardResponseMessage('water-transfer-supporter', 'supporter') ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature', [ 'high-hp-creature' ]),
                StateBuilder.withHand(0, [ waterTransferSupporter ]),
                StateBuilder.withEnergy('basic-creature-0', { water: 2, fire: 1 }),
            ),
        });

        expect(getExecutedCount()).to.equal(1, 'Should have executed water transfer supporter');
        
        const energyState = state.energy;
        expect(energyState.attachedEnergyByInstance['basic-creature-0'].water).to.equal(1, 'Active should have 1 water energy remaining');
        expect(energyState.attachedEnergyByInstance['basic-creature-0'].fire).to.equal(1, 'Active should keep fire energy');
        expect(energyState.attachedEnergyByInstance['high-hp-creature-0-0'].water).to.equal(1, 'Bench should have gained 1 water energy');
    });

    it('should transfer different amounts (2 energy)', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [ new PlayCardResponseMessage('multi-transfer-supporter', 'supporter') ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature', [ 'high-hp-creature' ]),
                StateBuilder.withHand(0, [ multiTransferSupporter ]),
                StateBuilder.withEnergy('basic-creature-0', { fire: 3 }),
            ),
        });

        expect(getExecutedCount()).to.equal(1, 'Should have executed multi transfer supporter');
        
        const energyState = state.energy;
        expect(energyState.attachedEnergyByInstance['basic-creature-0'].fire).to.equal(1, 'Active should have 1 fire energy remaining');
        expect(energyState.attachedEnergyByInstance['high-hp-creature-0-0'].fire).to.equal(2, 'Bench should have gained 2 fire energy');
    });

    it.skip('should require target selection for single-choice targets', () => {
        /*
         * TODO: Dual target selection (both source and target requiring choice) needs additional work
         * The current implementation handles single choice on either source or target, but not both.
         * This is a framework limitation that needs resolution flow improvements.
         */
        const { state, getExecutedCount } = runTestGame({
            actions: [
                new PlayCardResponseMessage('choice-transfer-supporter', 'supporter'),
                new SelectTargetResponseMessage([{ playerId: 0, fieldIndex: 0 }]), // Source: self active
                new SelectTargetResponseMessage([{ playerId: 0, fieldIndex: 1 }]), // Target: self bench
            ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature', [ 'high-hp-creature' ]),
                StateBuilder.withHand(0, [ choiceTransferSupporter ]),
                StateBuilder.withEnergy('basic-creature-0', { fire: 2 }),
            ),
        });

        expect(getExecutedCount()).to.equal(3, 'Should have executed supporter and both target selections');
        
        const energyState = state.energy;
        expect(energyState.attachedEnergyByInstance['basic-creature-0'].fire).to.equal(1, 'Active should have 1 fire energy remaining');
        expect(energyState.attachedEnergyByInstance['high-hp-creature-0-0'].fire).to.equal(1, 'Bench should have gained 1 fire energy');
    });

    it('should handle multiple energy types (any energy)', () => {
        // 2 matching types present but only 1 requested: player must choose which type to take.
        const { state, getExecutedCount } = runTestGame({
            actions: [
                new PlayCardResponseMessage('any-energy-transfer-supporter', 'supporter'),
                new SelectEnergyResponseMessage([{ playerId: 0, fieldIndex: 0, energyType: 'lightning' }]),
            ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature', [ 'high-hp-creature' ]),
                StateBuilder.withHand(0, [ anyEnergyTransferSupporter ]),
                StateBuilder.withEnergy('basic-creature-0', { psychic: 1, lightning: 1 }),
            ),
        });

        expect(getExecutedCount()).to.equal(2, 'Should have executed any energy transfer supporter and the energy type choice');

        const energyState = state.energy;
        expect(energyState.attachedEnergyByInstance['basic-creature-0'].lightning).to.equal(0, 'Active should have no lightning energy remaining');
        expect(energyState.attachedEnergyByInstance['basic-creature-0'].psychic).to.equal(1, 'Active should keep psychic energy');
        expect(energyState.attachedEnergyByInstance['high-hp-creature-0-0'].lightning).to.equal(1, 'Bench should have gained 1 lightning energy');
    });

    it('should cap transfer at available energy', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [ new PlayCardResponseMessage('multi-transfer-supporter', 'supporter') ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature', [ 'high-hp-creature' ]),
                StateBuilder.withHand(0, [ multiTransferSupporter ]),
                StateBuilder.withEnergy('basic-creature-0', { fire: 1 }), // Only 1 energy, but effect wants to transfer 2
            ),
        });

        expect(getExecutedCount()).to.equal(1, 'Should have executed multi transfer supporter');
        
        const energyState = state.energy;
        expect(energyState.attachedEnergyByInstance['basic-creature-0'].fire).to.equal(0, 'Active should have no fire energy remaining');
        expect(energyState.attachedEnergyByInstance['high-hp-creature-0-0'].fire).to.equal(1, 'Bench should have gained only 1 fire energy (capped)');
    });

    it('should move 1 energy each to 2 chosen benched creatures (multi-choice destination)', () => {
        /*
         * Deliberately 3 bench creatures (more than the 2 needed) so this remains a real choice -
         * with exactly 2 available for count:2 the resolver now auto-resolves without prompting
         * (see "auto-resolves without prompting..." below), which is correct but would make this
         * particular test a no-op for the SelectTargetResponseMessage step.
         */
        const multiTargetTransferSupporter = { templateId: 'multi-target-transfer-supporter', type: 'supporter' as const };
        const { state, getExecutedCount } = runTestGame({
            actions: [
                new PlayCardResponseMessage('multi-target-transfer-supporter', 'supporter'),
                new SelectTargetResponseMessage([{ playerId: 0, fieldIndex: 1 }, { playerId: 0, fieldIndex: 2 }]),
            ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature', [ 'high-hp-creature', 'high-hp-creature', 'high-hp-creature' ]),
                StateBuilder.withHand(0, [ multiTargetTransferSupporter ]),
                StateBuilder.withEnergy('basic-creature-0', { lightning: 2 }),
                StateBuilder.withEnergy('high-hp-creature-0-2', {}),
            ),
        });

        expect(getExecutedCount()).to.equal(2, 'Should have executed the supporter and the bench selection');

        const energyState = state.energy;
        expect(energyState.attachedEnergyByInstance['basic-creature-0'].lightning).to.equal(0, 'Active should have no lightning energy remaining');
        expect(energyState.attachedEnergyByInstance['high-hp-creature-0-0'].lightning).to.equal(1, 'First bench creature should have gained 1 lightning energy');
        expect(energyState.attachedEnergyByInstance['high-hp-creature-0-1'].lightning).to.equal(1, 'Second bench creature should have gained 1 lightning energy');
        expect(energyState.attachedEnergyByInstance['high-hp-creature-0-2'].lightning).to.equal(0, 'Unselected third bench creature should be untouched');
    });

    it('auto-resolves without prompting when exactly 2 benched creatures exist for a count:2 destination', () => {
        const multiTargetTransferSupporter = { templateId: 'multi-target-transfer-supporter', type: 'supporter' as const };
        const { state, getExecutedCount } = runTestGame({
            actions: [
                new PlayCardResponseMessage('multi-target-transfer-supporter', 'supporter'),
            ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature', [ 'high-hp-creature', 'high-hp-creature' ]),
                StateBuilder.withHand(0, [ multiTargetTransferSupporter ]),
                StateBuilder.withEnergy('basic-creature-0', { lightning: 2 }),
            ),
        });

        expect(getExecutedCount()).to.equal(1, 'No real choice with exactly 2 valid targets for count:2 - should auto-resolve');

        const energyState = state.energy;
        expect(energyState.attachedEnergyByInstance['basic-creature-0'].lightning).to.equal(0);
        expect(energyState.attachedEnergyByInstance['high-hp-creature-0-0'].lightning).to.equal(1);
        expect(energyState.attachedEnergyByInstance['high-hp-creature-0-1'].lightning).to.equal(1);
    });

    it('should fail when source has no required energy type', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [ new PlayCardResponseMessage('transfer-supporter', 'supporter') ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature', [ 'high-hp-creature' ]),
                StateBuilder.withHand(0, [ transferSupporter ]),
                StateBuilder.withEnergy('basic-creature-0', { water: 2 }), // Has water but effect needs fire
            ),
        });

        // Should fail validation and not execute
        expect(getExecutedCount()).to.equal(0, 'Should not have executed transfer supporter without required energy');
        
        const energyState = state.energy;
        expect(energyState.attachedEnergyByInstance['basic-creature-0'].water).to.equal(2, 'Active should keep all water energy');
        expect(energyState.attachedEnergyByInstance['high-hp-creature-0-0']).to.be.undefined;
    });

    describe('Energy Target Features', () => {
        const allFireFromBenchRepository = new MockCardRepository({
            creatures: {
                'basic-creature': {
                    templateId: 'basic-creature',
                    name: 'Basic Creature',
                    maxHp: 80,
                    type: 'fire',
                    weakness: 'water',
                    retreatCost: 1,
                    attacks: [{ name: 'Basic Attack', damage: 20, energyRequirements: [{ type: 'fire', amount: 1 }] }],
                },
                'bench-creature': {
                    templateId: 'bench-creature',
                    name: 'Bench Creature',
                    maxHp: 60,
                    type: 'water',
                    weakness: 'grass',
                    retreatCost: 1,
                    attacks: [],
                },
            },
            supporters: {
                'move-all-fire-from-bench': {
                    templateId: 'move-all-fire-from-bench',
                    name: 'Move All Fire From Bench',
                    effects: [{
                        type: 'energy-transfer',
                        source: {
                            type: 'field',
                            fieldTarget: { type: 'fixed', player: 'self', position: 'active' },
                            criteria: { energyTypes: [ 'fire' ] },
                            count: 999, // Move all matching energy
                        },
                        target: { type: 'single-choice', chooser: 'self', criteria: { player: 'self', location: 'field', position: 'bench' }},
                    }],
                },
                'move-energy-from-bench-choice': {
                    templateId: 'move-energy-from-bench-choice',
                    name: 'Move Energy From Bench Choice',
                    effects: [{
                        type: 'energy-transfer',
                        source: {
                            type: 'field',
                            fieldTarget: { type: 'fixed', player: 'self', position: 'active' },
                            criteria: { energyTypes: [ 'fire', 'water', 'grass', 'lightning', 'psychic', 'fighting', 'darkness', 'metal' ] },
                            count: 1,
                        },
                        target: { type: 'single-choice', chooser: 'self', criteria: { player: 'self', location: 'field', position: 'bench' }},
                    }],
                },
                'move-all-energy-from-bench': {
                    templateId: 'move-all-energy-from-bench',
                    name: 'Move All Energy From Bench',
                    effects: [{
                        type: 'energy-transfer',
                        source: {
                            type: 'field',
                            fieldTarget: { type: 'fixed', player: 'self', position: 'active' },
                            criteria: { energyTypes: [ 'fire', 'water', 'grass', 'lightning', 'psychic', 'fighting', 'darkness', 'metal' ] },
                            count: 999,
                        },
                        target: { type: 'single-choice', chooser: 'self', criteria: { player: 'self', location: 'field', position: 'bench' }},
                    }],
                },
            },
        });

        // These tests validate the new energy target system
        it('should move all energy of a certain type from active to bench', () => {
            const { state, getExecutedCount } = runTestGame({
                actions: [ new PlayCardResponseMessage('move-all-fire-from-bench', 'supporter') ],
                customRepository: allFireFromBenchRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature', [ 'bench-creature' ]),
                    StateBuilder.withHand(0, [{ templateId: 'move-all-fire-from-bench', type: 'supporter' }]),
                    StateBuilder.withEnergy('basic-creature-0', { fire: 3, water: 1 }),
                ),
            });

            expect(getExecutedCount()).to.equal(1, 'Should have executed transfer supporter');
            
            const energyState = state.energy;
            expect(energyState.attachedEnergyByInstance['basic-creature-0'].fire).to.equal(0, 'Active should have no fire energy remaining');
            expect(energyState.attachedEnergyByInstance['basic-creature-0'].water).to.equal(1, 'Active should keep water energy');
            expect(energyState.attachedEnergyByInstance['bench-creature-0-0'].fire).to.equal(3, 'Bench should have gained all 3 fire energy');
        });

        it('should move energy from active to a benched creature of choice', () => {
            const { state, getExecutedCount } = runTestGame({
                actions: [ 
                    new PlayCardResponseMessage('move-energy-from-bench-choice', 'supporter'),
                ],
                customRepository: allFireFromBenchRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature', [ 'bench-creature' ]),
                    StateBuilder.withHand(0, [{ templateId: 'move-energy-from-bench-choice', type: 'supporter' }]),
                    StateBuilder.withEnergy('basic-creature-0', { fire: 2 }),
                ),
            });

            expect(getExecutedCount()).to.equal(1, 'Should have executed transfer supporter');
            
            const energyState = state.energy;
            expect(energyState.attachedEnergyByInstance['basic-creature-0'].fire).to.equal(1, 'Active should have 1 fire energy remaining');
            expect(energyState.attachedEnergyByInstance['bench-creature-0-0'].fire).to.equal(1, 'Bench creature should have gained 1 fire energy');
        });

        it('should move all energy from active to bench', () => {
            const { state, getExecutedCount } = runTestGame({
                actions: [ new PlayCardResponseMessage('move-all-energy-from-bench', 'supporter') ],
                customRepository: allFireFromBenchRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature', [ 'bench-creature' ]),
                    StateBuilder.withHand(0, [{ templateId: 'move-all-energy-from-bench', type: 'supporter' }]),
                    StateBuilder.withEnergy('basic-creature-0', { fire: 2, water: 1, lightning: 1 }),
                ),
            });

            expect(getExecutedCount()).to.equal(1, 'Should have executed transfer supporter');
            
            const energyState = state.energy;
            expect(energyState.attachedEnergyByInstance['basic-creature-0'].fire).to.equal(0, 'Active should have no fire energy');
            expect(energyState.attachedEnergyByInstance['basic-creature-0'].water).to.equal(0, 'Active should have no water energy');
            expect(energyState.attachedEnergyByInstance['basic-creature-0'].lightning).to.equal(0, 'Active should have no lightning energy');
            expect(energyState.attachedEnergyByInstance['bench-creature-0-0'].fire).to.equal(2, 'Bench should have gained 2 fire energy');
            expect(energyState.attachedEnergyByInstance['bench-creature-0-0'].water).to.equal(1, 'Bench should have gained 1 water energy');
            expect(energyState.attachedEnergyByInstance['bench-creature-0-0'].lightning).to.equal(1, 'Bench should have gained 1 lightning energy');
        });
    });
});

describe('Energy Discard with Energy Targets', () => {
    describe('Energy Target Features', () => {
        it.skip('should discard two energy from a creature', () => {
            /*
             * TODO: Discard 2 energy of any type from active creature
             * This requires energy target with:
             * - target: field target (active) + energy filter (any) + count (2)
             */
        });

        it.skip('should discard specific energy types (psychic and dark)', () => {
            /*
             * TODO: Discard 1 psychic and 1 dark energy from active creature
             * This requires energy target with:
             * - target: field target (active) + energy filter (psychic, dark) + count (1 each)
             */
        });
    });
});

describe('Energy Transfer from Discard Pile', () => {
    const discardTestRepository = new MockCardRepository({
        creatures: {
            'basic-creature': {
                templateId: 'basic-creature',
                name: 'Basic Creature',
                maxHp: 80,
                type: 'fire',
                weakness: 'water',
                retreatCost: 1,
                attacks: [{ name: 'Basic Attack', damage: 20, energyRequirements: [{ type: 'fire', amount: 1 }] }],
            },
        },
        supporters: {
            'discard-energy-supporter': {
                templateId: 'discard-energy-supporter',
                name: 'Discard Energy Supporter',
                effects: [{
                    type: 'energy-transfer',
                    source: { type: 'discard', count: 1 },
                    target: { type: 'fixed', player: 'self', position: 'active' },
                }],
            },
        },
    });
    const discardEnergySupporter = { templateId: 'discard-energy-supporter', type: 'supporter' as const };

    it('should auto-resolve and attach energy from discard when only one type is present', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [ new PlayCardResponseMessage('discard-energy-supporter', 'supporter') ],
            customRepository: discardTestRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature'),
                StateBuilder.withHand(0, [ discardEnergySupporter ]),
                StateBuilder.withDiscardedEnergy(0, { fire: 2 }),
            ),
        });

        expect(getExecutedCount()).to.equal(1, 'Should have executed without needing a type choice');

        const energyState = state.energy;
        expect(energyState.attachedEnergyByInstance['basic-creature-0'].fire).to.equal(1, 'Active should have gained 1 fire energy');
        expect(energyState.discardedEnergy[0].fire).to.equal(1, 'Discard pile should have 1 fire energy remaining');
    });

    it('should prompt for a type choice when the discard pile has multiple matching types (Dragonair-style)', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [
                new PlayCardResponseMessage('discard-energy-supporter', 'supporter'),
                new SelectEnergyResponseMessage([{ playerId: 0, fieldIndex: -1, energyType: 'water' }]),
            ],
            customRepository: discardTestRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature'),
                StateBuilder.withHand(0, [ discardEnergySupporter ]),
                StateBuilder.withDiscardedEnergy(0, { fire: 1, water: 1 }),
            ),
        });

        expect(getExecutedCount()).to.equal(2, 'Should have executed the supporter and the energy type choice');

        const energyState = state.energy;
        expect(energyState.attachedEnergyByInstance['basic-creature-0'].water).to.equal(1, 'Active should have gained 1 water energy');
        expect(energyState.attachedEnergyByInstance['basic-creature-0'].fire ?? 0).to.equal(0, 'Active should not have gained fire energy');
        expect(energyState.discardedEnergy[0].water).to.equal(0, 'Discard pile should have no water energy remaining');
        expect(energyState.discardedEnergy[0].fire).to.equal(1, 'Discard pile should still have 1 fire energy');
    });
});

describe('Energy Transfer from a Benched Creature of Choice', () => {
    const benchChoiceRepository = new MockCardRepository({
        creatures: {
            'basic-creature': {
                templateId: 'basic-creature',
                name: 'Basic Creature',
                maxHp: 80,
                type: 'fire',
                weakness: 'water',
                retreatCost: 1,
                attacks: [{ name: 'Basic Attack', damage: 20, energyRequirements: [{ type: 'fire', amount: 1 }] }],
            },
            'high-hp-creature': {
                templateId: 'high-hp-creature',
                name: 'High HP Creature',
                maxHp: 140,
                type: 'water',
                weakness: 'grass',
                retreatCost: 2,
                attacks: [{ name: 'Water Attack', damage: 30, energyRequirements: [{ type: 'water', amount: 2 }] }],
            },
        },
        supporters: {
            'bench-energy-transfer-supporter': {
                templateId: 'bench-energy-transfer-supporter',
                name: 'Bench Energy Transfer Supporter',
                effects: [{
                    type: 'energy-transfer',
                    source: {
                        type: 'field',
                        fieldTarget: { type: 'single-choice', chooser: 'self', criteria: { player: 'self', location: 'field', position: 'bench' }},
                        criteria: { energyTypes: [ 'fire', 'water' ] },
                        count: 1,
                    },
                    target: { type: 'fixed', player: 'self', position: 'active' },
                }],
            },
        },
    });
    const benchEnergyTransferSupporter = { templateId: 'bench-energy-transfer-supporter', type: 'supporter' as const };

    it('should prompt for which benched creature when multiple qualify (unaffected by the type-choice fix)', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [
                new PlayCardResponseMessage('bench-energy-transfer-supporter', 'supporter'),
                new SelectEnergyResponseMessage([{ playerId: 0, fieldIndex: 2 }]),
            ],
            customRepository: benchChoiceRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature', [ 'basic-creature', 'high-hp-creature' ]),
                StateBuilder.withHand(0, [ benchEnergyTransferSupporter ]),
                StateBuilder.withEnergy('basic-creature-0-0', { fire: 1 }),
                StateBuilder.withEnergy('high-hp-creature-0-1', { water: 1 }),
            ),
        });

        expect(getExecutedCount()).to.equal(2, 'Should have executed the supporter and the bench creature choice');

        const energyState = state.energy;
        expect(energyState.attachedEnergyByInstance['high-hp-creature-0-1'].water).to.equal(0, 'Chosen bench creature should have given up its water energy');
        expect(energyState.attachedEnergyByInstance['basic-creature-0'].water).to.equal(1, 'Active should have gained 1 water energy');
        expect(energyState.attachedEnergyByInstance['basic-creature-0-0'].fire).to.equal(1, 'Other bench creature should be untouched');
    });

    it('should prompt for an energy TYPE when the sole qualifying benched creature holds 2+ matching types', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [
                new PlayCardResponseMessage('bench-energy-transfer-supporter', 'supporter'),
                new SelectEnergyResponseMessage([{ playerId: 0, fieldIndex: 1, energyType: 'water' }]),
            ],
            customRepository: benchChoiceRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature', [ 'high-hp-creature' ]),
                StateBuilder.withHand(0, [ benchEnergyTransferSupporter ]),
                StateBuilder.withEnergy('high-hp-creature-0-0', { fire: 1, water: 1 }),
            ),
        });

        expect(getExecutedCount()).to.equal(2, 'Should have executed the supporter and the energy type choice');

        const energyState = state.energy;
        expect(energyState.attachedEnergyByInstance['basic-creature-0'].water).to.equal(1, 'Active should have gained 1 water energy');
        expect(energyState.attachedEnergyByInstance['high-hp-creature-0-0'].water).to.equal(0, 'Bench creature should have given up its water energy');
        expect(energyState.attachedEnergyByInstance['high-hp-creature-0-0'].fire).to.equal(1, 'Bench creature should keep its fire energy');
    });
});
