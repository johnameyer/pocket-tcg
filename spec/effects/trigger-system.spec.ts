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
    describe('Tool Triggers', () => {
        it('should trigger healing tool only on owner turn', () => {
            const testRepository = new MockCardRepository({
                creatures: new Map<string, CreatureData>([
                    ['basic-creature', {
                        templateId: 'basic-creature',
                        name: 'Basic Creature',
                        maxHp: 80,
                        type: 'colorless',
                        retreatCost: 1,
                        attacks: [{ name: 'Basic Attack', damage: 20, energyRequirements: [] }]
                    }]
                ]),
                tools: new Map([
                    ['healing-tool', {
                        templateId: 'healing-tool',
                        name: 'Healing Tool',
                        effects: [{ 
                            type: 'hp', 
                            amount: { type: 'constant', value: 10 }, 
                            target: { type: 'fixed', player: 'self', position: 'source' }, 
                            operation: 'heal' 
                        }],
                        trigger: { type: 'end-of-turn', ownTurnOnly: true }
                    }]
                ])
            });

            const { state } = runTestGame({
                actions: [new EndTurnResponseMessage()],
                customRepository: testRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature'),
                    StateBuilder.withTool('basic-creature-0', 'healing-tool'),
                    StateBuilder.withDamage('basic-creature-0', 30)
                )
            });

            expect(state.field.creatures[0][0].damageTaken).to.equal(20, 'Should heal 10 HP on owner turn');
        });

        it('should not trigger healing tool on opponent turn', () => {
            const testRepository = new MockCardRepository({
                creatures: new Map<string, CreatureData>([
                    ['basic-creature', {
                        templateId: 'basic-creature',
                        name: 'Basic Creature',
                        maxHp: 80,
                        type: 'colorless',
                        retreatCost: 1,
                        attacks: [{ name: 'Basic Attack', damage: 20, energyRequirements: [] }]
                    }]
                ]),
                tools: new Map([
                    ['healing-tool', {
                        templateId: 'healing-tool',
                        name: 'Healing Tool',
                        effects: [{ 
                            type: 'hp', 
                            amount: { type: 'constant', value: 10 }, 
                            target: { type: 'fixed', player: 'self', position: 'source' }, 
                            operation: 'heal' 
                        }],
                        trigger: { type: 'end-of-turn', ownTurnOnly: true }
                    }]
                ])
            });

            const { state } = runTestGame({
                actions: [new EndTurnResponseMessage()],
                customRepository: testRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature'),
                    StateBuilder.withTool('basic-creature-0', 'healing-tool'),
                    StateBuilder.withDamage('basic-creature-0', 30),
                    StateBuilder.withTurn(1)
                )
            });

            expect(state.field.creatures[0][0].damageTaken).to.equal(30, 'Should not heal on opponent turn');
        });
    });

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
                        ability: {
                            name: 'End Turn Heal',
                            effects: [{ 
                                type: 'hp', 
                                amount: { type: 'constant', value: 20 }, 
                                target: { type: 'fixed', player: 'self', position: 'source' },
                                operation: 'heal'
                            }],
                            trigger: { type: 'end-of-turn' }
                        }
                    }]
                ])
            });

            const { state } = runTestGame({
                actions: [new EndTurnResponseMessage()],
                customRepository: testRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'healing-creature'),
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
                        ability: {
                            name: 'Damage Response',
                            effects: [{ 
                                type: 'hp', 
                                amount: { type: 'constant', value: 10 }, 
                                target: { type: 'fixed', player: 'self', position: 'source' },
                                operation: 'heal'
                            }],
                            trigger: { type: 'damaged' }
                        }
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
                    StateBuilder.withCreatures(0, 'basic-attacker'),
                    StateBuilder.withCreatures(1, 'damage-reactive-creature')
                )
            });

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
                        ability: {
                            name: 'Manual Heal',
                            effects: [{ 
                                type: 'hp', 
                                amount: { type: 'constant', value: 15 }, 
                                target: { type: 'fixed', player: 'self', position: 'source' },
                                operation: 'heal'
                            }],
                            trigger: { type: 'manual', unlimited: true }
                        }
                    }]
                ])
            });

            const { state } = runTestGame({
                actions: [new UseAbilityResponseMessage(0)],
                customRepository: testRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'manual-heal-creature'),
                    StateBuilder.withCreatures(1, 'basic-creature'),
                    StateBuilder.withDamage('manual-heal-creature-0', 40)
                )
            });

            expect(state.field.creatures[0][0].damageTaken).to.equal(25, 'Should heal 15 HP when played');
        });
    });

    describe('Trigger Timing', () => {
        it('should process multiple end-of-turn triggers', () => {
            const testRepository = new MockCardRepository({
                creatures: new Map<string, CreatureData>([
                    ['healing-creature', {
                        templateId: 'healing-creature',
                        name: 'Healing Creature',
                        maxHp: 100,
                        type: 'colorless',
                        retreatCost: 1,
                        attacks: [{ name: 'Basic Attack', damage: 20, energyRequirements: [] }],
                        ability: {
                            name: 'End Turn Heal',
                            effects: [{ 
                                type: 'hp', 
                                amount: { type: 'constant', value: 10 }, 
                                target: { type: 'fixed', player: 'self', position: 'source' },
                                operation: 'heal'
                            }],
                            trigger: { type: 'end-of-turn' }
                        }
                    }]
                ]),
                tools: new Map([
                    ['healing-tool', {
                        templateId: 'healing-tool',
                        name: 'Healing Tool',
                        effects: [{ 
                            type: 'hp', 
                            amount: { type: 'constant', value: 5 }, 
                            target: { type: 'fixed', player: 'self', position: 'source' }, 
                            operation: 'heal' 
                        }],
                        trigger: { type: 'end-of-turn', ownTurnOnly: true }
                    }]
                ])
            });

            const { state } = runTestGame({
                actions: [new EndTurnResponseMessage()],
                customRepository: testRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'healing-creature'),
                    StateBuilder.withTool('healing-creature-0', 'healing-tool'),
                    StateBuilder.withDamage('healing-creature-0', 50)
                )
            });

            expect(state.field.creatures[0][0].damageTaken).to.equal(35, 'Should heal 15 HP total (10 from ability + 5 from tool)');
        });

        it('should respect ownTurnOnly restriction', () => {
            const testRepository = new MockCardRepository({
                creatures: new Map<string, CreatureData>([
                    ['basic-creature', {
                        templateId: 'basic-creature',
                        name: 'Basic Creature',
                        maxHp: 80,
                        type: 'colorless',
                        retreatCost: 1,
                        attacks: [{ name: 'Basic Attack', damage: 20, energyRequirements: [] }]
                    }]
                ]),
                tools: new Map([
                    ['owner-only-tool', {
                        templateId: 'owner-only-tool',
                        name: 'Owner Only Tool',
                        effects: [{ 
                            type: 'hp', 
                            amount: { type: 'constant', value: 10 }, 
                            target: { type: 'fixed', player: 'self', position: 'source' }, 
                            operation: 'heal' 
                        }],
                        trigger: { type: 'end-of-turn', ownTurnOnly: true }
                    }],
                    ['any-turn-tool', {
                        templateId: 'any-turn-tool',
                        name: 'Any Turn Tool',
                        effects: [{ 
                            type: 'hp', 
                            amount: { type: 'constant', value: 5 }, 
                            target: { type: 'fixed', player: 'self', position: 'source' }, 
                            operation: 'heal' 
                        }],
                        trigger: { type: 'end-of-turn', ownTurnOnly: false }
                    }]
                ])
            });

            const { state } = runTestGame({
                actions: [new EndTurnResponseMessage()],
                customRepository: testRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature', ['basic-creature']),
                    StateBuilder.withTool('basic-creature-0', 'owner-only-tool'),
                    StateBuilder.withTool('basic-creature-0-0', 'any-turn-tool'),
                    StateBuilder.withDamage('basic-creature-0', 30)
                )
            });

            expect(state.field.creatures[0][0].damageTaken).to.equal(20, 'Should heal 10 HP from owner-only tool on active creature');
        });

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
                        ability: {
                            name: 'Unlimited Heal',
                            effects: [{ 
                                type: 'hp', 
                                amount: { type: 'constant', value: 10 }, 
                                target: { type: 'fixed', player: 'self', position: 'source' },
                                operation: 'heal'
                            }],
                            trigger: { type: 'manual', unlimited: true }
                        }
                    }]
                ])
            });

            const { state } = runTestGame({
                actions: [
                    new UseAbilityResponseMessage(0),
                    new UseAbilityResponseMessage(0)
                ],
                customRepository: testRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'unlimited-creature'),
                    StateBuilder.withCreatures(1, 'basic-creature'),
                    StateBuilder.withDamage('unlimited-creature-0', 50)
                )
            });

            expect(state.field.creatures[0][0].damageTaken).to.equal(30, 'Should heal 20 HP total from two unlimited triggers');
        });
    });
});
