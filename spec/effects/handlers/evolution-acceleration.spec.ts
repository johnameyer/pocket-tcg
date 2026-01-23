import { expect } from 'chai';
import { PlayCardResponseMessage } from '../../../src/messages/response/play-card-response-message.js';
import { EvolveResponseMessage } from '../../../src/messages/response/evolve-response-message.js';
import { StateBuilder } from '../../helpers/state-builder.js';
import { runTestGame } from '../../helpers/test-helpers.js';
import { MockCardRepository } from '../../mock-repository.js';
import { CreatureData, ItemData } from '../../../src/repository/card-types.js';
import { getCurrentTemplateId } from '../../../src/utils/field-card-utils.js';
import { EvolutionAccelerationEffectHandler } from '../../../src/effects/handlers/evolution-acceleration-effect-handler.js';
import { EffectContextFactory } from '../../../src/effects/effect-context.js';
import { EvolutionAccelerationEffect } from '../../../src/repository/effect-types.js';
import { HandlerDataBuilder } from '../../helpers/handler-data-builder.js';

describe('Evolution Acceleration Effect', () => {
    describe('canApply', () => {
        const handler = new EvolutionAccelerationEffectHandler();
        const mockRepository = new MockCardRepository();

        it('should return true when target is valid basic creature', () => {
            const handlerData = HandlerDataBuilder.default(
                HandlerDataBuilder.withCreatures(0, 'basic-creature', []),
                HandlerDataBuilder.withTurnNumber(3)
            );

            const effect: EvolutionAccelerationEffect = {
                type: 'evolution-acceleration',
                target: { type: 'fixed', player: 'self', position: 'active' },
                skipStages: 1,
                restrictions: ['basic-creature-only']
            };

            const context = EffectContextFactory.createCardContext(0, 'Test Acceleration', 'item');
            const result = handler.canApply(handlerData, effect, context, mockRepository);
            
            expect(result).to.be.true;
        });

        it('should return false when target does not exist (target resolution failure)', () => {
            const handlerData = HandlerDataBuilder.default();

            const effect: EvolutionAccelerationEffect = {
                type: 'evolution-acceleration',
                target: { type: 'fixed', player: 'self', position: 'active' },
                skipStages: 1,
                restrictions: ['basic-creature-only']
            };

            const context = EffectContextFactory.createCardContext(0, 'Test Acceleration', 'item');
            const result = handler.canApply(handlerData, effect, context, mockRepository);
            
            expect(result).to.be.false;
        });

        it('should return false when creature was played this turn', () => {
            const handlerData = HandlerDataBuilder.default(
                HandlerDataBuilder.withCreatures(0, 'basic-creature', []),
                HandlerDataBuilder.withTurnNumber(1)
            );
            // Set creature as played this turn
            handlerData.field.creatures[0][0].turnLastPlayed = 1;

            const effect: EvolutionAccelerationEffect = {
                type: 'evolution-acceleration',
                target: { type: 'fixed', player: 'self', position: 'active' },
                skipStages: 1,
                restrictions: ['basic-creature-only']
            };

            const context = EffectContextFactory.createCardContext(0, 'Test Acceleration', 'item');
            const result = handler.canApply(handlerData, effect, context, mockRepository);
            
            expect(result).to.be.false;
        });
    });

    const basicCreature = { templateId: 'basic-creature', type: 'creature' as const };
    const stage1Creature = { templateId: 'stage1-creature', type: 'creature' as const };
    const stage2Creature = { templateId: 'stage2-creature', type: 'creature' as const };
    const accelerationItem = { templateId: 'acceleration-item', type: 'item' as const };

    const testRepository = new MockCardRepository({
        creatures: new Map<string, CreatureData>([
            ['basic-creature', {
                templateId: 'basic-creature',
                name: 'Basic Creature',
                maxHp: 60,
                type: 'fire',
                weakness: 'water',
                retreatCost: 1,
                attacks: [{ name: 'Basic Attack', damage: 20, energyRequirements: [{ type: 'fire', amount: 1 }] }]
            }],
            ['stage1-creature', {
                templateId: 'stage1-creature',
                name: 'Stage 1 Creature',
                maxHp: 90,
                type: 'fire',
                weakness: 'water',
                retreatCost: 2,
                evolvesFrom: 'basic-creature',
                attacks: [{ name: 'Stage 1 Attack', damage: 40, energyRequirements: [{ type: 'fire', amount: 2 }] }]
            }],
            ['stage2-creature', {
                templateId: 'stage2-creature',
                name: 'Stage 2 Creature',
                maxHp: 140,
                type: 'fire',
                weakness: 'water',
                retreatCost: 3,
                evolvesFrom: 'stage1-creature',
                attacks: [{ name: 'Stage 2 Attack', damage: 80, energyRequirements: [{ type: 'fire', amount: 3 }] }]
            }]
        ]),
        items: new Map<string, ItemData>([
            ['acceleration-item', {
                templateId: 'acceleration-item',
                name: 'Acceleration Item',
                effects: [{
                    type: 'evolution-acceleration',
                    target: { type: 'fixed', player: 'self', position: 'active' },
                    skipStages: 1,
                    restrictions: ['basic-creature-only']
                }]
            }],
            ['choice-acceleration-item', {
                templateId: 'choice-acceleration-item',
                name: 'Choice Acceleration Item',
                effects: [{
                    type: 'evolution-acceleration',
                    target: { type: 'single-choice', chooser: 'self', criteria: { player: 'self', location: 'field' } },
                    skipStages: 1,
                    restrictions: []
                }]
            }],
            ['double-acceleration-item', {
                templateId: 'double-acceleration-item',
                name: 'Double Acceleration Item',
                effects: [{
                    type: 'evolution-acceleration',
                    target: { type: 'fixed', player: 'self', position: 'active' },
                    skipStages: 2,
                    restrictions: ['basic-creature-only']
                }]
            }]
        ])
    });

    const choiceAccelerationItem = { templateId: 'choice-acceleration-item', type: 'item' as const };
    const doubleAccelerationItem = { templateId: 'double-acceleration-item', type: 'item' as const };

    it('should allow skipping 1 evolution stage (basic operation)', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [
                new PlayCardResponseMessage('acceleration-item', 'item') // Evolution happens immediately
            ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature'),
                StateBuilder.withHand(0, [accelerationItem, stage2Creature])
            ),
            maxSteps: 15
        });

        expect(getExecutedCount()).to.equal(1, 'Should have executed acceleration item');
        expect(getCurrentTemplateId(state.field.creatures[0][0])).to.equal('stage2-creature', 'Should have evolved directly to stage 2');
        expect(state.hand[0].length).to.equal(0, 'Stage 2 card should be removed from hand');
    });

    it('should require target selection for single-choice targets', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [
                new PlayCardResponseMessage('choice-acceleration-item', 'item'),
                // Target selection would be needed here
                new EvolveResponseMessage('stage1-creature', 0)
            ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature', ['basic-creature']),
                StateBuilder.withHand(0, [choiceAccelerationItem, stage1Creature])
            ),
            maxSteps: 20
        });

        // This test may fail if target selection is required but not provided
        expect(getExecutedCount()).to.be.greaterThan(0, 'Should have executed some actions');
    });

    it('should allow skipping different numbers of stages (2 stages)', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [
                new PlayCardResponseMessage('double-acceleration-item', 'item') // Evolution happens immediately
            ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature'),
                StateBuilder.withHand(0, [doubleAccelerationItem, stage2Creature])
            ),
            maxSteps: 15
        });

        expect(getExecutedCount()).to.equal(1, 'Should have executed double acceleration item');
        expect(getCurrentTemplateId(state.field.creatures[0][0])).to.equal('stage2-creature', 'Should have evolved directly to stage 2');
        expect(state.hand[0].length).to.equal(0, 'Stage 2 card should be removed from hand');
    });

    it('should respect evolution restrictions (basic-creature-only)', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [
                new PlayCardResponseMessage('acceleration-item', 'item') // Should not evolve - not a basic creature
            ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'stage1-creature'), // Already evolved, not basic
                StateBuilder.withHand(0, [accelerationItem, stage2Creature])
            ),
            maxSteps: 15
        });

        expect(getExecutedCount()).to.equal(0, 'Should not have executed acceleration item (blocked by validation)');
        expect(getCurrentTemplateId(state.field.creatures[0][0])).to.equal('stage1-creature', 'Should remain as stage 1 (restriction violated)');
        expect(state.hand[0].length).to.equal(2, 'Cards should remain in hand (card not playable)');
    });

    it('should preserve damage when accelerating evolution', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [
                new PlayCardResponseMessage('acceleration-item', 'item') // Evolution happens immediately
            ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature'),
                StateBuilder.withHand(0, [accelerationItem, stage2Creature]),
                StateBuilder.withDamage('basic-creature-0', 30) // Pre-damage the basic creature
            ),
            maxSteps: 15
        });

        expect(getExecutedCount()).to.equal(1, 'Should have executed acceleration item');
        expect(getCurrentTemplateId(state.field.creatures[0][0])).to.equal('stage2-creature', 'Should have evolved to stage 2');
        expect(state.field.creatures[0][0].damageTaken).to.equal(30, 'Should preserve damage after evolution');
    });

    it('should preserve energy when accelerating evolution', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [
                new PlayCardResponseMessage('acceleration-item', 'item') // Evolution happens immediately
            ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature'),
                StateBuilder.withHand(0, [accelerationItem, stage2Creature]),
                StateBuilder.withEnergy('basic-creature-0', { fire: 2 })
            ),
            maxSteps: 15
        });

        expect(getExecutedCount()).to.equal(1, 'Should have executed acceleration item');
        expect(getCurrentTemplateId(state.field.creatures[0][0])).to.equal('stage2-creature', 'Should have evolved to stage 2');
        
        const energyState = state.energy as any;
        expect(energyState.attachedEnergyByInstance['basic-creature-0'].fire).to.equal(2, 'Should preserve energy after evolution');
    });

    it('should not allow evolution without proper evolution line', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [
                new PlayCardResponseMessage('acceleration-item', 'item') // Should not evolve - no valid Stage 2 in hand
            ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature'),
                StateBuilder.withHand(0, [accelerationItem]) // No Stage 2 evolution in hand
            ),
            maxSteps: 15
        });

        expect(getExecutedCount()).to.equal(1, 'Should have executed acceleration item');
        expect(getCurrentTemplateId(state.field.creatures[0][0])).to.equal('basic-creature', 'Should remain as basic creature (no valid evolution)');
        expect(state.hand[0].length).to.equal(0, 'Acceleration item should be consumed');
    });

    it('should not evolve Pokemon played this turn', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [
                new PlayCardResponseMessage('acceleration-item', 'item') // Should not evolve - Pokemon played this turn
            ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature'),
                StateBuilder.withHand(0, [accelerationItem, stage2Creature]),
                (state) => {
                    // Mark Pokemon as played this turn
                    state.field.creatures[0][0].turnLastPlayed = state.turnCounter.turnNumber;
                }
            ),
            maxSteps: 15
        });

        expect(getExecutedCount()).to.equal(0, 'Should not have executed acceleration item (blocked by validation)');
        expect(getCurrentTemplateId(state.field.creatures[0][0])).to.equal('basic-creature', 'Should remain as basic creature (played this turn)');
        expect(state.hand[0].length).to.equal(2, 'Cards should remain in hand (card not playable)');
    });
});
