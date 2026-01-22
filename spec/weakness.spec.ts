import { expect } from 'chai';
import { AttackResponseMessage } from '../src/messages/response/attack-response-message.js';
import { StateBuilder } from './helpers/state-builder.js';
import { runTestGame } from './helpers/test-helpers.js';
import { MockCardRepository } from './mock-repository.js';
import { CreatureData } from '../src/repository/card-types.js';

describe('Weakness System', () => {
    // Custom creatures for weakness testing with specific type/weakness combinations
    const weaknessRepo = new MockCardRepository({
        creatures: new Map<string, CreatureData>([
            ['fire-attacker', { templateId: 'fire-attacker', name: 'Fire Attacker', maxHp: 80, type: 'fire', 
                weakness: 'water', retreatCost: 1, attacks: [{ name: 'Flame Attack', damage: 20, energyRequirements: [{ type: 'fire', amount: 1 }] }] }],
            ['grass-defender', { templateId: 'grass-defender', name: 'Grass Defender', maxHp: 90, type: 'grass', 
                weakness: 'fire', retreatCost: 2, attacks: [{ name: 'Leaf Attack', damage: 15, energyRequirements: [{ type: 'grass', amount: 1 }] }] }],
            ['water-defender', { templateId: 'water-defender', name: 'Water Defender', maxHp: 85, type: 'water', 
                weakness: 'lightning', retreatCost: 1, attacks: [{ name: 'Water Gun', damage: 18, energyRequirements: [{ type: 'water', amount: 1 }] }] }],
            ['zero-damage-attacker', { templateId: 'zero-damage-attacker', name: 'Zero Damage Attacker', maxHp: 60, type: 'psychic', 
                weakness: 'darkness', retreatCost: 1, attacks: [{ name: 'Status Move', damage: 0, energyRequirements: [{ type: 'colorless', amount: 1 }] }] }],
            ['psychic-defender', { templateId: 'psychic-defender', name: 'Psychic Defender', maxHp: 70, type: 'fighting', 
                weakness: 'psychic', retreatCost: 1, attacks: [{ name: 'Punch', damage: 25, energyRequirements: [{ type: 'fighting', amount: 1 }] }] }]
        ])
    });

    it('should deal +20 damage when attacking weakness', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [new AttackResponseMessage(0)],
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'fire-attacker'),
                StateBuilder.withCreatures(1, 'grass-defender'),
                StateBuilder.withEnergy('fire-attacker-0', { fire: 1 })
            ),
            maxSteps: 10,
            customRepository: weaknessRepo
        });
        
        expect(getExecutedCount()).to.equal(1, 'Should have executed attack');
        expect(state.field.creatures[1][0].damageTaken).to.equal(40, 'Should deal +20 weakness damage (20 + 20 = 40)');
    });

    it('should deal normal damage when no weakness', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [new AttackResponseMessage(0)],
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'fire-attacker'),
                StateBuilder.withCreatures(1, 'water-defender'),
                StateBuilder.withEnergy('fire-attacker-0', { fire: 1 })
            ),
            maxSteps: 10,
            customRepository: weaknessRepo
        });
        
        expect(getExecutedCount()).to.equal(1, 'Should have executed attack');
        expect(state.field.creatures[1][0].damageTaken).to.equal(20, 'Should deal normal damage without weakness');
    });

    it('should not add weakness damage to 0-damage attacks', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [new AttackResponseMessage(0)],
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'zero-damage-attacker'),
                StateBuilder.withCreatures(1, 'psychic-defender'),
                StateBuilder.withEnergy('zero-damage-attacker-0', { psychic: 1 })
            ),
            maxSteps: 10,
            customRepository: weaknessRepo
        });
        
        expect(getExecutedCount()).to.equal(1, 'Should have executed Status Move');
        expect(state.field.creatures[1][0].damageTaken).to.equal(0, 'Should deal 0 damage even with weakness (0 + 20 = 0)');
    });
});
