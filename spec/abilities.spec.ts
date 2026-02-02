import { expect } from 'chai';
import { PlayCardResponseMessage } from '../src/messages/response/play-card-response-message.js';
import { AttackResponseMessage } from '../src/messages/response/attack-response-message.js';
import { CardRepository } from '../src/repository/card-repository.js';
import { CreatureData, SupporterData, ItemData, ToolData } from '../src/repository/card-types.js';
import { StateBuilder } from './helpers/state-builder.js';
import { runTestGame } from './helpers/test-helpers.js';

describe('Creature Abilities', () => {
    const mockCreatureData = new Map<string, CreatureData>([
        [ 'basic-attacker', {
            templateId: 'basic-attacker',
            name: 'Basic Attacker',
            maxHp: 60,
            type: 'fire',
            weakness: 'water',
            retreatCost: 1,
            attacks: [{ name: 'Flame Attack', damage: 40, energyRequirements: [{ type: 'fire', amount: 1 }] }],
        }],
        [ 'defensive-creature', {
            templateId: 'defensive-creature',
            name: 'Defensive Creature',
            maxHp: 100,
            type: 'metal',
            weakness: 'fire',
            retreatCost: 2,
            attacks: [{ name: 'Metal Claw', damage: 30, energyRequirements: [{ type: 'metal', amount: 2 }] }],
            ability: {
                name: 'Armor',
                trigger: { type: 'passive' },
                effects: [{
                    type: 'damage-reduction',
                    amount: { type: 'constant', value: 10 },
                    target: { type: 'fixed', player: 'self', position: 'active' },
                    duration: { type: 'while-in-play', instanceId: '' },
                }],
            },
        }],
        [ 'hp-boost-creature', {
            templateId: 'hp-boost-creature',
            name: 'HP Boost Creature',
            maxHp: 80,
            type: 'grass',
            weakness: 'fire',
            retreatCost: 1,
            attacks: [{ name: 'Vine Whip', damage: 20, energyRequirements: [{ type: 'grass', amount: 1 }] }],
            ability: {
                name: 'Vitality',
                trigger: { type: 'passive' },
                effects: [{
                    type: 'hp-bonus',
                    amount: { type: 'constant', value: 20 },
                    duration: { type: 'while-in-play', instanceId: '' },
                }],
            },
        }],
    ]);

    const abilityTestRepository = new CardRepository(
        mockCreatureData,
        new Map<string, SupporterData>(),
        new Map<string, ItemData>(),
        new Map<string, ToolData>()
    );

    describe('Passive ability effects - manually played', () => {
        it('should apply damage reduction ability when creature is played', () => {
            const { state, getExecutedCount } = runTestGame({
                actions: [
                    new PlayCardResponseMessage('defensive-creature', 'creature', 0, 0),
                    new AttackResponseMessage(0),
                ],
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-attacker'),
                    StateBuilder.withCreatures(1, 'basic-attacker'),
                    StateBuilder.withHand(1, [{ templateId: 'defensive-creature', type: 'creature' as const }]),
                    StateBuilder.withEnergy('basic-attacker-0', { fire: 1 }),
                ),
                maxSteps: 15,
                customRepository: abilityTestRepository,
            });

            expect(getExecutedCount()).to.be.greaterThan(0, 'Should have executed actions');
            // Defensive creature should be on field and take reduced damage
            // 40 base damage - 10 damage reduction = 30 damage
            const defensiveCreature = state.field.creatures[1][0];
            expect(defensiveCreature).to.exist;
            expect(defensiveCreature.damageTaken).to.equal(30, 'Should take reduced damage (40 - 10)');
        });

        it('should apply HP bonus ability when creature is played', () => {
            const { state, getExecutedCount } = runTestGame({
                actions: [
                    new PlayCardResponseMessage('hp-boost-creature', 'creature', 0, 0),
                    new AttackResponseMessage(0),
                ],
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-attacker'),
                    StateBuilder.withCreatures(1, 'basic-attacker'),
                    StateBuilder.withHand(1, [{ templateId: 'hp-boost-creature', type: 'creature' as const }]),
                    StateBuilder.withEnergy('basic-attacker-0', { fire: 1 }),
                ),
                maxSteps: 15,
                customRepository: abilityTestRepository,
            });

            expect(getExecutedCount()).to.be.greaterThan(0, 'Should have executed actions');
            // HP boost creature should survive attack due to +20 HP (80 + 20 = 100 HP total)
            const hpBoostCreature = state.field.creatures[1][0];
            expect(hpBoostCreature).to.exist;
            expect(hpBoostCreature.damageTaken).to.equal(40, 'Should take full 40 damage');
            // Creature should still be alive (40 damage < 100 effective HP)
        });
    });

    describe('Passive ability effects - manually setup', () => {
        it('should apply damage reduction ability when creature is pre-setup', () => {
            const { state, getExecutedCount } = runTestGame({
                actions: [ new AttackResponseMessage(0) ],
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-attacker'),
                    StateBuilder.withCreatures(1, 'defensive-creature'), // Pre-setup with ability
                    StateBuilder.withEnergy('basic-attacker-0', { fire: 1 }),
                ),
                maxSteps: 10,
                customRepository: abilityTestRepository,
            });

            expect(getExecutedCount()).to.equal(1, 'Should have executed attack');
            // Defensive creature should take reduced damage
            // 40 base damage - 10 damage reduction = 30 damage
            const defensiveCreature = state.field.creatures[1][0];
            expect(defensiveCreature).to.exist;
            expect(defensiveCreature.damageTaken).to.equal(30, 'Should take reduced damage (40 - 10) with pre-setup ability');
        });

        it('should apply HP bonus ability when creature is pre-setup', () => {
            const { state, getExecutedCount } = runTestGame({
                actions: [
                    new AttackResponseMessage(0),
                    new AttackResponseMessage(0), // Attack twice
                ],
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-attacker'),
                    StateBuilder.withCreatures(1, 'hp-boost-creature'), // Pre-setup with ability
                    StateBuilder.withEnergy('basic-attacker-0', { fire: 1 }),
                ),
                maxSteps: 15,
                customRepository: abilityTestRepository,
            });

            expect(getExecutedCount()).to.be.greaterThan(0, 'Should have executed attacks');
            // HP boost creature should survive both attacks due to +20 HP (80 + 20 = 100 HP total)
            // Two 40 damage attacks = 80 damage < 100 effective HP
            const hpBoostCreature = state.field.creatures[1][0];
            expect(hpBoostCreature).to.exist;
            expect(hpBoostCreature.damageTaken).to.equal(80, 'Should take 80 total damage from two attacks');
            // Creature should still be alive (80 damage < 100 effective HP)
        });

        it('should handle multiple creatures with passive abilities', () => {
            const { state } = runTestGame({
                actions: [],
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'defensive-creature', [ 'hp-boost-creature' ]),
                    StateBuilder.withCreatures(1, 'basic-attacker'),
                ),
                maxSteps: 5,
                customRepository: abilityTestRepository,
            });

            // Both creatures should be on field with their passive effects registered
            expect(state.field.creatures[0]).to.have.lengthOf(2, 'Player 0 should have 2 creatures');
            expect(state.effects.activePassiveEffects.length).to.be.greaterThan(0, 'Should have registered passive effects');
            
            // Find effects by type
            const damageReductionEffects = state.effects.activePassiveEffects.filter(e => e.effect.type === 'damage-reduction');
            const hpBonusEffects = state.effects.activePassiveEffects.filter(e => e.effect.type === 'hp-bonus');
            
            expect(damageReductionEffects).to.have.lengthOf(1, 'Should have 1 damage reduction effect');
            expect(hpBonusEffects).to.have.lengthOf(1, 'Should have 1 HP bonus effect');
        });
    });

    describe('Consistency between manually played and pre-setup', () => {
        it('should produce same damage reduction for played vs pre-setup creature', () => {
            // Test with manually played creature
            const playedResult = runTestGame({
                actions: [
                    new PlayCardResponseMessage('defensive-creature', 'creature', 0, 0),
                    new AttackResponseMessage(0),
                ],
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-attacker'),
                    StateBuilder.withCreatures(1, 'basic-attacker'),
                    StateBuilder.withHand(1, [{ templateId: 'defensive-creature', type: 'creature' as const }]),
                    StateBuilder.withEnergy('basic-attacker-0', { fire: 1 }),
                ),
                maxSteps: 15,
                customRepository: abilityTestRepository,
            });

            // Test with pre-setup creature
            const preSetupResult = runTestGame({
                actions: [ new AttackResponseMessage(0) ],
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-attacker'),
                    StateBuilder.withCreatures(1, 'defensive-creature'),
                    StateBuilder.withEnergy('basic-attacker-0', { fire: 1 }),
                ),
                maxSteps: 10,
                customRepository: abilityTestRepository,
            });

            // Both should result in same damage taken
            const playedDamage = playedResult.state.field.creatures[1][0]?.damageTaken;
            const preSetupDamage = preSetupResult.state.field.creatures[1][0]?.damageTaken;
            
            expect(playedDamage).to.equal(30, 'Played creature should take 30 damage');
            expect(preSetupDamage).to.equal(30, 'Pre-setup creature should take 30 damage');
            expect(playedDamage).to.equal(preSetupDamage, 'Damage should be identical between played and pre-setup');
        });
    });
});
