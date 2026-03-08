import { expect } from 'chai';
import { PlayCardResponseMessage } from '../../../src/messages/response/play-card-response-message.js';
import { AttackResponseMessage } from '../../../src/messages/response/attack-response-message.js';
import { StateBuilder } from '../../helpers/state-builder.js';
import { runTestGame } from '../../helpers/test-helpers.js';
import { MockCardRepository } from '../../mock-repository.js';

describe('Conditional Delegation Effect', () => {
    describe('single coin flip condition', () => {
        const testRepository = new MockCardRepository({
            creatures: {
                'flip-attacker': {
                    templateId: 'flip-attacker',
                    name: 'Flip Attacker',
                    maxHp: 80,
                    type: 'fire',
                    retreatCost: 1,
                    attacks: [{
                        name: 'Risky Strike',
                        damage: 0,
                        energyRequirements: [{ type: 'fire', amount: 1 }],
                        effects: [{
                            type: 'conditional-delegation',
                            condition: { type: 'coin-flip', headsValue: 1, tailsValue: 0 },
                            trueEffects: [{
                                type: 'hp',
                                amount: { type: 'constant', value: 40 },
                                target: { type: 'fixed', player: 'opponent', position: 'active' },
                                operation: 'damage',
                            }],
                            falseEffects: [],
                        }],
                    }],
                },
            },
        });

        it('should apply trueEffects when condition is non-zero (heads)', () => {
            const { state } = runTestGame({
                actions: [ new AttackResponseMessage(0) ],
                customRepository: testRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'flip-attacker'),
                    StateBuilder.withCreatures(1, 'high-hp-creature'),
                    StateBuilder.withEnergy('flip-attacker-0', { fire: 1 }),
                    StateBuilder.withMockedCoinFlips([ true ]),
                ),
            });

            expect(state.field.creatures[1][0].damageTaken).to.equal(40, 'Should deal 40 damage on heads');
        });

        it('should apply falseEffects (nothing) when condition is zero (tails)', () => {
            const { state } = runTestGame({
                actions: [ new AttackResponseMessage(0) ],
                customRepository: testRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'flip-attacker'),
                    StateBuilder.withCreatures(1, 'high-hp-creature'),
                    StateBuilder.withEnergy('flip-attacker-0', { fire: 1 }),
                    StateBuilder.withMockedCoinFlips([ false ]),
                ),
            });

            expect(state.field.creatures[1][0].damageTaken).to.equal(0, 'Should deal 0 damage on tails');
        });
    });

    describe('condition with both trueEffects and falseEffects', () => {
        const testRepository = new MockCardRepository({
            supporters: {
                'delegating-supporter': {
                    templateId: 'delegating-supporter',
                    name: 'Chance Supporter',
                    effects: [{
                        type: 'conditional-delegation',
                        condition: { type: 'coin-flip', headsValue: 1, tailsValue: 0 },
                        trueEffects: [{
                            type: 'draw',
                            amount: { type: 'constant', value: 3 },
                        }],
                        falseEffects: [{
                            type: 'draw',
                            amount: { type: 'constant', value: 1 },
                        }],
                    }],
                },
            },
        });

        it('should apply trueEffects on heads', () => {
            const { state } = runTestGame({
                actions: [ new PlayCardResponseMessage('delegating-supporter', 'supporter') ],
                customRepository: testRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature'),
                    StateBuilder.withHand(0, [{ templateId: 'delegating-supporter', type: 'supporter' }]),
                    StateBuilder.withDeck(0, Array(5).fill({ templateId: 'basic-creature', type: 'creature' })),
                    StateBuilder.withMockedCoinFlips([ true ]),
                ),
            });

            expect(state.hand[0].length).to.equal(3, 'Should draw 3 cards on heads');
        });

        it('should apply falseEffects on tails', () => {
            const { state } = runTestGame({
                actions: [ new PlayCardResponseMessage('delegating-supporter', 'supporter') ],
                customRepository: testRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature'),
                    StateBuilder.withHand(0, [{ templateId: 'delegating-supporter', type: 'supporter' }]),
                    StateBuilder.withDeck(0, Array(5).fill({ templateId: 'basic-creature', type: 'creature' })),
                    StateBuilder.withMockedCoinFlips([ false ]),
                ),
            });

            expect(state.hand[0].length).to.equal(1, 'Should draw 1 card on tails');
        });
    });

    describe('multi-coin condition (3 flips, at least 2 heads)', () => {
        // Uses ComparisonValue to check if the sum of 3 coin flips (each heads=1, tails=0) is >= 2
        const testRepository = new MockCardRepository({
            supporters: {
                'multi-flip-supporter': {
                    templateId: 'multi-flip-supporter',
                    name: 'Triple Flip Supporter',
                    effects: [{
                        type: 'conditional-delegation',
                        condition: {
                            type: 'comparison',
                            left: { type: 'coin-flip', headsValue: 1, tailsValue: 0, flipCount: 3 },
                            operator: '>=' as const,
                            right: { type: 'constant', value: 2 },
                            trueValue: { type: 'constant', value: 1 },
                            falseValue: { type: 'constant', value: 0 },
                        },
                        trueEffects: [{
                            type: 'draw',
                            amount: { type: 'constant', value: 3 },
                        }],
                        falseEffects: [{
                            type: 'draw',
                            amount: { type: 'constant', value: 1 },
                        }],
                    }],
                },
            },
        });

        it('should apply trueEffects when 2 of 3 flips are heads', () => {
            const { state } = runTestGame({
                actions: [ new PlayCardResponseMessage('multi-flip-supporter', 'supporter') ],
                customRepository: testRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature'),
                    StateBuilder.withHand(0, [{ templateId: 'multi-flip-supporter', type: 'supporter' }]),
                    StateBuilder.withDeck(0, Array(5).fill({ templateId: 'basic-creature', type: 'creature' })),
                    StateBuilder.withMockedCoinFlips([ true, true, false ]),
                ),
            });

            expect(state.hand[0].length).to.equal(3, 'Should draw 3 cards when 2 of 3 heads');
        });

        it('should apply falseEffects when fewer than 2 of 3 flips are heads', () => {
            const { state } = runTestGame({
                actions: [ new PlayCardResponseMessage('multi-flip-supporter', 'supporter') ],
                customRepository: testRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature'),
                    StateBuilder.withHand(0, [{ templateId: 'multi-flip-supporter', type: 'supporter' }]),
                    StateBuilder.withDeck(0, Array(5).fill({ templateId: 'basic-creature', type: 'creature' })),
                    StateBuilder.withMockedCoinFlips([ true, false, false ]),
                ),
            });

            expect(state.hand[0].length).to.equal(1, 'Should draw 1 card when fewer than 2 heads');
        });

        it('should apply trueEffects when all 3 flips are heads', () => {
            const { state } = runTestGame({
                actions: [ new PlayCardResponseMessage('multi-flip-supporter', 'supporter') ],
                customRepository: testRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature'),
                    StateBuilder.withHand(0, [{ templateId: 'multi-flip-supporter', type: 'supporter' }]),
                    StateBuilder.withDeck(0, Array(5).fill({ templateId: 'basic-creature', type: 'creature' })),
                    StateBuilder.withMockedCoinFlips([ true, true, true ]),
                ),
            });

            expect(state.hand[0].length).to.equal(3, 'Should draw 3 cards when all 3 heads');
        });
    });

    describe('non-coin-flip condition (constant value)', () => {
        const testRepository = new MockCardRepository({
            supporters: {
                'always-true-supporter': {
                    templateId: 'always-true-supporter',
                    name: 'Always True',
                    effects: [{
                        type: 'conditional-delegation',
                        condition: { type: 'constant', value: 1 },
                        trueEffects: [{
                            type: 'draw',
                            amount: { type: 'constant', value: 2 },
                        }],
                        falseEffects: [],
                    }],
                },
            },
        });

        it('should apply trueEffects when condition is a non-zero constant', () => {
            const { state } = runTestGame({
                actions: [ new PlayCardResponseMessage('always-true-supporter', 'supporter') ],
                customRepository: testRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature'),
                    StateBuilder.withHand(0, [{ templateId: 'always-true-supporter', type: 'supporter' }]),
                    StateBuilder.withDeck(0, Array(5).fill({ templateId: 'basic-creature', type: 'creature' })),
                ),
            });

            expect(state.hand[0].length).to.equal(2, 'Should draw 2 cards when condition is always 1');
        });
    });
});
