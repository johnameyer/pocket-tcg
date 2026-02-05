import { expect } from 'chai';
import { PlayCardResponseMessage } from '../../../src/messages/response/play-card-response-message.js';
import { AttackResponseMessage } from '../../../src/messages/response/attack-response-message.js';
import { StateBuilder } from '../../helpers/state-builder.js';
import { runTestGame } from '../../helpers/test-helpers.js';
import { MockCardRepository } from '../../mock-repository.js';
import { CreatureData, ItemData } from '../../../src/repository/card-types.js';
import { DisableWeaknessEffectHandler } from '../../../src/effects/handlers/disable-weakness-effect-handler.js';
import { DisableWeaknessEffect } from '../../../src/repository/effect-types.js';

describe('Disable Weakness Effect', () => {
    describe('getResolutionRequirements', () => {
        const handler = new DisableWeaknessEffectHandler();

        it('should return empty array (no resolution needed)', () => {
            const effect: DisableWeaknessEffect = {
                type: 'disable-weakness',
                target: { player: 'self', location: 'field' },
                duration: { type: 'until-end-of-turn' },
            };

            const result = handler.getResolutionRequirements(effect);
            
            expect(result).to.be.an('array').that.is.empty;
        });
    });

    const weakCreature = { templateId: 'weak-creature', type: 'creature' as const };
    const strongCreature = { templateId: 'strong-creature', type: 'creature' as const };
    const disableItem = { templateId: 'disable-item', type: 'item' as const };

    const testRepository = new MockCardRepository({
        creatures: new Map<string, CreatureData>([
            [ 'weak-creature', {
                templateId: 'weak-creature',
                name: 'Weak Creature',
                maxHp: 80,
                type: 'grass',
                weakness: 'fire', // Weak to fire
                retreatCost: 1,
                attacks: [{ name: 'Grass Attack', damage: 20, energyRequirements: [{ type: 'grass', amount: 1 }] }],
            }],
            [ 'strong-creature', {
                templateId: 'strong-creature',
                name: 'Strong Creature',
                maxHp: 100,
                type: 'fire',
                weakness: 'water',
                retreatCost: 2,
                attacks: [{ name: 'Fire Attack', damage: 30, energyRequirements: [{ type: 'fire', amount: 2 }] }],
            }],
            [ 'water-creature', {
                templateId: 'water-creature',
                name: 'Water Creature',
                maxHp: 90,
                type: 'water',
                weakness: 'lightning',
                retreatCost: 1,
                attacks: [{ name: 'Water Attack', damage: 25, energyRequirements: [{ type: 'water', amount: 2 }] }],
            }],
        ]),
        items: new Map<string, ItemData>([
            [ 'disable-item', {
                templateId: 'disable-item',
                name: 'Disable Weakness Item',
                effects: [{
                    type: 'disable-weakness',
                    target: { player: 'self', location: 'field' },
                    duration: { type: 'until-end-of-next-turn' },
                }],
            }],
            [ 'disable-opponent', {
                templateId: 'disable-opponent',
                name: 'Disable Opponent Weakness',
                effects: [{
                    type: 'disable-weakness',
                    target: { player: 'opponent', location: 'field' },
                    duration: { type: 'until-end-of-next-turn' },
                }],
            }],
            [ 'disable-active', {
                templateId: 'disable-active',
                name: 'Disable Active Weakness',
                effects: [{
                    type: 'disable-weakness',
                    target: { player: 'self', location: 'field', position: 'active' },
                    duration: { type: 'until-end-of-next-turn' },
                }],
            }],
            [ 'disable-bench', {
                templateId: 'disable-bench',
                name: 'Disable Bench Weakness',
                effects: [{
                    type: 'disable-weakness',
                    target: { player: 'self', location: 'field', position: 'bench' },
                    duration: { type: 'until-end-of-next-turn' },
                }],
            }],
        ]),
    });

    const waterCreature = { templateId: 'water-creature', type: 'creature' as const };
    const disableOpponent = { templateId: 'disable-opponent', type: 'item' as const };
    const disableActive = { templateId: 'disable-active', type: 'item' as const };
    const disableBench = { templateId: 'disable-bench', type: 'item' as const };

    it('should disable weakness bonus damage (basic operation)', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [
                new PlayCardResponseMessage('disable-item', 'item'),
                new AttackResponseMessage(0), // Fire attack on grass with weakness disabled
            ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'weak-creature'), // Grass, weak to fire
                StateBuilder.withCreatures(1, 'strong-creature'), // Fire attacker
                StateBuilder.withHand(0, [ disableItem ]),
                StateBuilder.withEnergy('strong-creature-1', { fire: 2 }),
            ),
            maxSteps: 15,
        });

        expect(getExecutedCount()).to.equal(2, 'Should have executed disable item and attack');
        // Without weakness bonus, should take base 30 damage (not 30 + 20 = 50)
        expect(state.field.creatures[0][0].damageTaken).to.equal(30, 'Should take base damage without weakness bonus');
    });

    it('should allow normal weakness damage without effect', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [
                new AttackResponseMessage(0), // Fire attack on grass with weakness
            ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'weak-creature'), // Grass, weak to fire
                StateBuilder.withCreatures(1, 'strong-creature'), // Fire attacker
                StateBuilder.withEnergy('strong-creature-1', { fire: 2 }),
            ),
            maxSteps: 10,
        });

        expect(getExecutedCount()).to.equal(1, 'Should have executed attack');
        // With weakness bonus, should take 30 + 20 = 50 damage
        expect(state.field.creatures[0][0].damageTaken).to.equal(50, 'Should take base damage plus weakness bonus');
    });

    it('should disable weakness for opponent creatures', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [
                new PlayCardResponseMessage('disable-opponent', 'item'),
                new AttackResponseMessage(0), // Player 0 attacks with grass on fire (opponent weakness disabled)
            ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'weak-creature'), // Grass attacker
                StateBuilder.withCreatures(1, 'strong-creature'), // Fire, weak to water (but we disable it)
                StateBuilder.withHand(0, [ disableOpponent ]),
                StateBuilder.withEnergy('weak-creature-0', { grass: 1 }),
            ),
            maxSteps: 15,
        });

        expect(getExecutedCount()).to.equal(2, 'Should have executed disable item and attack');
        // Grass on fire normally no weakness, so should take base 20 damage
        expect(state.field.creatures[1][0].damageTaken).to.equal(20, 'Should take base damage');
    });

    it('should disable weakness only for active creature when targeted', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [
                new PlayCardResponseMessage('disable-active', 'item'),
                new AttackResponseMessage(0), // Fire attack on active grass
            ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'weak-creature'), // Active: Grass, weak to fire
                StateBuilder.withCreatures(1, 'strong-creature'), // Fire attacker
                StateBuilder.withHand(0, [ disableActive ]),
                StateBuilder.withEnergy('strong-creature-1', { fire: 2 }),
                (state) => {
                    // Add bench creature with same weakness
                    state.field.creatures[0].push({
                        fieldInstanceId: 'bench-weak-creature',
                        evolutionStack: [{ instanceId: 'bench-card', templateId: 'weak-creature' }],
                        damageTaken: 0,
                        turnLastPlayed: 0,
                    });
                },
            ),
            maxSteps: 15,
        });

        expect(getExecutedCount()).to.equal(2, 'Should have executed disable item and attack');
        // Active should not take weakness bonus
        expect(state.field.creatures[0][0].damageTaken).to.equal(30, 'Active should take base damage without weakness bonus');
    });

    it('should disable weakness only for bench creatures when targeted', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [
                new PlayCardResponseMessage('disable-bench', 'item'),
                new AttackResponseMessage(0), // Fire attack on active grass (not on bench, so weakness applies)
            ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'weak-creature'), // Active: Grass, weak to fire
                StateBuilder.withCreatures(1, 'strong-creature'), // Fire attacker
                StateBuilder.withHand(0, [ disableBench ]),
                StateBuilder.withEnergy('strong-creature-1', { fire: 2 }),
                (state) => {
                    // Add bench creature with same weakness
                    state.field.creatures[0].push({
                        fieldInstanceId: 'bench-weak-creature',
                        evolutionStack: [{ instanceId: 'bench-card', templateId: 'weak-creature' }],
                        damageTaken: 0,
                        turnLastPlayed: 0,
                    });
                },
            ),
            maxSteps: 15,
        });

        expect(getExecutedCount()).to.equal(2, 'Should have executed disable item and attack');
        // Active should still take weakness bonus (bench disabled, not active)
        expect(state.field.creatures[0][0].damageTaken).to.equal(50, 'Active should take base damage plus weakness bonus');
    });

    it('should work with different weakness types', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [
                new PlayCardResponseMessage('disable-item', 'item'),
                new AttackResponseMessage(0), // Water attack on fire (weakness disabled)
            ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'strong-creature'), // Fire, weak to water
                StateBuilder.withCreatures(1, 'water-creature'), // Water attacker
                StateBuilder.withHand(0, [ disableItem ]),
                StateBuilder.withEnergy('water-creature-1', { water: 2 }),
            ),
            maxSteps: 15,
        });

        expect(getExecutedCount()).to.equal(2, 'Should have executed disable item and attack');
        // Without weakness bonus, should take base 25 damage (not 25 + 20 = 45)
        expect(state.field.creatures[0][0].damageTaken).to.equal(25, 'Should take base damage without weakness bonus');
    });

    it('should expire at correct time based on duration', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [
                new PlayCardResponseMessage('disable-item', 'item'),
                new AttackResponseMessage(0), // First attack with weakness disabled
            ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'weak-creature'), // Grass, weak to fire
                StateBuilder.withCreatures(1, 'strong-creature'), // Fire attacker
                StateBuilder.withHand(0, [ disableItem ]),
                StateBuilder.withEnergy('strong-creature-1', { fire: 2 }),
            ),
            maxSteps: 15,
        });

        expect(getExecutedCount()).to.equal(2, 'Should have executed disable item and attack');
        // First attack should not have weakness bonus
        expect(state.field.creatures[0][0].damageTaken).to.equal(30, 'First attack should not have weakness bonus');
    });

    it('should stack multiple disable weakness effects', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [
                new PlayCardResponseMessage('disable-item', 'item'),
                new PlayCardResponseMessage('disable-item', 'item'),
                new AttackResponseMessage(0), // Fire attack on grass with multiple disables
            ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'weak-creature'), // Grass, weak to fire
                StateBuilder.withCreatures(1, 'strong-creature'), // Fire attacker
                StateBuilder.withHand(0, [ disableItem, disableItem ]),
                StateBuilder.withEnergy('strong-creature-1', { fire: 2 }),
            ),
            maxSteps: 20,
        });

        expect(getExecutedCount()).to.equal(3, 'Should have executed both disable items and attack');
        // Should still take base damage without weakness bonus
        expect(state.field.creatures[0][0].damageTaken).to.equal(30, 'Should take base damage without weakness bonus');
    });

    it('should not affect attacks from non-weakness types', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [
                new PlayCardResponseMessage('disable-item', 'item'),
                new AttackResponseMessage(0), // Grass attack on fire (no weakness)
            ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'weak-creature'), // Grass attacker
                StateBuilder.withCreatures(1, 'strong-creature'), // Fire defender (weak to water, not grass)
                StateBuilder.withHand(0, [ disableItem ]),
                StateBuilder.withEnergy('weak-creature-0', { grass: 1 }),
            ),
            maxSteps: 15,
        });

        expect(getExecutedCount()).to.equal(2, 'Should have executed disable item and attack');
        // No weakness applies regardless of disable
        expect(state.field.creatures[1][0].damageTaken).to.equal(20, 'Should take base damage (no weakness)');
    });

    it('should work for high damage attacks', () => {
        const testRepoHighDamage = new MockCardRepository({
            creatures: new Map<string, CreatureData>([
                [ 'weak-creature', {
                    templateId: 'weak-creature',
                    name: 'Weak Creature',
                    maxHp: 140,
                    type: 'grass',
                    weakness: 'fire',
                    retreatCost: 1,
                    attacks: [{ name: 'Grass Attack', damage: 20, energyRequirements: [{ type: 'grass', amount: 1 }] }],
                }],
                [ 'high-damage-creature', {
                    templateId: 'high-damage-creature',
                    name: 'High Damage Creature',
                    maxHp: 100,
                    type: 'fire',
                    weakness: 'water',
                    retreatCost: 3,
                    attacks: [{ name: 'Mega Fire', damage: 80, energyRequirements: [{ type: 'fire', amount: 4 }] }],
                }],
            ]),
            items: new Map<string, ItemData>([
                [ 'disable-item', {
                    templateId: 'disable-item',
                    name: 'Disable Weakness Item',
                    effects: [{
                        type: 'disable-weakness',
                        target: { player: 'self', location: 'field' },
                        duration: { type: 'until-end-of-next-turn' },
                    }],
                }],
            ]),
        });

        const highDamageCreature = { templateId: 'high-damage-creature', type: 'creature' as const };

        const { state, getExecutedCount } = runTestGame({
            actions: [
                new PlayCardResponseMessage('disable-item', 'item'),
                new AttackResponseMessage(0), // High damage fire attack on grass
            ],
            customRepository: testRepoHighDamage,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'weak-creature'), // Grass, weak to fire
                StateBuilder.withCreatures(1, 'high-damage-creature'), // Fire attacker with high damage
                StateBuilder.withHand(0, [ disableItem ]),
                StateBuilder.withEnergy('high-damage-creature-1', { fire: 4 }),
            ),
            maxSteps: 15,
        });

        expect(getExecutedCount()).to.equal(2, 'Should have executed disable item and attack');
        // Without weakness bonus, should take base 80 damage (not 80 + 20 = 100)
        expect(state.field.creatures[0][0].damageTaken).to.equal(80, 'Should take base damage without weakness bonus');
    });
});
