import { expect } from 'chai';
import { runTestGame } from '../helpers/test-helpers.js';
import { StateBuilder } from '../helpers/state-builder.js';
import { EndTurnResponseMessage } from '../../src/messages/response/end-turn-response-message.js';
import { PlayCardResponseMessage } from '../../src/messages/response/play-card-response-message.js';
import { UseAbilityResponseMessage } from '../../src/messages/response/use-ability-response-message.js';
import { AttackResponseMessage } from '../../src/messages/response/attack-response-message.js';
import { MockCardRepository } from '../mock-repository.js';
import { CreatureData } from '../../src/repository/card-types.js';

describe('Trigger System', () => {
    describe('Creature Ability Triggers', () => {
        it('should trigger end-of-turn ability', () => {
            const testRepository = new MockCardRepository({
                creatures: new Map<string, CreatureData>([
                    ['healing-creature', {
                        templateId: 'healing-creature',
                        name: 'Healing Creature',
                        maxHp: 80,
                        type: 'colorless',
                        retreatCost: 1,
                        attacks: [{ name: 'Basic Attack', damage: 20, energyRequirements: [] }],
                        abilities: [{
                            name: 'End Turn Heal',
                            effects: [{ 
                                type: 'hp', 
                                amount: { type: 'constant', value: 20 }, 
                                target: { type: 'fixed', player: 'self', position: 'source' },
                                operation: 'heal'
                            }],
                            trigger: { type: 'end-of-turn' }
                        }]
                    }]
                ])
            });

            const { state } = runTestGame({
                actions: [new EndTurnResponseMessage()],
                customRepository: testRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withcreature(0, 'healing-creature'),
                    StateBuilder.withDamage('healing-creature-0', 50)
                )
            });

            expect(state.field.creatures[0][0].damageTaken).to.equal(30, 'Should heal 20 HP at end of turn');
        });

        it('should trigger when-damaged ability', () => {
            const testRepository = new MockCardRepository({
                creatures: new Map<string, CreatureData>([
                    ['damage-reactive-creature', {
                        templateId: 'damage-reactive-creature',
                        name: 'Damage Reactive Creature',
                        maxHp: 100,
                        type: 'colorless',
                        retreatCost: 1,
                        attacks: [{ name: 'Basic Attack', damage: 20, energyRequirements: [] }],
                        abilities: [{
                            name: 'Damage Response',
                            effects: [{ 
                                type: 'hp', 
                                amount: { type: 'constant', value: 10 }, 
                                target: { type: 'fixed', player: 'self', position: 'source' },
                                operation: 'heal'
                            }],
                            trigger: { type: 'damaged' }
                        }]
                    }],
                    ['basic-attacker', {
                        templateId: 'basic-attacker',
                        name: 'Basic Attacker',
                        maxHp: 80,
                        type: 'colorless',
                        retreatCost: 1,
                        attacks: [{ name: 'Attack', damage: 30, energyRequirements: [] }]
                    }]
                ])
            });

            const { state } = runTestGame({
                actions: [new AttackResponseMessage(0)],
                customRepository: testRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withcreature(0, 'basic-attacker'),
                    StateBuilder.withcreature(1, 'damage-reactive-creature')
                )
            });

            // Should take 30 damage but heal 10 from ability = 20 net damage
            expect(state.field.creatures[1][0].damageTaken).to.equal(20, 'Should heal 10 HP after taking damage');
        });

        it('should trigger manual ability when played', () => {
            const testRepository = new MockCardRepository({
                creatures: new Map<string, CreatureData>([
                    ['manual-heal-creature', {
                        templateId: 'manual-heal-creature',
                        name: 'Manual Heal Creature',
                        maxHp: 80,
                        type: 'colorless',
                        retreatCost: 1,
                        attacks: [{ name: 'Basic Attack', damage: 20, energyRequirements: [] }],
                        abilities: [{
                            name: 'Manual Heal',
                            effects: [{ 
                                type: 'hp', 
                                amount: { type: 'constant', value: 15 }, 
                                target: { type: 'fixed', player: 'self', position: 'source' },
                                operation: 'heal'
                            }],
                            trigger: { type: 'manual', unlimited: true }
                        }]
                    }]
                ])
            });

            const { state } = runTestGame({
                actions: [new UseAbilityResponseMessage(0, 0)], // Use ability on active creature
                customRepository: testRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withcreature(0, 'manual-heal-creature'), // Set up as active creature
                    StateBuilder.withcreature(1, 'basic-creature'), // Set up opponent active
                    StateBuilder.withDamage('manual-heal-creature-0', 40) // Damage to active creature
                )
            });

            expect(state.field.creatures[0][0].damageTaken).to.equal(25, 'Should heal 15 HP when played');
        });
    });

    describe('Trigger Timing', () => {
        it('should handle unlimited manual triggers', () => {
            const testRepository = new MockCardRepository({
                creatures: new Map<string, CreatureData>([
                    ['unlimited-creature', {
                        templateId: 'unlimited-creature',
                        name: 'Unlimited Creature',
                        maxHp: 100,
                        type: 'colorless',
                        retreatCost: 1,
                        attacks: [{ name: 'Basic Attack', damage: 20, energyRequirements: [] }],
                        abilities: [{
                            name: 'Unlimited Heal',
                            effects: [{ 
                                type: 'hp', 
                                amount: { type: 'constant', value: 10 }, 
                                target: { type: 'fixed', player: 'self', position: 'source' },
                                operation: 'heal'
                            }],
                            trigger: { type: 'manual', unlimited: true }
                        }]
                    }]
                ])
            });

            const { state } = runTestGame({
                actions: [
                    new UseAbilityResponseMessage(0, 0), // Use ability first time
                    new UseAbilityResponseMessage(0, 0)  // Use ability second time
                ],
                customRepository: testRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withcreature(0, 'unlimited-creature'), // Set up as active
                    StateBuilder.withcreature(1, 'basic-creature'), // Set up opponent active
                    StateBuilder.withDamage('unlimited-creature-0', 50)
                )
            });

            expect(state.field.creatures[0][0].damageTaken).to.equal(30, 'Should heal 20 HP total from two unlimited triggers');
        });
    });
});
