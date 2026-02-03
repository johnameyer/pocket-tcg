import { expect } from 'chai';
import { PlayCardResponseMessage } from '../../../src/messages/response/play-card-response-message.js';
import { SelectTargetResponseMessage } from '../../../src/messages/response/select-target-response-message.js';
import { StateBuilder } from '../../helpers/state-builder.js';
import { runTestGame } from '../../helpers/test-helpers.js';
import { MockCardRepository } from '../../mock-repository.js';
import { CreatureData, SupporterData } from '../../../src/repository/card-types.js';
import { EnergyTransferEffectHandler } from '../../../src/effects/handlers/energy-transfer-effect-handler.js';
import { EffectContextFactory } from '../../../src/effects/effect-context.js';
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
                energyTypes: [ 'fire' ],
                amount: { type: 'constant', value: 1 },
                source: { type: 'fixed', player: 'self', position: 'active' },
                target: { type: 'single-choice', chooser: 'self', criteria: { player: 'self', location: 'field', position: 'bench' }},
            };

            const context = EffectContextFactory.createCardContext(0, 'Test Transfer', 'item');
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
                energyTypes: [ 'fire' ],
                amount: { type: 'constant', value: 1 },
                source: { type: 'fixed', player: 'self', position: 'active' },
                target: { type: 'single-choice', chooser: 'self', criteria: { player: 'self', location: 'field', position: 'bench' }},
            };

            const context = EffectContextFactory.createCardContext(0, 'Test Transfer', 'item');
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
                energyTypes: [ 'fire' ],
                amount: { type: 'constant', value: 1 },
                source: { type: 'fixed', player: 'self', position: 'active' },
                target: { type: 'single-choice', chooser: 'self', criteria: { player: 'self', location: 'field', position: 'bench' }},
            };

            const context = EffectContextFactory.createCardContext(0, 'Test Transfer', 'item');
            const result = handler.canApply(handlerData, effect, context, mockRepository);
            
            expect(result).to.be.false;
        });
    });

    const basicCreature = { templateId: 'basic-creature', type: 'creature' as const };
    const highHpCreature = { templateId: 'high-hp-creature', type: 'creature' as const };
    const transferSupporter = { templateId: 'transfer-supporter', type: 'supporter' as const };

    const testRepository = new MockCardRepository({
        creatures: new Map<string, CreatureData>([
            [ 'basic-creature', {
                templateId: 'basic-creature',
                name: 'Basic Creature',
                maxHp: 80,
                type: 'fire',
                weakness: 'water',
                retreatCost: 1,
                attacks: [{ name: 'Basic Attack', damage: 20, energyRequirements: [{ type: 'fire', amount: 1 }] }],
            }],
            [ 'high-hp-creature', {
                templateId: 'high-hp-creature',
                name: 'High HP Creature',
                maxHp: 140,
                type: 'water',
                weakness: 'grass',
                retreatCost: 2,
                attacks: [{ name: 'Water Attack', damage: 30, energyRequirements: [{ type: 'water', amount: 2 }] }],
            }],
        ]),
        supporters: new Map<string, SupporterData>([
            [ 'transfer-supporter', {
                templateId: 'transfer-supporter',
                name: 'Transfer Supporter',
                effects: [{
                    type: 'energy-transfer',
                    source: { type: 'fixed', player: 'self', position: 'active' },
                    target: { type: 'single-choice', chooser: 'self', criteria: { player: 'self', location: 'field', position: 'bench' }},
                    amount: { type: 'constant', value: 1 },
                    energyTypes: [ 'fire' ],
                }],
            }],
            [ 'choice-transfer-supporter', {
                templateId: 'choice-transfer-supporter',
                name: 'Choice Transfer Supporter',
                effects: [{
                    type: 'energy-transfer',
                    source: { type: 'single-choice', chooser: 'self', criteria: { player: 'self', location: 'field' }},
                    target: { type: 'single-choice', chooser: 'self', criteria: { player: 'self', location: 'field', position: 'bench' }},
                    amount: { type: 'constant', value: 1 },
                    energyTypes: [ 'fire', 'water' ],
                }],
            }],
            [ 'multi-transfer-supporter', {
                templateId: 'multi-transfer-supporter',
                name: 'Multi Transfer Supporter',
                effects: [{
                    type: 'energy-transfer',
                    source: { type: 'fixed', player: 'self', position: 'active' },
                    target: { type: 'single-choice', chooser: 'self', criteria: { player: 'self', location: 'field', position: 'bench' }},
                    amount: { type: 'constant', value: 2 },
                    energyTypes: [ 'fire' ],
                }],
            }],
            [ 'water-transfer-supporter', {
                templateId: 'water-transfer-supporter',
                name: 'Water Transfer Supporter',
                effects: [{
                    type: 'energy-transfer',
                    source: { type: 'fixed', player: 'self', position: 'active' },
                    target: { type: 'single-choice', chooser: 'self', criteria: { player: 'self', location: 'field', position: 'bench' }},
                    amount: { type: 'constant', value: 1 },
                    energyTypes: [ 'water' ],
                }],
            }],
            [ 'any-energy-transfer-supporter', {
                templateId: 'any-energy-transfer-supporter',
                name: 'Any Energy Transfer Supporter',
                effects: [{
                    type: 'energy-transfer',
                    source: { type: 'fixed', player: 'self', position: 'active' },
                    target: { type: 'single-choice', chooser: 'self', criteria: { player: 'self', location: 'field', position: 'bench' }},
                    amount: { type: 'constant', value: 1 },
                    energyTypes: [ 'fire', 'water', 'grass', 'lightning', 'psychic', 'fighting', 'darkness', 'metal' ],
                }],
            }],
        ]),
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
            maxSteps: 10,
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
            maxSteps: 10,
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
            maxSteps: 10,
        });

        expect(getExecutedCount()).to.equal(1, 'Should have executed multi transfer supporter');
        
        const energyState = state.energy;
        expect(energyState.attachedEnergyByInstance['basic-creature-0'].fire).to.equal(1, 'Active should have 1 fire energy remaining');
        expect(energyState.attachedEnergyByInstance['high-hp-creature-0-0'].fire).to.equal(2, 'Bench should have gained 2 fire energy');
    });

    it('should require target selection for single-choice targets', () => {
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
            maxSteps: 15,
        });

        expect(getExecutedCount()).to.equal(3, 'Should have executed supporter and both target selections');
        
        const energyState = state.energy;
        expect(energyState.attachedEnergyByInstance['basic-creature-0'].fire).to.equal(1, 'Active should have 1 fire energy remaining');
        expect(energyState.attachedEnergyByInstance['high-hp-creature-0-0'].fire).to.equal(1, 'Bench should have gained 1 fire energy');
    });

    it('should handle multiple energy types (any energy)', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [ new PlayCardResponseMessage('any-energy-transfer-supporter', 'supporter') ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature', [ 'high-hp-creature' ]),
                StateBuilder.withHand(0, [ anyEnergyTransferSupporter ]),
                StateBuilder.withEnergy('basic-creature-0', { psychic: 1, lightning: 1 }),
            ),
            maxSteps: 10,
        });

        expect(getExecutedCount()).to.equal(1, 'Should have executed any energy transfer supporter');
        
        const energyState = state.energy;
        // Should transfer the first available energy type from the effect's energyTypes array (lightning in this case)
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
            maxSteps: 10,
        });

        expect(getExecutedCount()).to.equal(1, 'Should have executed multi transfer supporter');
        
        const energyState = state.energy;
        expect(energyState.attachedEnergyByInstance['basic-creature-0'].fire).to.equal(0, 'Active should have no fire energy remaining');
        expect(energyState.attachedEnergyByInstance['high-hp-creature-0-0'].fire).to.equal(1, 'Bench should have gained only 1 fire energy (capped)');
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
            maxSteps: 10,
        });

        // Should fail validation and not execute
        expect(getExecutedCount()).to.equal(0, 'Should not have executed transfer supporter without required energy');
        
        const energyState = state.energy;
        expect(energyState.attachedEnergyByInstance['basic-creature-0'].water).to.equal(2, 'Active should keep all water energy');
        expect(energyState.attachedEnergyByInstance['high-hp-creature-0-0']).to.be.undefined;
    });
});
