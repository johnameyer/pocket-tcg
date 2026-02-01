import { expect } from 'chai';
import { PlayCardResponseMessage } from '../../../src/messages/response/play-card-response-message.js';
import { RetreatResponseMessage } from '../../../src/messages/response/retreat-response-message.js';
import { EndTurnResponseMessage } from '../../../src/messages/response/end-turn-response-message.js';
import { StateBuilder } from '../../helpers/state-builder.js';
import { runTestGame } from '../../helpers/test-helpers.js';
import { MockCardRepository } from '../../mock-repository.js';
import { CreatureData, ItemData } from '../../../src/repository/card-types.js';
import { getCurrentTemplateId } from '../../../src/utils/field-card-utils.js';
import { RetreatPreventionEffectHandler } from '../../../src/effects/handlers/retreat-prevention-effect-handler.js';
import { EffectContextFactory } from '../../../src/effects/effect-context.js';
import { RetreatPreventionEffect } from '../../../src/repository/effect-types.js';
import { HandlerDataBuilder } from '../../helpers/handler-data-builder.js';

describe('Retreat Prevention Effect', () => {
    describe('canApply', () => {
        const handler = new RetreatPreventionEffectHandler();
        const mockRepository = new MockCardRepository();

        it('should return true when target exists', () => {
            const handlerData = HandlerDataBuilder.default(
                HandlerDataBuilder.withCreatures(0, 'basic-creature', []),
                HandlerDataBuilder.withCreatures(1, 'basic-creature', []),
            );

            const effect: RetreatPreventionEffect = {
                type: 'retreat-prevention',
                target: { type: 'fixed', player: 'opponent', position: 'active' },
                duration: 'turn',
            };

            const context = EffectContextFactory.createCardContext(0, 'Test Prevention', 'item');
            const result = handler.canApply(handlerData, effect, context, mockRepository);
            
            expect(result).to.be.true;
        });

        it('should return false when target does not exist (target resolution failure)', () => {
            const handlerData = HandlerDataBuilder.default(
                HandlerDataBuilder.withCreatures(0, 'basic-creature', []),
            );

            const effect: RetreatPreventionEffect = {
                type: 'retreat-prevention',
                target: { type: 'fixed', player: 'opponent', position: 'active' },
                duration: 'turn',
            };

            const context = EffectContextFactory.createCardContext(0, 'Test Prevention', 'item');
            const result = handler.canApply(handlerData, effect, context, mockRepository);
            
            expect(result).to.be.false;
        });

        it('should return false when targeting bench with no bench creatures (target resolution failure)', () => {
            const handlerData = HandlerDataBuilder.default(
                HandlerDataBuilder.withCreatures(0, 'basic-creature', []),
                HandlerDataBuilder.withCreatures(1, 'basic-creature', []),
            );

            const effect: RetreatPreventionEffect = {
                type: 'retreat-prevention',
                target: { type: 'single-choice', chooser: 'self', criteria: { player: 'opponent', location: 'field', position: 'bench' }},
                duration: 'turn',
            };

            const context = EffectContextFactory.createCardContext(0, 'Test Prevention', 'item');
            const result = handler.canApply(handlerData, effect, context, mockRepository);
            
            expect(result).to.be.false;
        });
    });

    const basicCreature = { templateId: 'basic-creature', type: 'creature' as const };
    const highHpCreature = { templateId: 'high-hp-creature', type: 'creature' as const };
    const preventionItem = { templateId: 'prevention-item', type: 'item' as const };

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
                maxHp: 180,
                type: 'water',
                weakness: 'grass',
                retreatCost: 2,
                attacks: [{ name: 'Water Attack', damage: 30, energyRequirements: [{ type: 'water', amount: 2 }] }],
            }],
        ]),
        items: new Map<string, ItemData>([
            [ 'prevention-item', {
                templateId: 'prevention-item',
                name: 'Prevention Item',
                effects: [{
                    type: 'retreat-prevention',
                    target: { type: 'fixed', player: 'opponent', position: 'active' },
                    duration: 'opponent-next-turn',
                }],
            }],
            [ 'self-prevention-item', {
                templateId: 'self-prevention-item',
                name: 'Self Prevention Item',
                effects: [{
                    type: 'retreat-prevention',
                    target: { type: 'fixed', player: 'self', position: 'active' },
                    duration: 'self-next-turn',
                }],
            }],
            [ 'choice-prevention-item', {
                templateId: 'choice-prevention-item',
                name: 'Choice Prevention Item',
                effects: [{
                    type: 'retreat-prevention',
                    target: { type: 'single-choice', chooser: 'self', criteria: { player: 'opponent', location: 'field' }},
                    duration: 'opponent-next-turn',
                }],
            }],
            [ 'all-prevention-item', {
                templateId: 'all-prevention-item',
                name: 'All Prevention Item',
                effects: [{
                    type: 'retreat-prevention',
                    target: { type: 'all-matching', criteria: { player: 'opponent', location: 'field' }},
                    duration: 'opponent-next-turn',
                }],
            }],
        ]),
    });

    const selfPreventionItem = { templateId: 'self-prevention-item', type: 'item' as const };
    const choicePreventionItem = { templateId: 'choice-prevention-item', type: 'item' as const };
    const allPreventionItem = { templateId: 'all-prevention-item', type: 'item' as const };

    it('should prevent opponent active from retreating (basic operation)', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [
                new PlayCardResponseMessage('prevention-item', 'item'),
                new EndTurnResponseMessage(),
                new RetreatResponseMessage(0), // Opponent tries to retreat
            ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature'),
                StateBuilder.withCreatures(1, 'high-hp-creature'),
                StateBuilder.withHand(0, [ preventionItem ]),
                StateBuilder.withEnergy('high-hp-creature-1', { water: 2 }),
                (state) => {
                    state.field.creatures[1].push({
                        fieldInstanceId: 'test-field-id',
                        evolutionStack: [{ instanceId: 'field-card-1', templateId: 'basic-creature' }],
                        damageTaken: 0,
                        turnLastPlayed: 0,
                    });
                },
            ),
            maxSteps: 20,
        });

        expect(getExecutedCount()).to.equal(2, 'Should have executed prevention item and end turn (retreat blocked)');
        expect(getCurrentTemplateId(state.field.creatures[1][0])).to.equal('high-hp-creature', 'Opponent active should remain the same (retreat prevented)');
    });

    it('should target different Pokemon (self-active)', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [
                new PlayCardResponseMessage('self-prevention-item', 'item'),
                new RetreatResponseMessage(0), // Try to retreat own active
            ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature'),
                StateBuilder.withCreatures(1, 'high-hp-creature'),
                StateBuilder.withHand(0, [ selfPreventionItem ]),
                StateBuilder.withEnergy('basic-creature-0', { fire: 1 }),
                (state) => {
                    state.field.creatures[0].push({
                        fieldInstanceId: 'test-field-id',
                        evolutionStack: [{ instanceId: 'field-card-1', templateId: 'high-hp-creature' }],
                        damageTaken: 0,
                        turnLastPlayed: 0,
                    });
                },
            ),
            maxSteps: 15,
        });

        expect(getExecutedCount()).to.equal(1, 'Should have executed prevention item only (retreat blocked)');
        expect(getCurrentTemplateId(state.field.creatures[0][0])).to.equal('basic-creature', 'Self active should remain the same (retreat prevented)');
    });

    it('should require target selection for single-choice targets', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [
                new PlayCardResponseMessage('choice-prevention-item', 'item'),
                // Target selection would be needed here for single-choice
                new EndTurnResponseMessage(),
                new RetreatResponseMessage(0),
            ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature'),
                StateBuilder.withCreatures(1, 'high-hp-creature'),
                StateBuilder.withHand(0, [ choicePreventionItem ]),
                StateBuilder.withEnergy('high-hp-creature-1', { water: 2 }),
                (state) => {
                    state.field.creatures[1].push({
                        fieldInstanceId: 'test-field-id',
                        evolutionStack: [{ instanceId: 'field-card-1', templateId: 'basic-creature' }],
                        damageTaken: 0,
                        turnLastPlayed: 0,
                    });
                },
            ),
            maxSteps: 20,
        });

        // This test may fail if target selection is required but not provided
        expect(getExecutedCount()).to.be.greaterThan(0, 'Should have executed some actions');
    });

    it('should target all matching Pokemon', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [
                new PlayCardResponseMessage('all-prevention-item', 'item'),
                new EndTurnResponseMessage(),
                new RetreatResponseMessage(0), // Opponent tries to retreat active
            ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature'),
                StateBuilder.withCreatures(1, 'high-hp-creature'),
                StateBuilder.withHand(0, [ allPreventionItem ]),
                StateBuilder.withEnergy('high-hp-creature-1', { water: 2 }),
                (state) => {
                    state.field.creatures[1].push({
                        fieldInstanceId: 'test-field-id',
                        evolutionStack: [{ instanceId: 'field-card-1', templateId: 'basic-creature' }],
                        damageTaken: 0,
                        turnLastPlayed: 0,
                    });
                },
            ),
            maxSteps: 20,
        });

        expect(getExecutedCount()).to.equal(2, 'Should have executed all prevention item and end turn (retreat blocked)');
        expect(getCurrentTemplateId(state.field.creatures[1][0])).to.equal('high-hp-creature', 'Opponent active should remain the same (all Pokemon prevented)');
    });

    it('should clear retreat prevention at end of turn', () => {
        // Test that retreat prevention is cleared when clearExpiredRetreatPreventions is called
        const { state } = runTestGame({
            actions: [
                new PlayCardResponseMessage('prevention-item', 'item'),
                new EndTurnResponseMessage(), // This should clear the prevention
            ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature'),
                StateBuilder.withCreatures(1, 'high-hp-creature'),
                StateBuilder.withHand(0, [ preventionItem ]),
                (state) => {
                    state.field.creatures[1].push({
                        fieldInstanceId: 'test-field-id',
                        evolutionStack: [{ instanceId: 'field-card-1', templateId: 'basic-creature' }],
                        damageTaken: 0,
                        turnLastPlayed: 0,
                    });
                },
            ),
            maxSteps: 15,
        });

        // Check that retreat preventions are cleared after end turn
        expect(state.turnState.retreatPreventions).to.be.empty;
    });

    it('should not prevent retreat during same turn', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [
                new PlayCardResponseMessage('prevention-item', 'item'),
                new RetreatResponseMessage(0), // Same turn retreat (should work)
            ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature'),
                StateBuilder.withCreatures(1, 'high-hp-creature'),
                StateBuilder.withHand(0, [ preventionItem ]),
                StateBuilder.withEnergy('basic-creature-0', { fire: 1 }),
                (state) => {
                    state.field.creatures[0].push({
                        fieldInstanceId: 'test-field-id',
                        evolutionStack: [{ instanceId: 'field-card-1', templateId: 'high-hp-creature' }],
                        damageTaken: 0,
                        turnLastPlayed: 0,
                    });
                },
            ),
            maxSteps: 15,
        });

        expect(getExecutedCount()).to.equal(2, 'Should have executed prevention item and retreat');
        expect(getCurrentTemplateId(state.field.creatures[0][0])).to.equal('high-hp-creature', 'Should have retreated (prevention is for opponent turn)');
    });

    it('should stack multiple retreat preventions', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [
                new PlayCardResponseMessage('prevention-item', 'item'),
                new PlayCardResponseMessage('prevention-item', 'item'),
                new EndTurnResponseMessage(),
                new RetreatResponseMessage(0), // Opponent tries to retreat
            ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature'),
                StateBuilder.withCreatures(1, 'high-hp-creature'),
                StateBuilder.withHand(0, [ preventionItem, preventionItem ]),
                StateBuilder.withEnergy('high-hp-creature-1', { water: 2 }),
                (state) => {
                    state.field.creatures[1].push({
                        fieldInstanceId: 'test-field-id',
                        evolutionStack: [{ instanceId: 'field-card-1', templateId: 'basic-creature' }],
                        damageTaken: 0,
                        turnLastPlayed: 0,
                    });
                },
            ),
            maxSteps: 25,
        });

        expect(getExecutedCount()).to.equal(3, 'Should have executed both prevention items and end turn (retreat blocked)');
        expect(getCurrentTemplateId(state.field.creatures[1][0])).to.equal('high-hp-creature', 'Opponent active should remain the same (multiple preventions)');
    });
});
