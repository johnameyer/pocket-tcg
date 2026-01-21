import { expect } from 'chai';
import { runTestGame } from '../helpers/test-helpers.js';
import { StateBuilder } from '../helpers/state-builder.js';
import { AttackResponseMessage } from '../../src/messages/response/attack-response-message.js';
import { PlayCardResponseMessage } from '../../src/messages/response/play-card-response-message.js';
import { MockCardRepository } from '../mock-repository.js';
import { CreatureData, SupporterData } from '../../src/repository/card-types.js';

describe('Effect Queue - Effects Triggering Other Effects', () => {
    describe('Damage Effects Triggering Other Effects', () => {
        it('should trigger damage-triggered ability when damage effect is applied', () => {
            // Create a creature with a damage-triggered ability
            const testRepository = new MockCardRepository({
                creatures: new Map<string, CreatureData>([
                    ['basic-creature', {
                        templateId: 'basic-creature',
                        name: 'Basic Creature',
                        maxHp: 100,
                        type: 'colorless',
                        retreatCost: 1,
                        attacks: [{ name: 'Basic Attack', damage: 20, energyRequirements: [] }]
                    }],
                    ['reactive-creature', {
                        templateId: 'reactive-creature',
                        name: 'Reactive Creature',
                        maxHp: 120,
                        type: 'colorless',
                        retreatCost: 1,
                        attacks: [{ name: 'Basic Attack', damage: 20, energyRequirements: [] }],
                        ability: {
                            name: 'Counter Strike',
                            trigger: { type: 'damaged' },
                            effects: [{
                                type: 'hp',
                                amount: { type: 'constant', value: 10 },
                                target: { type: 'fixed', player: 'opponent', position: 'active' },
                                operation: 'damage'
                            }]
                        }
                    }]
                ]),
                supporters: new Map<string, SupporterData>([
                    ['damage-supporter', {
                        templateId: 'damage-supporter',
                        name: 'Damage Supporter',
                        effects: [{
                            type: 'hp',
                            amount: { type: 'constant', value: 20 },
                            target: { type: 'fixed', player: 'opponent', position: 'active' },
                            operation: 'damage'
                        }]
                    }]
                ])
            });

            const { state } = runTestGame({
                actions: [new PlayCardResponseMessage('damage-supporter', 'supporter')],
                customRepository: testRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature'),
                    StateBuilder.withCreatures(1, 'reactive-creature'),
                    StateBuilder.withHand(0, [{ templateId: 'damage-supporter', type: 'supporter' }])
                )
            });

            // Player 1's reactive creature should take 20 damage from supporter
            expect(state.field.creatures[1][0].damageTaken).to.equal(20, 'Reactive creature should take damage from supporter');
            
            // Player 0's basic creature should take 10 damage from reactive creature's triggered ability
            expect(state.field.creatures[0][0].damageTaken).to.equal(10, 'Basic creature should take damage from triggered ability');
        });

        it('should handle cascading damage effects (damage triggering damage triggering damage)', () => {
            // Create creatures where damage triggers more damage
            const testRepository = new MockCardRepository({
                creatures: new Map<string, CreatureData>([
                    ['reactive-a', {
                        templateId: 'reactive-a',
                        name: 'Reactive A',
                        maxHp: 100,
                        type: 'colorless',
                        retreatCost: 1,
                        attacks: [{ 
                            name: 'Trigger Attack', 
                            damage: 10, 
                            energyRequirements: [] 
                        }]
                    }],
                    ['reactive-b', {
                        templateId: 'reactive-b',
                        name: 'Reactive B',
                        maxHp: 100,
                        type: 'colorless',
                        retreatCost: 1,
                        attacks: [{ name: 'Basic Attack', damage: 20, energyRequirements: [] }],
                        ability: {
                            name: 'Chain Reaction B',
                            trigger: { type: 'damaged' },
                            effects: [{
                                type: 'hp',
                                amount: { type: 'constant', value: 5 },
                                target: { type: 'fixed', player: 'opponent', position: 'active' },
                                operation: 'damage'
                            }]
                        }
                    }]
                ])
            });

            const { state } = runTestGame({
                actions: [new AttackResponseMessage(0)],
                customRepository: testRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'reactive-a'),
                    StateBuilder.withCreatures(1, 'reactive-b')
                )
            });

            // Player 1's reactive-b should take 10 damage from initial attack
            expect(state.field.creatures[1][0].damageTaken).to.equal(10, 'Reactive B should take initial damage');
            
            // Player 0's reactive-a should take 5 damage from reactive-b's triggered ability (when it took 10 damage)
            expect(state.field.creatures[0][0].damageTaken).to.equal(5, 'Reactive A should take counter damage from B');
        });
    });

    describe('Energy Attachment Triggering Effects', () => {
        it('should trigger energy-attachment ability when energy is attached by supporter', () => {
            const testRepository = new MockCardRepository({
                creatures: new Map<string, CreatureData>([
                    ['basic-creature', {
                        templateId: 'basic-creature',
                        name: 'Basic Creature',
                        maxHp: 100,
                        type: 'fire',
                        retreatCost: 1,
                        attacks: [{ name: 'Basic Attack', damage: 20, energyRequirements: [] }]
                    }],
                    ['energy-reactive', {
                        templateId: 'energy-reactive',
                        name: 'Energy Reactive',
                        maxHp: 100,
                        type: 'fire',
                        retreatCost: 1,
                        attacks: [{ name: 'Basic Attack', damage: 20, energyRequirements: [] }],
                        ability: {
                            name: 'Energy Burst',
                            trigger: { type: 'energy-attachment', energyType: 'fire' },
                            effects: [{
                                type: 'hp',
                                amount: { type: 'constant', value: 10 },
                                target: { type: 'fixed', player: 'opponent', position: 'active' },
                                operation: 'damage'
                            }]
                        }
                    }]
                ]),
                supporters: new Map<string, SupporterData>([
                    ['energy-supporter', {
                        templateId: 'energy-supporter',
                        name: 'Energy Supporter',
                        effects: [{
                            type: 'energy',
                            energyType: 'fire',
                            amount: { type: 'constant', value: 1 },
                            target: { type: 'fixed', player: 'self', position: 'active' },
                            operation: 'attach'
                        }]
                    }]
                ])
            });

            const { state } = runTestGame({
                actions: [new PlayCardResponseMessage('energy-supporter', 'supporter')],
                customRepository: testRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'energy-reactive'),
                    StateBuilder.withCreatures(1, 'basic-creature'),
                    StateBuilder.withHand(0, [{ templateId: 'energy-supporter', type: 'supporter' }])
                )
            });

            // Player 1's creature should take 10 damage from the triggered ability
            expect(state.field.creatures[1][0].damageTaken).to.equal(10, 'Opponent creature should take damage from energy attachment trigger');
        });

        it('should trigger energy-attachment for any energy type when not specified', () => {
            const testRepository = new MockCardRepository({
                creatures: new Map<string, CreatureData>([
                    ['basic-creature', {
                        templateId: 'basic-creature',
                        name: 'Basic Creature',
                        maxHp: 100,
                        type: 'water',
                        retreatCost: 1,
                        attacks: [{ name: 'Basic Attack', damage: 20, energyRequirements: [] }]
                    }],
                    ['any-energy-reactive', {
                        templateId: 'any-energy-reactive',
                        name: 'Any Energy Reactive',
                        maxHp: 100,
                        type: 'water',
                        retreatCost: 1,
                        attacks: [{ name: 'Basic Attack', damage: 20, energyRequirements: [] }],
                        ability: {
                            name: 'Energy Reaction',
                            trigger: { type: 'energy-attachment' }, // No specific energy type
                            effects: [{
                                type: 'draw',
                                amount: { type: 'constant', value: 1 }
                            }]
                        }
                    }]
                ]),
                supporters: new Map<string, SupporterData>([
                    ['water-energy-supporter', {
                        templateId: 'water-energy-supporter',
                        name: 'Water Energy Supporter',
                        effects: [{
                            type: 'energy',
                            energyType: 'water',
                            amount: { type: 'constant', value: 1 },
                            target: { type: 'fixed', player: 'self', position: 'active' },
                            operation: 'attach'
                        }]
                    }]
                ])
            });

            const { state } = runTestGame({
                actions: [new PlayCardResponseMessage('water-energy-supporter', 'supporter')],
                customRepository: testRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'any-energy-reactive'),
                    StateBuilder.withCreatures(1, 'basic-creature'),
                    StateBuilder.withHand(0, [{ templateId: 'water-energy-supporter', type: 'supporter' }]),
                    StateBuilder.withDeck(0, [{ templateId: 'basic-creature', type: 'creature' }])
                )
            });

            // Player 0 should have drawn 1 card from the triggered ability
            expect(state.hand[0].length).to.equal(1, 'Should have drawn a card from energy attachment trigger');
        });
    });

    describe('Multiple Effects Triggering Simultaneously', () => {
        it('should process all triggered effects in order', () => {
            // Create a scenario where damage triggers multiple effects
            const testRepository = new MockCardRepository({
                creatures: new Map<string, CreatureData>([
                    ['basic-creature', {
                        templateId: 'basic-creature',
                        name: 'Basic Creature',
                        maxHp: 100,
                        type: 'colorless',
                        retreatCost: 1,
                        attacks: [{ name: 'Basic Attack', damage: 20, energyRequirements: [] }]
                    }],
                    ['multi-reactive', {
                        templateId: 'multi-reactive',
                        name: 'Multi Reactive',
                        maxHp: 120,
                        type: 'colorless',
                        retreatCost: 1,
                        attacks: [{ name: 'Basic Attack', damage: 20, energyRequirements: [] }],
                        ability: {
                            name: 'Multi Counter',
                            trigger: { type: 'damaged' },
                            effects: [
                                {
                                    type: 'hp',
                                    amount: { type: 'constant', value: 5 },
                                    target: { type: 'fixed', player: 'opponent', position: 'active' },
                                    operation: 'damage'
                                },
                                {
                                    type: 'hp',
                                    amount: { type: 'constant', value: 5 },
                                    target: { type: 'fixed', player: 'self', position: 'active' },
                                    operation: 'heal'
                                }
                            ]
                        }
                    }]
                ]),
                supporters: new Map<string, SupporterData>([
                    ['damage-supporter', {
                        templateId: 'damage-supporter',
                        name: 'Damage Supporter',
                        effects: [{
                            type: 'hp',
                            amount: { type: 'constant', value: 20 },
                            target: { type: 'fixed', player: 'opponent', position: 'active' },
                            operation: 'damage'
                        }]
                    }]
                ])
            });

            const { state } = runTestGame({
                actions: [new PlayCardResponseMessage('damage-supporter', 'supporter')],
                customRepository: testRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature'),
                    StateBuilder.withCreatures(1, 'multi-reactive'),
                    StateBuilder.withHand(0, [{ templateId: 'damage-supporter', type: 'supporter' }])
                )
            });

            // Player 1's multi-reactive should take 20 damage, then heal 5
            expect(state.field.creatures[1][0].damageTaken).to.equal(15, 'Should take damage and then heal');
            
            // Player 0's creature should take 5 damage from counter
            expect(state.field.creatures[0][0].damageTaken).to.equal(5, 'Should take counter damage');
        });
    });
});
