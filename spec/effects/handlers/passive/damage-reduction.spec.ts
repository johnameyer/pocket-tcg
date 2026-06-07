import { expect } from 'chai';
import { AttackResponseMessage } from '../../../../src/messages/response/attack-response-message.js';
import { StateBuilder } from '../../../helpers/state-builder.js';
import { runTestGame } from '../../../helpers/test-helpers.js';
import { MockCardRepository } from '../../../mock-repository.js';

describe('Damage Reduction Effect', () => {
    const testRepository = new MockCardRepository({
        creatures: {
            'defensive-creature': {
                templateId: 'defensive-creature',
                name: 'Defensive Creature',
                maxHp: 100,
                type: 'metal',
                weakness: 'water', // Changed from 'fire' to avoid weakness with fire attacker
                retreatCost: 2,
                attacks: [{ name: 'Steel Strike', damage: 30, energyRequirements: [{ type: 'metal', amount: 2 }] }],
                ability: {
                    name: 'Steel Armor',
                    trigger: { type: 'passive' },
                    effects: [{
                        type: 'passive',
                        modifier: {
                            type: 'damage-reduction',
                            amount: { type: 'constant', value: 20 },
                            damageSource: { player: 'opponent' },
                            target: { player: 'self', position: 'active' },
                            duration: { type: 'while-in-play' },
                        },
                    }],
                },
            },
            'high-hp-defensive-creature': {
                templateId: 'high-hp-defensive-creature',
                name: 'High HP Defensive Creature',
                maxHp: 180,
                type: 'metal',
                weakness: 'water',
                retreatCost: 3,
                attacks: [{ name: 'Heavy Strike', damage: 40, energyRequirements: [{ type: 'metal', amount: 3 }] }],
                ability: {
                    name: 'Reinforced Armor',
                    trigger: { type: 'passive' },
                    effects: [{
                        type: 'passive',
                        modifier: {
                            type: 'damage-reduction',
                            amount: { type: 'constant', value: 20 },
                            damageSource: { player: 'opponent' },
                            target: { player: 'self', position: 'active' },
                            duration: { type: 'while-in-play' },
                        },
                    }],
                },
            },
            'variable-defense-creature': {
                templateId: 'variable-defense-creature',
                name: 'Variable Defense Creature',
                maxHp: 90,
                type: 'fighting',
                weakness: 'psychic',
                retreatCost: 1,
                attacks: [{ name: 'Counter', damage: 20, energyRequirements: [{ type: 'fighting', amount: 1 }] }],
                ability: {
                    name: 'Adaptive Defense',
                    trigger: { type: 'passive' },
                    effects: [{
                        type: 'passive',
                        modifier: {
                            type: 'damage-reduction',
                            amount: { type: 'player-context-resolved', source: 'current-points', playerContext: 'self' },
                            damageSource: { player: 'opponent' },
                            target: { player: 'self', position: 'active' },
                            duration: { type: 'while-in-play' },
                        },
                    }],
                },
            },
            'high-hp-creature': {
                templateId: 'high-hp-creature',
                name: 'High HP Creature',
                maxHp: 140,
                type: 'fighting',
                weakness: 'psychic',
                retreatCost: 3,
                attacks: [
                    {
                        name: 'Body Slam',
                        damage: 60,
                        energyRequirements: [{ type: 'fighting', amount: 2 }],
                    },
                    {
                        name: 'Mega Punch',
                        damage: 150,
                        energyRequirements: [{ type: 'fighting', amount: 4 }],
                    },
                ],
            },
            'criteria-defensive-creature': {
                templateId: 'criteria-defensive-creature',
                name: 'Criteria Defensive Creature',
                maxHp: 100,
                type: 'metal',
                weakness: 'water',
                retreatCost: 3,
                attacks: [{ name: 'Steel Strike', damage: 30, energyRequirements: [{ type: 'metal', amount: 2 }] }],
                ability: {
                    name: 'Weight Armor',
                    trigger: { type: 'passive' },
                    effects: [{
                        type: 'passive',
                        modifier: {
                            type: 'damage-reduction',
                            amount: { type: 'constant', value: 20 },
                            damageSource: { player: 'opponent' },
                            target: {
                                player: 'self',
                                position: 'active',
                                fieldCriteria: { cardCriteria: { retreatCost: { min: 3 }}},
                            },
                            duration: { type: 'while-in-play' },
                        },
                    }],
                },
            },
            'criteria-defensive-creature-low': {
                templateId: 'criteria-defensive-creature-low',
                name: 'Criteria Defensive Creature Low',
                maxHp: 100,
                type: 'metal',
                weakness: 'water',
                retreatCost: 2,
                attacks: [{ name: 'Steel Strike', damage: 30, energyRequirements: [{ type: 'metal', amount: 2 }] }],
                ability: {
                    name: 'Weight Armor',
                    trigger: { type: 'passive' },
                    effects: [{
                        type: 'passive',
                        modifier: {
                            type: 'damage-reduction',
                            amount: { type: 'constant', value: 20 },
                            damageSource: { player: 'opponent' },
                            target: {
                                player: 'self',
                                position: 'active',
                                fieldCriteria: { cardCriteria: { retreatCost: { min: 3 }}},
                            },
                            duration: { type: 'while-in-play' },
                        },
                    }],
                },
            },
            'source-filter-defender': {
                templateId: 'source-filter-defender',
                name: 'Source Filter Defender',
                maxHp: 100,
                type: 'metal',
                weakness: 'water',
                retreatCost: 2,
                attacks: [{ name: 'Guard Hit', damage: 20, energyRequirements: [{ type: 'metal', amount: 1 }] }],
                ability: {
                    name: 'Ex Shield',
                    trigger: { type: 'passive' },
                    effects: [{
                        type: 'passive',
                        modifier: {
                            type: 'damage-reduction',
                            amount: { type: 'constant', value: 20 },
                            damageSource: {
                                player: 'opponent',
                                fieldCriteria: { cardCriteria: { attributes: { ex: true }}},
                            },
                            target: { player: 'self', position: 'active' },
                            duration: { type: 'while-in-play' },
                        },
                    }],
                },
            },
            'ex-attacker': {
                templateId: 'ex-attacker',
                name: 'EX Attacker',
                maxHp: 130,
                type: 'fighting',
                weakness: 'psychic',
                retreatCost: 2,
                attributes: { ex: true },
                attacks: [{ name: 'Ex Punch', damage: 60, energyRequirements: [{ type: 'fighting', amount: 2 }] }],
            },
        },
    });

    it('should reduce damage by 20 during opponent turn (basic operation)', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [ new AttackResponseMessage(0) ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                // TODO remove from pocket-tcg entirely
                StateBuilder.withCreatures(0, 'high-hp-creature'), // Strong attacker
                StateBuilder.withCreatures(1, 'defensive-creature'), // Has damage reduction
                StateBuilder.withEnergy('high-hp-creature-0', { fighting: 2 }),
            ),
        });

        expect(getExecutedCount()).to.equal(1, 'Should have executed attack');
        expect(state.field.creatures[1][0].damageTaken).to.equal(40, 'Should deal 40 damage (60 base - 20 reduction)');
    });

    it('should reduce different amounts (variable based on points)', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [ new AttackResponseMessage(0) ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature'),
                StateBuilder.withCreatures(1, 'variable-defense-creature'),
                StateBuilder.withEnergy('basic-creature-0', { fire: 1 }),
                (state) => {
                    state.points = [ 0, 2 ]; // Player 1 has 2 points for reduction
                },
            ),
        });

        expect(getExecutedCount()).to.equal(1, 'Should have executed attack');
        expect(state.field.creatures[1][0].damageTaken).to.equal(18, 'Should deal 18 damage (20 base - 2 points reduction)');
    });

    it('should cap reduction at damage dealt (no negative damage)', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [ new AttackResponseMessage(0) ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                // TODO remove from pocket-tcg entirely
                StateBuilder.withCreatures(0, 'basic-creature'), // 20 damage attack
                StateBuilder.withCreatures(1, 'defensive-creature'), // 20 damage reduction
                StateBuilder.withEnergy('basic-creature-0', { fire: 1 }),
            ),
        });

        expect(getExecutedCount()).to.equal(1, 'Should have executed attack');
        expect(state.field.creatures[1][0].damageTaken).to.equal(0, 'Should deal 0 damage (reduction equals attack)');
    });

    it('should not reduce damage when no reduction effect is present', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [ new AttackResponseMessage(0) ],
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature'),
                StateBuilder.withCreatures(1, 'high-hp-creature'), // No damage reduction
                StateBuilder.withEnergy('basic-creature-0', { fire: 1 }),
            ),
        });

        expect(getExecutedCount()).to.equal(1, 'Should have executed attack');
        expect(state.field.creatures[1][0].damageTaken).to.equal(20, 'Should deal full damage (no reduction)');
    });

    it('should work with high damage attacks', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [ new AttackResponseMessage(1) ], // Use stronger attack
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'high-hp-creature'),
                StateBuilder.withCreatures(1, 'high-hp-defensive-creature'),
                StateBuilder.withEnergy('high-hp-creature-0', { fighting: 4 }),
            ),
        });

        expect(getExecutedCount()).to.equal(1, 'Should have executed attack');
        expect(state.field.creatures[1][0].damageTaken).to.equal(130, 'Should deal 130 damage (150 base - 20 reduction)');
    });

    it('should apply reduction only when target card criteria match', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [ new AttackResponseMessage(0) ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'high-hp-creature'),
                StateBuilder.withCreatures(1, 'criteria-defensive-creature'),
                StateBuilder.withEnergy('high-hp-creature-0', { fighting: 2 }),
            ),
        });

        expect(getExecutedCount()).to.equal(1, 'Should have executed attack');
        expect(state.field.creatures[1][0].damageTaken).to.equal(40, 'Should apply reduction when defender matches retreatCost criteria');
    });

    it('should not apply reduction when target card criteria do not match', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [ new AttackResponseMessage(0) ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'high-hp-creature'),
                StateBuilder.withCreatures(1, 'criteria-defensive-creature-low'),
                StateBuilder.withEnergy('high-hp-creature-0', { fighting: 2 }),
            ),
        });

        expect(getExecutedCount()).to.equal(1, 'Should have executed attack');
        expect(state.field.creatures[1][0].damageTaken).to.equal(60, 'Should not reduce when defender fails retreatCost criteria');
    });

    it('should apply reduction only when damage source criteria match', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [ new AttackResponseMessage(0) ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'ex-attacker'),
                StateBuilder.withCreatures(1, 'source-filter-defender'),
                StateBuilder.withEnergy('ex-attacker-0', { fighting: 2 }),
            ),
        });

        expect(getExecutedCount()).to.equal(1, 'Should have executed attack');
        expect(state.field.creatures[1][0].damageTaken).to.equal(40, 'Should reduce damage from EX attackers');
    });

    it('should not apply reduction when damage source criteria do not match', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [ new AttackResponseMessage(0) ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'high-hp-creature'),
                StateBuilder.withCreatures(1, 'source-filter-defender'),
                StateBuilder.withEnergy('high-hp-creature-0', { fighting: 2 }),
            ),
        });

        expect(getExecutedCount()).to.equal(1, 'Should have executed attack');
        expect(state.field.creatures[1][0].damageTaken).to.equal(60, 'Should not reduce damage from non-EX attackers');
    });
});
