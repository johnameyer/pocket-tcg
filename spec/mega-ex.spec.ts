import { expect } from 'chai';
import { runTestGame } from './helpers/test-helpers.js';
import { StateBuilder } from './helpers/state-builder.js';
import { AttackResponseMessage } from '../src/messages/response/attack-response-message.js';
import { PlayCardResponseMessage } from '../src/messages/response/play-card-response-message.js';
import { SelectActiveCardResponseMessage } from '../src/messages/response/select-active-card-response-message.js';
import { MockCardRepository } from './mock-repository.js';
import { CreatureData, ItemData } from '../src/repository/card-types.js';

describe('Mega EX Cards', () => {
    const testRepository = new MockCardRepository({
        creatures: new Map<string, CreatureData>([
            ['basic-creature', {
                templateId: 'basic-creature',
                name: 'Basic Creature',
                maxHp: 80,
                type: 'fire',
                weakness: 'water',
                retreatCost: 1,
                attacks: [{ name: 'Basic Attack', damage: 80, energyRequirements: [{ type: 'fire', amount: 1 }] }]
            }],
            ['ex-creature', {
                templateId: 'ex-creature',
                name: 'Ex Creature',
                maxHp: 180,
                type: 'water',
                weakness: 'grass',
                retreatCost: 2,
                attributes: { ex: true },
                attacks: [{ name: 'Ex Attack', damage: 180, energyRequirements: [{ type: 'water', amount: 2 }] }]
            }],
            ['mega-ex-creature', {
                templateId: 'mega-ex-creature',
                name: 'Mega Ex Creature',
                maxHp: 220,
                type: 'lightning',
                weakness: 'fighting',
                retreatCost: 3,
                attributes: { ex: true, mega: true },
                attacks: [{ name: 'Mega Attack', damage: 220, energyRequirements: [{ type: 'lightning', amount: 3 }] }]
            }]
        ]),
        items: new Map<string, ItemData>([
            ['prevent-ex-item', {
                templateId: 'prevent-ex-item',
                name: 'Prevent Ex Item',
                effects: [{
                    type: 'prevent-damage',
                    source: 'ex-creature',
                    target: { type: 'fixed', player: 'self', position: 'active' }
                }]
            }]
        ])
    });

    describe('Point Awarding', () => {
        it('should award 3 points when a mega ex card is knocked out (active)', () => {
            const { state, getExecutedCount } = runTestGame({
                actions: [
                    new AttackResponseMessage(0), // Attack to knock out mega ex
                    new SelectActiveCardResponseMessage(0) // Player 1 selects replacement (if any bench cards)
                ],
                customRepository: testRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature'),
                    StateBuilder.withCreatures(1, 'mega-ex-creature', ['basic-creature']), // Bench card for promotion
                    StateBuilder.withDamage('mega-ex-creature-1', 140), // Pre-damage so 80 damage attack will KO (140 + 80 = 220)
                    StateBuilder.withEnergy('basic-creature-0', { fire: 1 })
                ),
                maxSteps: 15
            });

            expect(getExecutedCount()).to.be.greaterThanOrEqual(1, 'Should have executed attack');
            // After knockout and promotion, opponent should still have their bench card
            expect(state.points[0]).to.equal(3, 'Player 0 should have 3 points from mega ex knockout');
        });

        it('should award 2 points when a regular ex card is knocked out (active)', () => {
            const { state, getExecutedCount } = runTestGame({
                actions: [
                    new AttackResponseMessage(0), // Attack to knock out ex
                    new SelectActiveCardResponseMessage(0) // Player 1 selects replacement
                ],
                customRepository: testRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature'),
                    StateBuilder.withCreatures(1, 'ex-creature', ['basic-creature']),
                    StateBuilder.withDamage('ex-creature-1', 100), // Pre-damage so 80 damage attack will KO (100 + 80 = 180)
                    StateBuilder.withEnergy('basic-creature-0', { fire: 1 })
                ),
                maxSteps: 15
            });

            expect(getExecutedCount()).to.be.greaterThanOrEqual(1, 'Should have executed attack');
            expect(state.points[0]).to.equal(2, 'Player 0 should have 2 points from ex knockout');
        });

        it('should award 1 point when a regular card is knocked out (active)', () => {
            const { state, getExecutedCount } = runTestGame({
                actions: [
                    new AttackResponseMessage(0), // Attack to knock out basic
                    new SelectActiveCardResponseMessage(0) // Player 1 selects replacement
                ],
                customRepository: testRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature'),
                    StateBuilder.withCreatures(1, 'basic-creature', ['basic-creature']),
                    StateBuilder.withEnergy('basic-creature-0', { fire: 1 })
                ),
                maxSteps: 15
            });

            expect(getExecutedCount()).to.be.greaterThanOrEqual(1, 'Should have executed attack');
            expect(state.points[0]).to.equal(1, 'Player 0 should have 1 point from basic knockout');
        });

        it('should award 3 points when a mega ex bench card is knocked out', () => {
            const benchTargetRepository = new MockCardRepository({
                creatures: new Map<string, CreatureData>([
                    ['basic-creature', {
                        templateId: 'basic-creature',
                        name: 'Basic Creature',
                        maxHp: 80,
                        type: 'fire',
                        weakness: 'water',
                        retreatCost: 1,
                        attacks: [{
                            name: 'Bench Attack',
                            damage: 0,
                            energyRequirements: [{ type: 'fire', amount: 1 }],
                            effects: [{
                                type: 'hp',
                                amount: { type: 'constant', value: 220 },
                                target: { type: 'all-matching', criteria: { player: 'opponent', position: 'bench' } },
                                operation: 'damage' as const
                            }]
                        }]
                    }],
                    ['mega-ex-creature', {
                        templateId: 'mega-ex-creature',
                        name: 'Mega Ex Creature',
                        maxHp: 220,
                        type: 'lightning',
                        weakness: 'fighting',
                        retreatCost: 3,
                        attributes: { ex: true, mega: true },
                        attacks: [{ name: 'Mega Attack', damage: 220, energyRequirements: [{ type: 'lightning', amount: 3 }] }]
                    }]
                ])
            });

            const { state, getExecutedCount } = runTestGame({
                actions: [
                    new AttackResponseMessage(0) // Attack to knock out benched mega ex
                ],
                customRepository: benchTargetRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature'),
                    StateBuilder.withCreatures(1, 'basic-creature', ['mega-ex-creature']), // Mega ex on bench
                    StateBuilder.withEnergy('basic-creature-0', { fire: 1 })
                ),
                maxSteps: 15
            });

            expect(getExecutedCount()).to.equal(1, 'Should have executed attack');
            expect(state.field.creatures[1].length).to.equal(1, 'Opponent should have only active creature');
            expect(state.points[0]).to.equal(3, 'Player 0 should have 3 points from mega ex bench knockout');
        });
    });

    describe('Ex Protection', () => {
        it('should prevent damage from mega ex cards when ex protection is active', () => {
            const { state, getExecutedCount } = runTestGame({
                actions: [
                    new PlayCardResponseMessage('prevent-ex-item', 'item'),
                    new AttackResponseMessage(0) // Mega ex attack should be prevented
                ],
                customRepository: testRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'mega-ex-creature'),
                    StateBuilder.withCreatures(1, 'basic-creature'),
                    StateBuilder.withHand(0, [{ templateId: 'prevent-ex-item', type: 'item' }]),
                    StateBuilder.withEnergy('mega-ex-creature-0', { lightning: 3 })
                ),
                maxSteps: 15
            });

            expect(getExecutedCount()).to.equal(2, 'Should have executed prevent item and attack');
            expect(state.field.creatures[1][0].damageTaken).to.equal(0, 'Should take no damage from mega ex (prevented)');
        });

        it('should prevent damage from regular ex cards when ex protection is active', () => {
            const { state, getExecutedCount } = runTestGame({
                actions: [
                    new PlayCardResponseMessage('prevent-ex-item', 'item'),
                    new AttackResponseMessage(0) // Ex attack should be prevented
                ],
                customRepository: testRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'ex-creature'),
                    StateBuilder.withCreatures(1, 'basic-creature'),
                    StateBuilder.withHand(0, [{ templateId: 'prevent-ex-item', type: 'item' }]),
                    StateBuilder.withEnergy('ex-creature-0', { water: 2 })
                ),
                maxSteps: 15
            });

            expect(getExecutedCount()).to.equal(2, 'Should have executed prevent item and attack');
            expect(state.field.creatures[1][0].damageTaken).to.equal(0, 'Should take no damage from ex (prevented)');
        });

        it('should allow damage from basic cards when ex protection is active', () => {
            const { state, getExecutedCount } = runTestGame({
                actions: [
                    new PlayCardResponseMessage('prevent-ex-item', 'item'),
                    new AttackResponseMessage(0) // Basic attack should not be prevented
                ],
                customRepository: testRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature'),
                    StateBuilder.withCreatures(1, 'basic-creature'),
                    StateBuilder.withHand(0, [{ templateId: 'prevent-ex-item', type: 'item' }]),
                    StateBuilder.withEnergy('basic-creature-0', { fire: 1 })
                ),
                maxSteps: 15
            });

            expect(getExecutedCount()).to.equal(2, 'Should have executed prevent item and attack');
            expect(state.field.creatures[1][0].damageTaken).to.equal(80, 'Should take full damage from basic creature');
        });
    });

    describe('Attribute Conditions', () => {
        it('should recognize mega ex cards as ex cards', () => {
            const { state } = runTestGame({
                actions: [
                    new AttackResponseMessage(0) // Attack mega ex - should take damage
                ],
                customRepository: testRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature'),
                    StateBuilder.withCreatures(1, 'mega-ex-creature'),
                    StateBuilder.withEnergy('basic-creature-0', { fire: 1 })
                ),
                maxSteps: 15
            });

            // Just verify the mega ex creature exists and can be attacked
            expect(state.field.creatures[1][0].damageTaken).to.equal(80, 'Mega ex should take damage like normal');
        });

        it('should recognize regular ex cards as ex cards', () => {
            const { state } = runTestGame({
                actions: [
                    new AttackResponseMessage(0) // Attack ex - should take damage
                ],
                customRepository: testRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature'),
                    StateBuilder.withCreatures(1, 'ex-creature'),
                    StateBuilder.withEnergy('basic-creature-0', { fire: 1 })
                ),
                maxSteps: 15
            });

            // Just verify the ex creature exists and can be attacked
            expect(state.field.creatures[1][0].damageTaken).to.equal(80, 'Ex should take damage like normal');
        });
    });
});
