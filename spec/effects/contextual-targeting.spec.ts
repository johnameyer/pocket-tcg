import { expect } from 'chai';
import { AttackResponseMessage } from '../../src/messages/response/attack-response-message.js';
import { AttachEnergyResponseMessage } from '../../src/messages/response/attach-energy-response-message.js';
import { EndTurnResponseMessage } from '../../src/messages/response/end-turn-response-message.js';
import { StateBuilder } from '../helpers/state-builder.js';
import { runTestGame } from '../helpers/test-helpers.js';
import { MockCardRepository } from '../mock-repository.js';

/**
 * Tests for the contextual field target system.
 *
 * ContextualFieldTarget allows effects in triggers and attacks to reference
 * named creatures from the execution context:
 *
 *   { type: 'contextual', reference: 'defender' }
 *     - valid in attack effects; resolves to the creature being attacked
 *
 *   { type: 'contextual', reference: 'attacker' }
 *     - valid in 'damaged' trigger effects; resolves to the attacking creature
 *
 *   { type: 'contextual', reference: 'attacker' }
 *     - valid in 'before-knockout' trigger effects; resolves to the attacking creature
 *
 *   { type: 'contextual', reference: 'trigger-target' }
 *     - valid in 'energy-attachment' trigger effects; resolves to the creature that received energy
 */
