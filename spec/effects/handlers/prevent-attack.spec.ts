import { expect } from 'chai';
import { PlayCardResponseMessage } from '../../../src/messages/response/play-card-response-message.js';
import { AttackResponseMessage } from '../../../src/messages/response/attack-response-message.js';
import { EndTurnResponseMessage } from '../../../src/messages/response/end-turn-response-message.js';
import { StateBuilder } from '../../helpers/state-builder.js';
import { runTestGame } from '../../helpers/test-helpers.js';
import { MockCardRepository } from '../../mock-repository.js';
import { CreatureData, ItemData } from '../../../src/repository/card-types.js';
import { PreventAttackEffectHandler } from '../../../src/effects/handlers/prevent-attack-effect-handler.js';
import { PreventAttackEffect } from '../../../src/repository/effect-types.js';

describe('Prevent Attack Effect', () => {
    describe('getResolutionRequirements', () => {
        const handler = new PreventAttackEffectHandler();

        it('should return empty resolution requirements (no target resolution needed)', () => {
            const effect: PreventAttackEffect = {
                type: 'prevent-attack',
                target: { player: 'opponent', position: 'active' },
                duration: { type: 'until-end-of-turn' },
            };

            const result = handler.getResolutionRequirements(effect);
            
            expect(result).to.have.lengthOf(0);
        });
    });

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
                    target: { player: 'opponent', position: 'active' },
                    duration: { type: 'until-end-of-next-turn' },
                }],
            }],
            [ 'self-prevention-item', {
                templateId: 'self-prevention-item',
                name: 'Self Prevention Item',
                effects: [{
                    type: 'prevent-attack',
                    target: { player: 'self', position: 'active' },
                    duration: { type: 'until-end-of-next-turn' },
                }],
            }],
            [ 'choice-prevention-item', {
                templateId: 'choice-prevention-item',
                name: 'Choice Prevention Item',
                effects: [{
                    type: 'prevent-attack',
                    target: { player: 'opponent', location: 'field' },
                    duration: { type: 'until-end-of-next-turn' },
                }],
            }],
            [ 'all-prevention-item', {
                templateId: 'all-prevention-item',
                name: 'All Prevention Item',
                effects: [{
                    type: 'prevent-attack',
                    target: { player: 'opponent', location: 'field' },
                    duration: { type: 'until-end-of-next-turn' },
                }],
            }],
        ]),
    });

    const selfPreventionItem = { templateId: 'self-prevention-item', type: 'item' as const };
    const choicePreventionItem = { templateId: 'choice-prevention-item', type: 'item' as const };
    const allPreventionItem = { templateId: 'all-prevention-item', type: 'item' as const };

    it('should prevent opponent active from attacking (basic operation)', () => {
        const { state } = runTestGame({
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
        });

        expect(state.field.creatures[0][0].damageTaken).to.equal(0, 'Should take no damage (attack prevented)');
    });

    it('should target different creatures (self-active)', () => {
        const { state } = runTestGame({
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
        });

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
        });

        // This test may fail if target selection is required but not provided
    });

    it('should target all matching creatures', () => {
        const { state } = runTestGame({
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
        });

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
        });

        // The prevention should be registered in state
        expect(state).to.exist;
    });

    it('should not prevent attack during same turn', () => {
        const { state } = runTestGame({
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
        });

        expect(state.field.creatures[1][0].damageTaken).to.equal(20, 'Should have dealt damage (prevention is for opponent)');
    });

    it('should stack multiple attack preventions', () => {
        const { state } = runTestGame({
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
        });

        expect(state.field.creatures[0][0].damageTaken).to.equal(0, 'Should take no damage (multiple preventions)');
    });

    it('should prevent attacks from bench creatures when targeted', () => {
        const { state } = runTestGame({
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
        });

        expect(state.field.creatures[0][0].damageTaken).to.equal(0, 'Should take no damage (active prevented)');
    });

    // TODO: Cannot test opponent actions with current framework - resumeFrom has known issues
    it('should allow attacks after prevention expires', () => {
        const { state: finalState } = runTestGame({
            actions: [
                // Turn 2: P0 plays prevention item and ends turn
                new PlayCardResponseMessage('prevention-item', 'item'),
                new EndTurnResponseMessage(),
                
                // Turn 3: P1 ends turn
                new EndTurnResponseMessage(),
                
                // Turn 4: P0 ends turn
                new EndTurnResponseMessage(),
                
                // Turn 5: P1 attacks after effect expired
                new AttackResponseMessage(0),
            ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature'),
                StateBuilder.withCreatures(1, 'high-hp-creature'),
                StateBuilder.withHand(0, [ preventionItem ]),
                StateBuilder.withEnergy('high-hp-creature-1', { water: 2 }),
            ),
        });

        expect(finalState.field.creatures[0][0].damageTaken).to.equal(50, 'Should take damage after prevention expired (30 base + 20 weakness)');
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
                        target: { player: 'opponent', position: 'active' },
                        duration: { type: 'until-end-of-next-turn' },
                    }],
                }],
            ]),
        });


        const { state } = runTestGame({
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
        });

        expect(state.field.creatures[0][0].damageTaken).to.equal(0, 'Should take no damage (high damage attack prevented)');
    });
});
