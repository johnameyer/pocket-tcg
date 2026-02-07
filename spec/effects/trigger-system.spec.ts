import { expect } from 'chai';
import { runTestGame } from '../helpers/test-helpers.js';
import { StateBuilder } from '../helpers/state-builder.js';
import { EndTurnResponseMessage } from '../../src/messages/response/end-turn-response-message.js';
import { UseAbilityResponseMessage } from '../../src/messages/response/use-ability-response-message.js';
import { AttackResponseMessage } from '../../src/messages/response/attack-response-message.js';
import { PlayCardResponseMessage } from '../../src/messages/response/play-card-response-message.js';
import { EvolveResponseMessage } from '../../src/messages/response/evolve-response-message.js';
import { RetreatResponseMessage } from '../../src/messages/response/retreat-response-message.js';
import { MockCardRepository } from '../mock-repository.js';
import { CreatureData } from '../../src/repository/card-types.js';

describe('Trigger System', () => {
    describe('Tool Triggers', () => {
        it('should trigger healing tool only on owner turn', () => {
            const testRepository = new MockCardRepository({
                creatures: new Map<string, CreatureData>([
                    [ 'basic-creature', {
                        templateId: 'basic-creature',
                        name: 'Basic Creature',
                        maxHp: 80,
                        type: 'colorless',
                        retreatCost: 1,
                        attacks: [{ name: 'Basic Attack', damage: 20, energyRequirements: [] }],
                    }],
                ]),
                tools: new Map([
                    [ 'healing-tool', {
                        templateId: 'healing-tool',
                        name: 'Healing Tool',
                        effects: [{ 
                            type: 'hp', 
                            amount: { type: 'constant', value: 10 }, 
                            target: { type: 'fixed', player: 'self', position: 'source' }, 
                            operation: 'heal', 
                        }],
                        trigger: { type: 'end-of-turn', ownTurnOnly: true },
                    }],
                ]),
            });

            const { state } = runTestGame({
                actions: [ new EndTurnResponseMessage() ],
                customRepository: testRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature'),
                    StateBuilder.withTool('basic-creature-0', 'healing-tool'),
                    StateBuilder.withDamage('basic-creature-0', 30),
                ),
            });

            expect(state.field.creatures[0][0].damageTaken).to.equal(20, 'Should heal 10 HP on owner turn');
        });

        it('should not trigger healing tool on opponent turn', () => {
            const testRepository = new MockCardRepository({
                creatures: new Map<string, CreatureData>([
                    [ 'basic-creature', {
                        templateId: 'basic-creature',
                        name: 'Basic Creature',
                        maxHp: 80,
                        type: 'colorless',
                        retreatCost: 1,
                        attacks: [{ name: 'Basic Attack', damage: 20, energyRequirements: [] }],
                    }],
                ]),
                tools: new Map([
                    [ 'healing-tool', {
                        templateId: 'healing-tool',
                        name: 'Healing Tool',
                        effects: [{ 
                            type: 'hp', 
                            amount: { type: 'constant', value: 10 }, 
                            target: { type: 'fixed', player: 'self', position: 'source' }, 
                            operation: 'heal', 
                        }],
                        trigger: { type: 'end-of-turn', ownTurnOnly: true },
                    }],
                ]),
            });

            const { state } = runTestGame({
                actions: [ new EndTurnResponseMessage() ],
                customRepository: testRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature'),
                    StateBuilder.withTool('basic-creature-0', 'healing-tool'),
                    StateBuilder.withDamage('basic-creature-0', 30),
                    StateBuilder.withTurn(1),
                ),
            });

            expect(state.field.creatures[0][0].damageTaken).to.equal(30, 'Should not heal on opponent turn');
        });
    });

    describe('Creature Ability Triggers', () => {
        it('should trigger end-of-turn ability', () => {
            const testRepository = new MockCardRepository({
                creatures: new Map<string, CreatureData>([
                    [ 'healing-creature', {
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
                                operation: 'heal',
                            }],
                            trigger: { type: 'end-of-turn' },
                        },
                    }],
                ]),
            });

            const { state } = runTestGame({
                actions: [ new EndTurnResponseMessage() ],
                customRepository: testRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'healing-creature'),
                    StateBuilder.withDamage('healing-creature-0', 50),
                ),
            });

            expect(state.field.creatures[0][0].damageTaken).to.equal(30, 'Should heal 20 HP at end of turn');
        });

        it('should trigger when-damaged ability', () => {
            const testRepository = new MockCardRepository({
                creatures: new Map<string, CreatureData>([
                    [ 'damage-reactive-creature', {
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
                                operation: 'heal',
                            }],
                            trigger: { type: 'damaged' },
                        },
                    }],
                    [ 'basic-attacker', {
                        templateId: 'basic-attacker',
                        name: 'Basic Attacker',
                        maxHp: 80,
                        type: 'colorless',
                        retreatCost: 1,
                        attacks: [{ name: 'Attack', damage: 30, energyRequirements: [] }],
                    }],
                ]),
            });

            const { state } = runTestGame({
                actions: [ new AttackResponseMessage(0) ],
                customRepository: testRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-attacker'),
                    StateBuilder.withCreatures(1, 'damage-reactive-creature'),
                ),
            });

            expect(state.field.creatures[1][0].damageTaken).to.equal(20, 'Should heal 10 HP after taking damage');
        });

        it('should trigger manual ability when played', () => {
            const testRepository = new MockCardRepository({
                creatures: new Map<string, CreatureData>([
                    [ 'manual-heal-creature', {
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
                                operation: 'heal',
                            }],
                            trigger: { type: 'manual', unlimited: true },
                        },
                    }],
                ]),
            });

            const { state } = runTestGame({
                actions: [ new UseAbilityResponseMessage(0) ],
                customRepository: testRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'manual-heal-creature'),
                    StateBuilder.withCreatures(1, 'basic-creature'),
                    StateBuilder.withDamage('manual-heal-creature-0', 40),
                ),
            });

            expect(state.field.creatures[0][0].damageTaken).to.equal(25, 'Should heal 15 HP when played');
        });
    });

    describe('Trigger Timing', () => {
        it('should process multiple end-of-turn triggers', () => {
            const testRepository = new MockCardRepository({
                creatures: new Map<string, CreatureData>([
                    [ 'healing-creature', {
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
                                operation: 'heal',
                            }],
                            trigger: { type: 'end-of-turn' },
                        },
                    }],
                ]),
                tools: new Map([
                    [ 'healing-tool', {
                        templateId: 'healing-tool',
                        name: 'Healing Tool',
                        effects: [{ 
                            type: 'hp', 
                            amount: { type: 'constant', value: 5 }, 
                            target: { type: 'fixed', player: 'self', position: 'source' }, 
                            operation: 'heal', 
                        }],
                        trigger: { type: 'end-of-turn', ownTurnOnly: true },
                    }],
                ]),
            });

            const { state } = runTestGame({
                actions: [ new EndTurnResponseMessage() ],
                customRepository: testRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'healing-creature'),
                    StateBuilder.withTool('healing-creature-0', 'healing-tool'),
                    StateBuilder.withDamage('healing-creature-0', 50),
                ),
            });

            expect(state.field.creatures[0][0].damageTaken).to.equal(35, 'Should heal 15 HP total (10 from ability + 5 from tool)');
        });

        it('should respect ownTurnOnly restriction', () => {
            const testRepository = new MockCardRepository({
                creatures: new Map<string, CreatureData>([
                    [ 'basic-creature', {
                        templateId: 'basic-creature',
                        name: 'Basic Creature',
                        maxHp: 80,
                        type: 'colorless',
                        retreatCost: 1,
                        attacks: [{ name: 'Basic Attack', damage: 20, energyRequirements: [] }],
                    }],
                ]),
                tools: new Map([
                    [ 'owner-only-tool', {
                        templateId: 'owner-only-tool',
                        name: 'Owner Only Tool',
                        effects: [{ 
                            type: 'hp', 
                            amount: { type: 'constant', value: 10 }, 
                            target: { type: 'fixed', player: 'self', position: 'source' }, 
                            operation: 'heal', 
                        }],
                        trigger: { type: 'end-of-turn', ownTurnOnly: true },
                    }],
                    [ 'any-turn-tool', {
                        templateId: 'any-turn-tool',
                        name: 'Any Turn Tool',
                        effects: [{ 
                            type: 'hp', 
                            amount: { type: 'constant', value: 5 }, 
                            target: { type: 'fixed', player: 'self', position: 'source' }, 
                            operation: 'heal', 
                        }],
                        trigger: { type: 'end-of-turn', ownTurnOnly: false },
                    }],
                ]),
            });

            const { state } = runTestGame({
                actions: [ new EndTurnResponseMessage() ],
                customRepository: testRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature', [ 'basic-creature' ]),
                    StateBuilder.withTool('basic-creature-0', 'owner-only-tool'),
                    StateBuilder.withTool('basic-creature-0-0', 'any-turn-tool'),
                    StateBuilder.withDamage('basic-creature-0', 30),
                ),
            });

            expect(state.field.creatures[0][0].damageTaken).to.equal(20, 'Should heal 10 HP from owner-only tool on active creature');
        });

        it('should handle unlimited manual triggers', () => {
            const testRepository = new MockCardRepository({
                creatures: new Map<string, CreatureData>([
                    [ 'unlimited-creature', {
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
                                operation: 'heal',
                            }],
                            trigger: { type: 'manual', unlimited: true },
                        },
                    }],
                ]),
            });

            const { state } = runTestGame({
                actions: [
                    new UseAbilityResponseMessage(0),
                    new UseAbilityResponseMessage(0),
                ],
                customRepository: testRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'unlimited-creature'),
                    StateBuilder.withCreatures(1, 'basic-creature'),
                    StateBuilder.withDamage('unlimited-creature-0', 50),
                ),
            });

            expect(state.field.creatures[0][0].damageTaken).to.equal(30, 'Should heal 20 HP total from two unlimited triggers');
        });
    });

    describe('Start of Turn Triggers', () => {
        it('should trigger start-of-turn ability on own turn', () => {
            const testRepository = new MockCardRepository({
                creatures: new Map<string, CreatureData>([
                    [ 'start-heal-creature', {
                        templateId: 'start-heal-creature',
                        name: 'Start Heal Creature',
                        maxHp: 100,
                        type: 'colorless',
                        retreatCost: 1,
                        attacks: [{ name: 'Basic Attack', damage: 20, energyRequirements: [] }],
                        ability: {
                            name: 'Start Heal',
                            effects: [{ 
                                type: 'hp', 
                                amount: { type: 'constant', value: 15 }, 
                                target: { type: 'fixed', player: 'self', position: 'source' },
                                operation: 'heal',
                            }],
                            trigger: { type: 'start-of-turn', ownTurnOnly: true },
                        },
                    }],
                ]),
            });

            // Player 0 ends turn, player 1's turn starts and should heal
            const { state } = runTestGame({
                actions: [ new EndTurnResponseMessage() ],
                customRepository: testRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature'),
                    StateBuilder.withCreatures(1, 'start-heal-creature'),
                    StateBuilder.withDamage('start-heal-creature-1', 40),
                ),
            });

            // After player 0 ends turn, player 1's turn starts and their creature should heal
            expect(state.field.creatures[1][0].damageTaken).to.equal(25, 'Should heal 15 HP at start of turn');
        });

        it('should not trigger start-of-turn ability on opponent turn', () => {
            const testRepository = new MockCardRepository({
                creatures: new Map<string, CreatureData>([
                    [ 'start-heal-creature', {
                        templateId: 'start-heal-creature',
                        name: 'Start Heal Creature',
                        maxHp: 100,
                        type: 'colorless',
                        retreatCost: 1,
                        attacks: [{ name: 'Basic Attack', damage: 20, energyRequirements: [] }],
                        ability: {
                            name: 'Start Heal',
                            effects: [{ 
                                type: 'hp', 
                                amount: { type: 'constant', value: 15 }, 
                                target: { type: 'fixed', player: 'self', position: 'source' },
                                operation: 'heal',
                            }],
                            trigger: { type: 'start-of-turn', ownTurnOnly: true },
                        },
                    }],
                ]),
            });

            const { state } = runTestGame({
                actions: [],
                customRepository: testRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature'),
                    StateBuilder.withCreatures(1, 'start-heal-creature'),
                    StateBuilder.withDamage('start-heal-creature-1', 40),
                    StateBuilder.withTurn(0), // Player 0's turn, so player 1 should not heal
                ),
            });

            expect(state.field.creatures[1][0].damageTaken).to.equal(40, 'Should not heal on opponent turn');
        });
    });

    describe('On Play Triggers', () => {
        it('should trigger on-play ability when creature is played', () => {
            const testRepository = new MockCardRepository({
                creatures: new Map<string, CreatureData>([
                    [ 'on-play-heal-creature', {
                        templateId: 'on-play-heal-creature',
                        name: 'On Play Heal Creature',
                        maxHp: 80,
                        type: 'colorless',
                        retreatCost: 1,
                        attacks: [{ name: 'Basic Attack', damage: 20, energyRequirements: [] }],
                        ability: {
                            name: 'Play Heal',
                            effects: [{ 
                                type: 'hp', 
                                amount: { type: 'constant', value: 20 }, 
                                target: { type: 'fixed', player: 'self', position: 'source' },
                                operation: 'heal',
                            }],
                            trigger: { type: 'on-play' },
                        },
                    }],
                ]),
            });

            const { state } = runTestGame({
                actions: [ new PlayCardResponseMessage('on-play-heal-creature', 'creature') ],
                customRepository: testRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature'),
                    StateBuilder.withCreatures(1, 'basic-creature'),
                    StateBuilder.withHand(0, [{ templateId: 'on-play-heal-creature', type: 'creature' }]),
                ),
            });

            // Find the just-played creature on the bench
            const benchCard = state.field.creatures[0].find(c => c?.evolutionStack[0]?.templateId === 'on-play-heal-creature');
            expect(benchCard).to.exist;
            // The creature starts with 0 damage, and heal has no effect, so damage should be 0
            expect(benchCard!.damageTaken).to.equal(0, 'Should have 0 damage (healing from 0 has no effect)');
        });

        it('should trigger on-play ability when creature is evolved', () => {
            const testRepository = new MockCardRepository({
                creatures: new Map<string, CreatureData>([
                    [ 'evolution-heal-creature', {
                        templateId: 'evolution-heal-creature',
                        name: 'Evolution Heal Creature',
                        maxHp: 100,
                        type: 'colorless',
                        retreatCost: 1,
                        previousStageName: 'Basic Creature',
                        attacks: [{ name: 'Strong Attack', damage: 40, energyRequirements: [] }],
                        ability: {
                            name: 'Evolution Heal',
                            effects: [{ 
                                type: 'hp', 
                                amount: { type: 'constant', value: 25 }, 
                                target: { type: 'fixed', player: 'self', position: 'source' },
                                operation: 'heal',
                            }],
                            trigger: { type: 'on-play' },
                        },
                    }],
                ]),
            });

            const { state } = runTestGame({
                actions: [ new EvolveResponseMessage('evolution-heal-creature', 0) ],
                customRepository: testRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature'),
                    StateBuilder.withCreatures(1, 'basic-creature'),
                    StateBuilder.withHand(0, [{ templateId: 'evolution-heal-creature', type: 'creature' }]),
                    StateBuilder.withDamage('basic-creature-0', 50),
                ),
            });

            expect(state.field.creatures[0][0].damageTaken).to.equal(25, 'Should heal 25 HP when evolved');
        });

        it('should not trigger on-play ability for evolution when filterEvolution is true', () => {
            const testRepository = new MockCardRepository({
                creatures: new Map<string, CreatureData>([
                    [ 'evolution-no-trigger', {
                        templateId: 'evolution-no-trigger',
                        name: 'Evolution No Trigger',
                        maxHp: 100,
                        type: 'colorless',
                        retreatCost: 1,
                        previousStageName: 'Basic Creature',
                        attacks: [{ name: 'Strong Attack', damage: 40, energyRequirements: [] }],
                        ability: {
                            name: 'Non-Evolution Play',
                            effects: [{ 
                                type: 'hp', 
                                amount: { type: 'constant', value: 25 }, 
                                target: { type: 'fixed', player: 'self', position: 'source' },
                                operation: 'heal',
                            }],
                            trigger: { type: 'on-play', filterEvolution: true },
                        },
                    }],
                ]),
            });

            const { state } = runTestGame({
                actions: [ new EvolveResponseMessage('evolution-no-trigger', 0) ],
                customRepository: testRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature'),
                    StateBuilder.withCreatures(1, 'basic-creature'),
                    StateBuilder.withHand(0, [{ templateId: 'evolution-no-trigger', type: 'creature' }]),
                    StateBuilder.withDamage('basic-creature-0', 50),
                ),
            });

            expect(state.field.creatures[0][0].damageTaken).to.equal(50, 'Should not heal when evolved with filterEvolution');
        });
    });

    describe('Before Knockout Triggers', () => {
        it('should trigger before-knockout ability', () => {
            const testRepository = new MockCardRepository({
                creatures: new Map<string, CreatureData>([
                    [ 'last-stand-creature', {
                        templateId: 'last-stand-creature',
                        name: 'Last Stand Creature',
                        maxHp: 60,
                        type: 'colorless',
                        retreatCost: 1,
                        attacks: [{ name: 'Basic Attack', damage: 20, energyRequirements: [] }],
                        ability: {
                            name: 'Last Stand',
                            effects: [{ 
                                type: 'hp', 
                                amount: { type: 'constant', value: 30 }, 
                                target: { type: 'fixed', player: 'opponent', position: 'active' },
                                operation: 'damage',
                            }],
                            trigger: { type: 'before-knockout' },
                        },
                    }],
                    [ 'basic-attacker', {
                        templateId: 'basic-attacker',
                        name: 'Basic Attacker',
                        maxHp: 100,
                        type: 'colorless',
                        retreatCost: 1,
                        attacks: [{ name: 'Strong Attack', damage: 60, energyRequirements: [] }],
                    }],
                ]),
            });

            const { state } = runTestGame({
                actions: [ new AttackResponseMessage(0) ],
                customRepository: testRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-attacker'),
                    StateBuilder.withCreatures(1, 'last-stand-creature', [ 'basic-creature' ]),
                ),
            });

            expect(state.field.creatures[0][0].damageTaken).to.equal(30, 'Should deal 30 damage before knockout');
        });
    });

    describe('On Checkup Triggers', () => {
        it('should trigger on-checkup ability on own turn', () => {
            const testRepository = new MockCardRepository({
                creatures: new Map<string, CreatureData>([
                    [ 'checkup-heal-creature', {
                        templateId: 'checkup-heal-creature',
                        name: 'Checkup Heal Creature',
                        maxHp: 80,
                        type: 'colorless',
                        retreatCost: 1,
                        attacks: [{ name: 'Basic Attack', damage: 20, energyRequirements: [] }],
                        ability: {
                            name: 'Checkup Heal',
                            effects: [{ 
                                type: 'hp', 
                                amount: { type: 'constant', value: 10 }, 
                                target: { type: 'fixed', player: 'self', position: 'source' },
                                operation: 'heal',
                            }],
                            trigger: { type: 'on-checkup', ownTurnOnly: true },
                        },
                    }],
                ]),
            });

            const { state } = runTestGame({
                actions: [ new EndTurnResponseMessage() ],
                customRepository: testRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'checkup-heal-creature'),
                    StateBuilder.withCreatures(1, 'basic-creature'),
                    StateBuilder.withDamage('checkup-heal-creature-0', 30),
                ),
            });

            expect(state.field.creatures[0][0].damageTaken).to.equal(20, 'Should heal 10 HP during checkup');
        });

        it('should trigger on-checkup ability for both players', () => {
            const testRepository = new MockCardRepository({
                creatures: new Map<string, CreatureData>([
                    [ 'checkup-heal-creature', {
                        templateId: 'checkup-heal-creature',
                        name: 'Checkup Heal Creature',
                        maxHp: 80,
                        type: 'colorless',
                        retreatCost: 1,
                        attacks: [{ name: 'Basic Attack', damage: 20, energyRequirements: [] }],
                        ability: {
                            name: 'Checkup Heal',
                            effects: [{ 
                                type: 'hp', 
                                amount: { type: 'constant', value: 10 }, 
                                target: { type: 'fixed', player: 'self', position: 'source' },
                                operation: 'heal',
                            }],
                            trigger: { type: 'on-checkup' },
                        },
                    }],
                ]),
            });

            const { state } = runTestGame({
                actions: [ new EndTurnResponseMessage() ],
                customRepository: testRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'checkup-heal-creature'),
                    StateBuilder.withCreatures(1, 'checkup-heal-creature'),
                    StateBuilder.withDamage('checkup-heal-creature-0', 30),
                    StateBuilder.withDamage('checkup-heal-creature-1', 40),
                ),
            });

            expect(state.field.creatures[0][0].damageTaken).to.equal(20, 'Player 0 should heal 10 HP during checkup');
            expect(state.field.creatures[1][0].damageTaken).to.equal(30, 'Player 1 should heal 10 HP during checkup');
        });
    });

    describe('On Retreat Triggers', () => {
        it('should trigger on-retreat ability', () => {
            const testRepository = new MockCardRepository({
                creatures: new Map<string, CreatureData>([
                    [ 'retreat-heal-creature', {
                        templateId: 'retreat-heal-creature',
                        name: 'Retreat Heal Creature',
                        maxHp: 80,
                        type: 'colorless',
                        retreatCost: 0,
                        attacks: [{ name: 'Basic Attack', damage: 20, energyRequirements: [] }],
                        ability: {
                            name: 'Retreat Heal',
                            effects: [{ 
                                type: 'hp', 
                                amount: { type: 'constant', value: 15 }, 
                                target: { type: 'fixed', player: 'self', position: 'source' },
                                operation: 'heal',
                            }],
                            trigger: { type: 'on-retreat' },
                        },
                    }],
                ]),
            });

            const { state } = runTestGame({
                actions: [ new RetreatResponseMessage(0) ],
                customRepository: testRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'retreat-heal-creature', [ 'basic-creature' ]),
                    StateBuilder.withCreatures(1, 'basic-creature'),
                    StateBuilder.withDamage('retreat-heal-creature-0', 40),
                ),
            });

            // After retreat, the creature should be on the bench
            const retreatedCreature = state.field.creatures[0].find(c => c?.evolutionStack[0]?.templateId === 'retreat-heal-creature');
            expect(retreatedCreature).to.exist;
            expect(retreatedCreature!.damageTaken).to.equal(25, 'Should heal 15 HP on retreat');
        });
    });
});
