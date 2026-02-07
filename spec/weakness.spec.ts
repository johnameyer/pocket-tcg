import { expect } from 'chai';
import { AttackResponseMessage } from '../src/messages/response/attack-response-message.js';
import { CreatureData } from '../src/repository/card-types.js';
import { StateBuilder } from './helpers/state-builder.js';
import { runTestGame } from './helpers/test-helpers.js';
import { MockCardRepository } from './mock-repository.js';

describe('Weakness System', () => {
    // Create test-specific creatures for weakness testing
    const weaknessTestRepository = new MockCardRepository({
        creatures: new Map<string, CreatureData>([
            [ 'fire-attacker', {
                templateId: 'fire-attacker',
                name: 'Fire Attacker',
                maxHp: 80,
                type: 'fire',
                weakness: 'water',
                retreatCost: 1,
                attacks: [{ name: 'Flame Attack', damage: 20, energyRequirements: [{ type: 'fire', amount: 1 }] }],
            }],
            [ 'grass-defender', {
                templateId: 'grass-defender',
                name: 'Grass Defender',
                maxHp: 90,
                type: 'grass',
                weakness: 'fire', // Weak to fire - should take +20 damage
                retreatCost: 2,
                attacks: [{ name: 'Leaf Attack', damage: 15, energyRequirements: [{ type: 'grass', amount: 1 }] }],
            }],
            [ 'water-defender', {
                templateId: 'water-defender',
                name: 'Water Defender',
                maxHp: 85,
                type: 'water',
                weakness: 'lightning', // Not weak to fire - should take normal damage
                retreatCost: 1,
                attacks: [{ name: 'Water Gun', damage: 18, energyRequirements: [{ type: 'water', amount: 1 }] }],
            }],
            [ 'zero-damage-attacker', {
                templateId: 'zero-damage-attacker',
                name: 'Zero Damage Attacker',
                maxHp: 60,
                type: 'psychic',
                weakness: 'darkness',
                retreatCost: 1,
                attacks: [{ name: 'Status Move', damage: 0, energyRequirements: [{ type: 'colorless', amount: 1 }] }],
            }],
            [ 'psychic-defender', {
                templateId: 'psychic-defender',
                name: 'Psychic Defender',
                maxHp: 70,
                type: 'fighting',
                weakness: 'psychic', // Weak to psychic - but 0 damage + 20 should still be 0
                retreatCost: 1,
                attacks: [{ name: 'Punch', damage: 25, energyRequirements: [{ type: 'fighting', amount: 1 }] }],
            }],
        ]),
    });

    it('should deal +20 damage when attacking weakness', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [ new AttackResponseMessage(0) ],
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'fire-attacker'), // Fire type
                StateBuilder.withCreatures(1, 'grass-defender'), // Grass type (weak to fire)
                StateBuilder.withEnergy('fire-attacker-0', { fire: 1 }),
            ),
            customRepository: weaknessTestRepository,
        });
        
        expect(getExecutedCount()).to.equal(1, 'Should have executed attack');
        // Fire attacking grass (weak to fire) should deal base damage (20) + weakness bonus (+20) = 40
        expect(state.field.creatures[1][0].damageTaken).to.equal(40, 'Should deal +20 weakness damage (20 + 20 = 40)');
    });

    it('should deal normal damage when no weakness', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [ new AttackResponseMessage(0) ],
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'fire-attacker'), // Fire type
                StateBuilder.withCreatures(1, 'water-defender'), // Water type (weak to lightning, not fire)
                StateBuilder.withEnergy('fire-attacker-0', { fire: 1 }),
            ),
            customRepository: weaknessTestRepository,
        });
        
        expect(getExecutedCount()).to.equal(1, 'Should have executed attack');
        expect(state.field.creatures[1][0].damageTaken).to.equal(20, 'Should deal normal damage without weakness');
    });

    it('should not add weakness damage to 0-damage attacks', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [ new AttackResponseMessage(0) ],
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'zero-damage-attacker'), // Psychic type with 0-damage attack
                StateBuilder.withCreatures(1, 'psychic-defender'), // Fighting type (weak to psychic)
                StateBuilder.withEnergy('zero-damage-attacker-0', { psychic: 1 }), // Use psychic energy instead of colorless
            ),
            customRepository: weaknessTestRepository,
        });
        
        expect(getExecutedCount()).to.equal(1, 'Should have executed Status Move');
        expect(state.field.creatures[1][0].damageTaken).to.equal(0, 'Should deal 0 damage even with weakness (0 + 20 = 0)');
    });
});
