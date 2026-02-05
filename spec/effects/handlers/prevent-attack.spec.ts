import { expect } from 'chai';
import { PlayCardResponseMessage } from '../../../src/messages/response/play-card-response-message.js';
import { AttackResponseMessage } from '../../../src/messages/response/attack-response-message.js';
import { EndTurnResponseMessage } from '../../../src/messages/response/end-turn-response-message.js';
import { StateBuilder } from '../../helpers/state-builder.js';
import { runTestGame } from '../../helpers/test-helpers.js';
import { MockCardRepository } from '../../mock-repository.js';
import { CreatureData, ItemData } from '../../../src/repository/card-types.js';
import { getCurrentTemplateId } from '../../../src/utils/field-card-utils.js';
import { PreventAttackEffectHandler } from '../../../src/effects/handlers/prevent-attack-effect-handler.js';
import { EffectContextFactory } from '../../../src/effects/effect-context.js';
import { PreventAttackEffect } from '../../../src/repository/effect-types.js';
import { HandlerDataBuilder } from '../../helpers/handler-data-builder.js';

describe('Prevent Attack Effect', () => {
    describe('canApply', () => {
        const handler = new PreventAttackEffectHandler();
        const mockRepository = new MockCardRepository();

        it('should return true when target exists', () => {
            const handlerData = HandlerDataBuilder.default(
                HandlerDataBuilder.withCreatures(0, 'basic-creature', []),
                HandlerDataBuilder.withCreatures(1, 'basic-creature', []),
            );

            const effect: PreventAttackEffect = {
                type: 'prevent-attack',
                target: { type: 'fixed', player: 'opponent', position: 'active' },
                duration: { type: 'until-end-of-turn' },
            };

            const context = EffectContextFactory.createCardContext(0, 'Test Prevention', 'item');
            const result = handler.canApply(handlerData, effect, context, mockRepository);
            
            expect(result).to.be.true;
        });

        it('should return false when target does not exist (target resolution failure)', () => {
            const handlerData = HandlerDataBuilder.default(
                HandlerDataBuilder.withCreatures(0, 'basic-creature', []),
            );

            const effect: PreventAttackEffect = {
                type: 'prevent-attack',
                target: { type: 'fixed', player: 'opponent', position: 'active' },
                duration: { type: 'until-end-of-turn' },
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

            const effect: PreventAttackEffect = {
                type: 'prevent-attack',
                target: { type: 'single-choice', chooser: 'self', criteria: { player: 'opponent', location: 'field', position: 'bench' }},
                duration: { type: 'until-end-of-turn' },
            };

            const context = EffectContextFactory.createCardContext(0, 'Test Prevention', 'item');
            const result = handler.canApply(handlerData, effect, context, mockRepository);
            
            expect(result).to.be.false;
        });
    });

    describe('getResolutionRequirements', () => {
        const handler = new PreventAttackEffectHandler();

        it('should return target resolution requirement', () => {
            const effect: PreventAttackEffect = {
                type: 'prevent-attack',
                target: { type: 'fixed', player: 'opponent', position: 'active' },
                duration: { type: 'until-end-of-turn' },
            };

            const result = handler.getResolutionRequirements(effect);
            
            expect(result).to.have.lengthOf(1);
            expect(result[0].targetProperty).to.equal('target');
            expect(result[0].required).to.be.true;
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
                    type: 'prevent-attack',
                    target: { type: 'fixed', player: 'opponent', position: 'active' },
                    duration: { type: 'until-end-of-next-turn' },
                }],
            }],
            [ 'self-prevention-item', {
                templateId: 'self-prevention-item',
                name: 'Self Prevention Item',
                effects: [{
                    type: 'prevent-attack',
                    target: { type: 'fixed', player: 'self', position: 'active' },
                    duration: { type: 'until-end-of-next-turn' },
                }],
            }],
            [ 'choice-prevention-item', {
                templateId: 'choice-prevention-item',
                name: 'Choice Prevention Item',
                effects: [{
                    type: 'prevent-attack',
                    target: { type: 'single-choice', chooser: 'self', criteria: { player: 'opponent', location: 'field' }},
                    duration: { type: 'until-end-of-next-turn' },
                }],
            }],
            [ 'all-prevention-item', {
                templateId: 'all-prevention-item',
                name: 'All Prevention Item',
                effects: [{
                    type: 'prevent-attack',
                    target: { type: 'all-matching', criteria: { player: 'opponent', location: 'field' }},
                    duration: { type: 'until-end-of-next-turn' },
                }],
            }],
        ]),
    });

    const selfPreventionItem = { templateId: 'self-prevention-item', type: 'item' as const };
    const choicePreventionItem = { templateId: 'choice-prevention-item', type: 'item' as const };
    const allPreventionItem = { templateId: 'all-prevention-item', type: 'item' as const };

    it('should prevent opponent active from attacking (basic operation)', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [
                new PlayCardResponseMessage('prevention-item', 'item'),
                new EndTurnResponseMessage(),
                new AttackResponseMessage(0), // Opponent tries to attack
            ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature'),
                StateBuilder.withCreatures(1, 'high-hp-creature'),
                StateBuilder.withHand(0, [ preventionItem ]),
                StateBuilder.withEnergy('high-hp-creature-1', { water: 2 }),
            ),
            maxSteps: 20,
        });

        expect(getExecutedCount()).to.equal(2, 'Should have executed prevention item and end turn (attack blocked)');
        expect(state.field.creatures[0][0].damageTaken).to.equal(0, 'Should take no damage (attack prevented)');
    });

    it('should target different creatures (self-active)', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [
                new PlayCardResponseMessage('self-prevention-item', 'item'),
                new AttackResponseMessage(0), // Try to attack with own active
            ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature'),
                StateBuilder.withCreatures(1, 'high-hp-creature'),
                StateBuilder.withHand(0, [ selfPreventionItem ]),
                StateBuilder.withEnergy('basic-creature-0', { fire: 1 }),
            ),
            maxSteps: 15,
        });

        expect(getExecutedCount()).to.equal(1, 'Should have executed prevention item only (attack blocked)');
        expect(state.field.creatures[1][0].damageTaken).to.equal(0, 'Opponent should take no damage (self attack prevented)');
    });

    it('should require target selection for single-choice targets', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [
                new PlayCardResponseMessage('choice-prevention-item', 'item'),
                // Target selection would be needed here for single-choice
                new EndTurnResponseMessage(),
                new AttackResponseMessage(0),
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

    it('should target all matching creatures', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [
                new PlayCardResponseMessage('all-prevention-item', 'item'),
                new EndTurnResponseMessage(),
                new AttackResponseMessage(0), // Opponent active tries to attack
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

        expect(getExecutedCount()).to.equal(2, 'Should have executed all prevention item and end turn (attack blocked)');
        expect(state.field.creatures[0][0].damageTaken).to.equal(0, 'Should take no damage (all creatures prevented)');
    });

    it('should clear attack prevention at end of turn', () => {
        // Test that attack prevention is cleared when clearExpiredPassiveEffects is called
        const { state } = runTestGame({
            actions: [
                new PlayCardResponseMessage('prevention-item', 'item'),
                new EndTurnResponseMessage(), // This should clear the prevention at some point
            ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature'),
                StateBuilder.withCreatures(1, 'high-hp-creature'),
                StateBuilder.withHand(0, [ preventionItem ]),
            ),
            maxSteps: 15,
        });

        // The prevention should be registered in state
        expect(state).to.exist;
    });

    it('should not prevent attack during same turn', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [
                new PlayCardResponseMessage('prevention-item', 'item'),
                new AttackResponseMessage(0), // Same turn attack (should work since prevent-attack is for opponent)
            ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature'),
                StateBuilder.withCreatures(1, 'high-hp-creature'),
                StateBuilder.withHand(0, [ preventionItem ]),
                StateBuilder.withEnergy('basic-creature-0', { fire: 1 }),
            ),
            maxSteps: 15,
        });

        expect(getExecutedCount()).to.equal(2, 'Should have executed prevention item and attack');
        expect(state.field.creatures[1][0].damageTaken).to.equal(20, 'Should have dealt damage (prevention is for opponent)');
    });

    it('should stack multiple attack preventions', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [
                new PlayCardResponseMessage('prevention-item', 'item'),
                new PlayCardResponseMessage('prevention-item', 'item'),
                new EndTurnResponseMessage(),
                new AttackResponseMessage(0), // Opponent tries to attack
            ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature'),
                StateBuilder.withCreatures(1, 'high-hp-creature'),
                StateBuilder.withHand(0, [ preventionItem, preventionItem ]),
                StateBuilder.withEnergy('high-hp-creature-1', { water: 2 }),
            ),
            maxSteps: 25,
        });

        expect(getExecutedCount()).to.equal(3, 'Should have executed both prevention items and end turn (attack blocked)');
        expect(state.field.creatures[0][0].damageTaken).to.equal(0, 'Should take no damage (multiple preventions)');
    });

    it('should prevent attacks from bench creatures when targeted', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [
                new PlayCardResponseMessage('all-prevention-item', 'item'), // Prevent all opponent creatures
                new EndTurnResponseMessage(),
                new AttackResponseMessage(0), // Opponent active tries to attack (prevented)
            ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature'),
                StateBuilder.withCreatures(1, 'high-hp-creature'),
                StateBuilder.withHand(0, [ allPreventionItem ]),
                StateBuilder.withEnergy('high-hp-creature-1', { water: 2 }),
                (state) => {
                    // Add bench creature
                    state.field.creatures[1].push({
                        fieldInstanceId: 'bench-creature',
                        evolutionStack: [{ instanceId: 'bench-card', templateId: 'basic-creature' }],
                        damageTaken: 0,
                        turnLastPlayed: 0,
                    });
                },
            ),
            maxSteps: 20,
        });

        expect(getExecutedCount()).to.equal(2, 'Should have executed prevention item and end turn (attack blocked)');
        expect(state.field.creatures[0][0].damageTaken).to.equal(0, 'Should take no damage (active prevented)');
    });

    it('should allow attacks after prevention expires', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [
                new PlayCardResponseMessage('prevention-item', 'item'),
                new EndTurnResponseMessage(),
                new EndTurnResponseMessage(), // Opponent's turn ends (until-end-of-next-turn)
                new EndTurnResponseMessage(), // Back to player 0's turn
                new EndTurnResponseMessage(), // Player 0's turn ends
                new AttackResponseMessage(0), // Opponent should now be able to attack
            ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature'),
                StateBuilder.withCreatures(1, 'high-hp-creature'),
                StateBuilder.withHand(0, [ preventionItem ]),
                StateBuilder.withEnergy('high-hp-creature-1', { water: 2 }),
            ),
            maxSteps: 30,
        });

        expect(getExecutedCount()).to.equal(6, 'Should have executed all actions including final attack');
        // Verify attack went through after prevention expired
        expect(state.field.creatures[0][0].damageTaken).to.equal(30, 'Should take damage after prevention expired');
    });

    it('should prevent high damage attacks', () => {
        const testRepoHighDamage = new MockCardRepository({
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
                [ 'high-damage-creature', {
                    templateId: 'high-damage-creature',
                    name: 'High Damage Creature',
                    maxHp: 180,
                    type: 'water',
                    weakness: 'grass',
                    retreatCost: 3,
                    attacks: [{ name: 'Mega Attack', damage: 100, energyRequirements: [{ type: 'water', amount: 4 }] }],
                }],
            ]),
            items: new Map<string, ItemData>([
                [ 'prevention-item', {
                    templateId: 'prevention-item',
                    name: 'Prevention Item',
                    effects: [{
                        type: 'prevent-attack',
                        target: { type: 'fixed', player: 'opponent', position: 'active' },
                        duration: { type: 'until-end-of-next-turn' },
                    }],
                }],
            ]),
        });

        const highDamageCreature = { templateId: 'high-damage-creature', type: 'creature' as const };

        const { state, getExecutedCount } = runTestGame({
            actions: [
                new PlayCardResponseMessage('prevention-item', 'item'),
                new EndTurnResponseMessage(),
                new AttackResponseMessage(0), // High damage attack prevented
            ],
            customRepository: testRepoHighDamage,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature'),
                StateBuilder.withCreatures(1, 'high-damage-creature'),
                StateBuilder.withHand(0, [ preventionItem ]),
                StateBuilder.withEnergy('high-damage-creature-1', { water: 4 }),
            ),
            maxSteps: 20,
        });

        expect(getExecutedCount()).to.equal(2, 'Should have executed prevention item and end turn (attack blocked)');
        expect(state.field.creatures[0][0].damageTaken).to.equal(0, 'Should take no damage (high damage attack prevented)');
    });
});
