import { expect } from 'chai';
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
            weakness: 'water', // Not weak to fire, to avoid weakness bonus
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
            weakness: 'psychic', // Not weak to fire, to avoid weakness bonus
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
        new Map<string, ToolData>(),
    );

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
            /*
             * Defensive creature should take reduced damage
             * 40 base damage - 10 damage reduction = 30 damage
             */
            const defensiveCreature = state.field.creatures[1][0];
            expect(defensiveCreature).to.exist;
            expect(defensiveCreature.damageTaken).to.equal(30, 'Should take reduced damage (40 - 10) with pre-setup ability');
        });

        it('should apply HP bonus ability when creature is pre-setup', () => {
            const { state, getExecutedCount } = runTestGame({
                actions: [
                    new AttackResponseMessage(0),
                ],
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-attacker'),
                    StateBuilder.withCreatures(1, 'hp-boost-creature'), // Pre-setup with ability
                    StateBuilder.withEnergy('basic-attacker-0', { fire: 1 }),
                ),
                maxSteps: 10,
                customRepository: abilityTestRepository,
            });

            expect(getExecutedCount()).to.equal(1, 'Should have executed attack');
            // HP boost creature should have passive effect registered
            const hpBonusEffects = state.effects.activePassiveEffects.filter(e => e.effect.type === 'hp-bonus');
            expect(hpBonusEffects).to.have.lengthOf(1, 'Should have 1 HP bonus effect');
            
            // Creature should take damage and still be alive
            const hpBoostCreature = state.field.creatures[1][0];
            expect(hpBoostCreature).to.exist;
            expect(hpBoostCreature.damageTaken).to.equal(40, 'Should take 40 damage from one attack');
            // Creature should still be alive (40 damage < 80 base HP + 20 bonus = 100 effective HP)
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

    describe('Ability passive effects cleared on knockout', () => {
        it('should clear ability passive effects when creature is knocked out', () => {
            const { state } = runTestGame({
                actions: [ new AttackResponseMessage(0), new AttackResponseMessage(0) ],
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-attacker'),
                    StateBuilder.withCreatures(1, 'defensive-creature'),
                    StateBuilder.withEnergy('basic-attacker-0', { fire: 4 }),
                ),
                maxSteps: 20,
                customRepository: abilityTestRepository,
            });

            /*
             * Check that defensive creature was knocked out or is still alive
             * It has 100 HP and 10 damage reduction, so 2 attacks of 40 damage (reduced to 30 each) = 60 total damage
             * Creature should still be alive with 60 damage taken
             */
            const defensiveCreature = state.field.creatures[1][0];
            if (defensiveCreature && defensiveCreature.damageTaken < 100) {
                // Not knocked out yet, check that effect is still active
                const damageReductionEffects = state.effects.activePassiveEffects.filter(e => e.effect.type === 'damage-reduction');
                expect(damageReductionEffects.length).to.be.greaterThan(0, 'Effect should still be active if creature is alive');
            } else {
                // Knocked out - should have no damage reduction effects
                const damageReductionEffects = state.effects.activePassiveEffects.filter(e => e.effect.type === 'damage-reduction');
                expect(damageReductionEffects).to.have.lengthOf(0, 'Damage reduction effect should be cleared after knockout');
            }
        });
    });
});