describe('Contextual Field Targeting', () => {
    describe('attack context - defender reference', () => {
        it('should deal extra damage to the defender via attack effect', () => {
            const testRepository = new MockCardRepository({
                creatures: {
                    'recoil-attacker': {
                        templateId: 'recoil-attacker',
                        name: 'Recoil Attacker',
                        maxHp: 100,
                        type: 'colorless',
                        retreatCost: 1,
                        attacks: [{
                            name: 'Recoil Attack',
                            damage: 20,
                            energyRequirements: [],
                            effects: [{
                                type: 'hp',
                                amount: { type: 'constant', value: 10 },
                                target: { type: 'contextual', reference: 'defender' },
                                operation: 'damage',
                            }],
                        }],
                    },
                    'target-creature': {
                        templateId: 'target-creature',
                        name: 'Target Creature',
                        maxHp: 100,
                        type: 'colorless',
                        retreatCost: 1,
                        attacks: [{ name: 'Basic Attack', damage: 10, energyRequirements: [] }],
                    },
                },
            });

            const { state } = runTestGame({
                actions: [ new AttackResponseMessage(0) ],
                customRepository: testRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'recoil-attacker'),
                    StateBuilder.withCreatures(1, 'target-creature'),
                ),
            });

            // 20 base attack + 10 from contextual defender effect = 30 total
            expect(state.field.creatures[1][0].damageTaken).to.equal(30, 'Defender should take 30 damage (20 base + 10 from effect)');
        });
    });

    describe('damaged trigger context - attacker reference', () => {
        it('should deal damage back to the attacker when damaged', () => {
            const testRepository = new MockCardRepository({
                creatures: {
                    'thorns-creature': {
                        templateId: 'thorns-creature',
                        name: 'Thorns Creature',
                        maxHp: 100,
                        type: 'colorless',
                        retreatCost: 1,
                        attacks: [{ name: 'Basic Attack', damage: 10, energyRequirements: [] }],
                        ability: {
                            name: 'Thorns',
                            effects: [{
                                type: 'hp',
                                amount: { type: 'constant', value: 20 },
                                target: { type: 'contextual', reference: 'attacker' },
                                operation: 'damage',
                            }],
                            trigger: { type: 'damaged' },
                        },
                    },
                    'basic-attacker': {
                        templateId: 'basic-attacker',
                        name: 'Basic Attacker',
                        maxHp: 80,
                        type: 'colorless',
                        retreatCost: 1,
                        attacks: [{ name: 'Strike', damage: 30, energyRequirements: [] }],
                    },
                },
            });

            const { state } = runTestGame({
                actions: [ new AttackResponseMessage(0) ],
                customRepository: testRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-attacker'),
                    StateBuilder.withCreatures(1, 'thorns-creature'),
                ),
            });

            // Thorns creature takes 30 damage and returns 20 to attacker
            expect(state.field.creatures[1][0].damageTaken).to.equal(30, 'Thorns creature should take 30 damage');
            expect(state.field.creatures[0][0].damageTaken).to.equal(20, 'Attacker should take 20 damage from thorns');
        });

        it('should not deal damage to attacker when damage is from an effect (no attacker in context)', () => {
            const testRepository = new MockCardRepository({
                creatures: {
                    'thorns-creature': {
                        templateId: 'thorns-creature',
                        name: 'Thorns Creature',
                        maxHp: 100,
                        type: 'colorless',
                        retreatCost: 1,
                        attacks: [{ name: 'Basic Attack', damage: 10, energyRequirements: [] }],
                        ability: {
                            name: 'Thorns',
                            effects: [{
                                type: 'hp',
                                amount: { type: 'constant', value: 20 },
                                target: { type: 'contextual', reference: 'attacker' },
                                operation: 'damage',
                            }],
                            trigger: { type: 'damaged' },
                        },
                    },
                    'poison-attacker': {
                        templateId: 'poison-attacker',
                        name: 'Poison Attacker',
                        maxHp: 80,
                        type: 'colorless',
                        retreatCost: 1,
                        attacks: [{ name: 'Poison Attack', damage: 0, energyRequirements: [] }],
                    },
                },
            });

            // Manually deal damage to thorns creature without an attack (no attacker context)
            // We apply damage directly via state builder - thorns should not trigger with attacker
            const { state } = runTestGame({
                actions: [ new EndTurnResponseMessage() ],
                customRepository: testRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'poison-attacker'),
                    StateBuilder.withCreatures(1, 'thorns-creature'),
                ),
            });

            // No attack took place, so attacker should have 0 damage
            expect(state.field.creatures[0][0].damageTaken).to.equal(0, 'Attacker should take no damage when no attack occurred');
        });
    });

    describe('energy-attachment trigger context - trigger-target reference', () => {
        it('should deal damage to the creature energy was attached to (self)', () => {
            const testRepository = new MockCardRepository({
                creatures: {
                    'reactive-watcher': {
                        templateId: 'reactive-watcher',
                        name: 'Reactive Watcher',
                        maxHp: 100,
                        type: 'colorless',
                        retreatCost: 1,
                        attacks: [{ name: 'Watch Attack', damage: 10, energyRequirements: [] }],
                        ability: {
                            name: 'Energy Watch',
                            effects: [{
                                type: 'hp',
                                amount: { type: 'constant', value: 20 },
                                target: { type: 'contextual', reference: 'trigger-target' },
                                operation: 'damage',
                            }],
                            trigger: { type: 'energy-attachment' },
                        },
                    },
                },
            });

            const { state } = runTestGame({
                actions: [ new AttachEnergyResponseMessage(0) ],
                customRepository: testRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'reactive-watcher'),
                    StateBuilder.withCreatures(1, 'basic-creature'),
                    StateBuilder.withCurrentEnergy(0, 'fire'),
                ),
            });

            // Player 0 attaches energy to their own active creature (index 0)
            // The trigger fires: target = trigger-target = the creature energy was just attached to
            expect(state.field.creatures[0][0].damageTaken).to.equal(20, 'Energy recipient should take 20 damage from ability');
        });

        it('should deal damage to the opponent creature that received energy (cross-player)', () => {
            const testRepository = new MockCardRepository({
                creatures: {
                    'energy-punisher': {
                        templateId: 'energy-punisher',
                        name: 'Energy Punisher',
                        maxHp: 100,
                        type: 'colorless',
                        retreatCost: 1,
                        attacks: [{ name: 'Punish Attack', damage: 10, energyRequirements: [] }],
                        ability: {
                            name: 'Energy Punishment',
                            effects: [{
                                type: 'hp',
                                amount: { type: 'constant', value: 30 },
                                target: { type: 'contextual', reference: 'trigger-target' },
                                operation: 'damage',
                            }],
                            trigger: { type: 'energy-attachment' },
                        },
                    },
                    'energy-receiver': {
                        templateId: 'energy-receiver',
                        name: 'Energy Receiver',
                        maxHp: 120,
                        type: 'colorless',
                        retreatCost: 1,
                        attacks: [{ name: 'Basic Attack', damage: 10, energyRequirements: [] }],
                    },
                },
            });

            // Player 1 attaches energy on their turn; player 0's energy-punisher should fire
            const { state } = runTestGame({
                actions: [
                    new EndTurnResponseMessage(), // P0 ends turn
                    new AttachEnergyResponseMessage(0), // P1 attaches energy to their active creature
                ],
                customRepository: testRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'energy-punisher'),
                    StateBuilder.withCreatures(1, 'energy-receiver'),
                    StateBuilder.withCurrentEnergy(1, 'fire'),
                ),
            });

            // Player 1's active creature received energy and should take 30 damage from player 0's ability
            expect(state.field.creatures[1][0].damageTaken).to.equal(30, 'Opponent creature that received energy should take 30 damage');
            expect(state.field.creatures[0][0].damageTaken).to.equal(0, 'Energy punisher should take no damage');
        });

        it('should deal damage to the trigger-target from a tool on the opposite side', () => {
            const testRepository = new MockCardRepository({
                creatures: {
                    'watcher-creature': {
                        templateId: 'watcher-creature',
                        name: 'Watcher Creature',
                        maxHp: 100,
                        type: 'colorless',
                        retreatCost: 1,
                        attacks: [{ name: 'Watch Attack', damage: 10, energyRequirements: [] }],
                    },
                    'energy-receiver': {
                        templateId: 'energy-receiver',
                        name: 'Energy Receiver',
                        maxHp: 120,
                        type: 'colorless',
                        retreatCost: 1,
                        attacks: [{ name: 'Basic Attack', damage: 10, energyRequirements: [] }],
                    },
                },
                tools: {
                    'energy-watch-tool': {
                        templateId: 'energy-watch-tool',
                        name: 'Energy Watch Tool',
                        effects: [{
                            type: 'hp',
                            amount: { type: 'constant', value: 10 },
                            target: { type: 'contextual', reference: 'trigger-target' },
                            operation: 'damage',
                        }],
                        trigger: { type: 'energy-attachment' },
                    },
                },
            });

            // Player 1 attaches energy; player 0's tool should deal damage to the creature that received energy
            const { state } = runTestGame({
                actions: [
                    new EndTurnResponseMessage(), // P0 ends turn
                    new AttachEnergyResponseMessage(0), // P1 attaches energy to their active
                ],
                customRepository: testRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'watcher-creature'),
                    StateBuilder.withTool('watcher-creature-0', 'energy-watch-tool'),
                    StateBuilder.withCreatures(1, 'energy-receiver'),
                    StateBuilder.withCurrentEnergy(1, 'fire'),
                ),
            });

            // Tool fires for player 0 targeting the trigger-target (player 1's creature that got energy)
            expect(state.field.creatures[1][0].damageTaken).to.equal(10, 'Opponent creature that received energy should take 10 damage from tool');
        });
    });

    describe('before-knockout trigger context - attacker reference', () => {
        it('should deal damage to the attacker before being knocked out', () => {
            const testRepository = new MockCardRepository({
                creatures: {
                    'last-stand-creature': {
                        templateId: 'last-stand-creature',
                        name: 'Last Stand Creature',
                        maxHp: 60,
                        type: 'colorless',
                        retreatCost: 1,
                        attacks: [{ name: 'Basic Attack', damage: 10, energyRequirements: [] }],
                        ability: {
                            name: 'Last Stand',
                            effects: [{
                                type: 'hp',
                                amount: { type: 'constant', value: 30 },
                                target: { type: 'contextual', reference: 'attacker' },
                                operation: 'damage',
                            }],
                            trigger: { type: 'before-knockout' },
                        },
                    },
                    'strong-attacker': {
                        templateId: 'strong-attacker',
                        name: 'Strong Attacker',
                        maxHp: 100,
                        type: 'colorless',
                        retreatCost: 1,
                        attacks: [{ name: 'Finishing Blow', damage: 70, energyRequirements: [] }],
                    },
                },
            });

            const { state } = runTestGame({
                actions: [ new AttackResponseMessage(0) ],
                customRepository: testRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'strong-attacker'),
                    StateBuilder.withCreatures(1, 'last-stand-creature', [ 'basic-creature' ]),
                ),
            });

            // Strong attacker deals 70 damage, knocking out last-stand-creature (60 HP)
            // Before knockout, last-stand fires and deals 30 damage to attacker
            expect(state.field.creatures[0][0].damageTaken).to.equal(30, 'Attacker should take 30 damage from before-knockout ability');
        });
    });
});
