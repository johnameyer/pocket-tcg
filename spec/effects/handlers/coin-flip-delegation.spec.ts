import { expect } from 'chai';
import { PlayCardResponseMessage } from '../../../src/messages/response/play-card-response-message.js';
import { AttackResponseMessage } from '../../../src/messages/response/attack-response-message.js';
import { StateBuilder } from '../../helpers/state-builder.js';
import { runTestGame } from '../../helpers/test-helpers.js';
import { MockCardRepository } from '../../mock-repository.js';

describe('Coin Flip Delegation Effect', () => {
    describe('single coin flip (flipCount: 1, minHeads: 1)', () => {
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
                            type: 'coin-flip-delegation',
                            flipCount: 1,
                            minHeads: 1,
                            headsEffects: [{
                                type: 'hp',
                                amount: { type: 'constant', value: 40 },
                                target: { type: 'fixed', player: 'opponent', position: 'active' },
                                operation: 'damage',
                            }],
                            tailsEffects: [],
                        }],
                    }],
                },
            },
        });

        it('should apply headsEffects on heads', () => {
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

        it('should apply tailsEffects (nothing) on tails', () => {
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

    describe('tails effects applied on tails', () => {
        const testRepository = new MockCardRepository({
            supporters: {
                'delegating-supporter': {
                    templateId: 'delegating-supporter',
                    name: 'Chance Supporter',
                    effects: [{
                        type: 'coin-flip-delegation',
                        flipCount: 1,
                        minHeads: 1,
                        headsEffects: [{
                            type: 'draw',
                            amount: { type: 'constant', value: 3 },
                        }],
                        tailsEffects: [{
                            type: 'draw',
                            amount: { type: 'constant', value: 1 },
                        }],
                    }],
                },
            },
        });

        it('should apply headsEffects on heads', () => {
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

        it('should apply tailsEffects on tails', () => {
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

    describe('multiple coin flips (flipCount: 3, minHeads: 2)', () => {
        const testRepository = new MockCardRepository({
            supporters: {
                'multi-flip-supporter': {
                    templateId: 'multi-flip-supporter',
                    name: 'Triple Flip Supporter',
                    effects: [{
                        type: 'coin-flip-delegation',
                        flipCount: 3,
                        minHeads: 2,
                        headsEffects: [{
                            type: 'draw',
                            amount: { type: 'constant', value: 3 },
                        }],
                        tailsEffects: [{
                            type: 'draw',
                            amount: { type: 'constant', value: 1 },
                        }],
                    }],
                },
            },
        });

        it('should apply headsEffects when 2 of 3 flips are heads', () => {
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

        it('should apply tailsEffects when fewer than 2 of 3 flips are heads', () => {
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

        it('should apply headsEffects when all 3 flips are heads', () => {
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
});
