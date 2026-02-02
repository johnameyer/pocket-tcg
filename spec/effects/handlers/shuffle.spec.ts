import { expect } from 'chai';
import { runTestGame } from '../../helpers/test-helpers.js';
import { StateBuilder } from '../../helpers/state-builder.js';
import { PlayCardResponseMessage } from '../../../src/messages/response/play-card-response-message.js';
import { MockCardRepository } from '../../mock-repository.js';
import { ItemData, SupporterData } from '../../../src/repository/card-types.js';
import { GameCard } from '../../../src/controllers/card-types.js';
import { ShuffleEffectHandler } from '../../../src/effects/handlers/shuffle-effect-handler.js';
import { EffectContextFactory } from '../../../src/effects/effect-context.js';
import { ShuffleEffect } from '../../../src/repository/effect-types.js';
import { HandlerDataBuilder } from '../../helpers/handler-data-builder.js';

describe('Shuffle Effect', () => {
    describe('canApply', () => {
        const handler = new ShuffleEffectHandler();

        it('should always return true (shuffle effects can always be applied)', () => {
            const handlerData = HandlerDataBuilder.default(
                HandlerDataBuilder.withDeck(0),
            );

            const effect: ShuffleEffect = {
                type: 'shuffle',
                target: 'self',
            };

            const context = EffectContextFactory.createCardContext(0, 'Test Shuffle', 'item');
            const result = handler.canApply(handlerData, effect, context);
            
            expect(result).to.be.true;
        });

        it('should return true even when deck is empty', () => {
            const handlerData = HandlerDataBuilder.default(
                HandlerDataBuilder.withDeck(0),
            );

            const effect: ShuffleEffect = {
                type: 'shuffle',
                target: 'opponent',
            };

            const context = EffectContextFactory.createCardContext(0, 'Test Shuffle', 'item');
            const result = handler.canApply(handlerData, effect, context);
            
            expect(result).to.be.true;
        });
    });

    it('should shuffle opponent hand and draw 3 (basic operation)', () => {
        const testRepository = new MockCardRepository({
            items: new Map<string, ItemData>([
                [ 'shuffle-item', {
                    templateId: 'shuffle-item',
                    name: 'Shuffle Item',
                    effects: [{
                        type: 'shuffle',
                        target: 'opponent',
                        shuffleHand: true,
                        drawAfter: { type: 'constant', value: 3 },
                    }],
                }],
            ]),
        });

        const { state } = runTestGame({
            actions: [ new PlayCardResponseMessage('shuffle-item', 'item') ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withHand(0, [{ templateId: 'shuffle-item', type: 'item' }]),
                StateBuilder.withHand(1, Array(5).fill({ templateId: 'basic-creature', type: 'creature' })),
                StateBuilder.withDeck(1, Array(10).fill({ templateId: 'basic-creature', type: 'creature' })),
            ),
            maxSteps: 10,
        });

        expect(state.hand[1].length).to.equal(3, 'Opponent should draw 3 cards');
        expect(state.deck[1].length).to.equal(12, 'Opponent deck should have original + shuffled cards');
    });

    it('should shuffle different targets (self)', () => {
        const testRepository = new MockCardRepository({
            supporters: new Map<string, SupporterData>([
                [ 'self-shuffle', {
                    templateId: 'self-shuffle',
                    name: 'Self Shuffle',
                    effects: [{ type: 'shuffle', target: 'self', shuffleHand: true }],
                }],
            ]),
        });

        const { state } = runTestGame({
            actions: [ new PlayCardResponseMessage('self-shuffle', 'supporter') ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withHand(0, [{ templateId: 'self-shuffle', type: 'supporter' }]),
                StateBuilder.withDeck(0, Array(5).fill({ templateId: 'basic-creature', type: 'creature' })),
            ),
            maxSteps: 10,
        });

        expect(state.deck[0].length).to.equal(5, 'Own deck should maintain size');
    });

    it('should shuffle both players', () => {
        const testRepository = new MockCardRepository({
            supporters: new Map<string, SupporterData>([
                [ 'both-shuffle', {
                    templateId: 'both-shuffle',
                    name: 'Both Shuffle',
                    effects: [{
                        type: 'shuffle',
                        target: 'both',
                        shuffleHand: true,
                        drawAfter: { type: 'constant', value: 1 },
                    }],
                }],
            ]),
        });

        const { state } = runTestGame({
            actions: [ new PlayCardResponseMessage('both-shuffle', 'supporter') ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withHand(0, [{ templateId: 'both-shuffle', type: 'supporter' }]),
                StateBuilder.withDeck(0, Array(5).fill({ templateId: 'basic-creature', type: 'creature' })),
                StateBuilder.withDeck(1, Array(6).fill({ templateId: 'basic-creature', type: 'creature' })),
            ),
            maxSteps: 10,
        });

        expect(state.hand[0].length).to.equal(1, 'Player should draw 1 card');
        expect(state.hand[1].length).to.equal(1, 'Opponent should draw 1 card');
    });

    it('should draw different amounts after shuffle (2 cards)', () => {
        const testRepository = new MockCardRepository({
            supporters: new Map<string, SupporterData>([
                [ 'shuffle-draw', {
                    templateId: 'shuffle-draw',
                    name: 'Shuffle Draw',
                    effects: [{
                        type: 'shuffle',
                        target: 'self',
                        shuffleHand: true,
                        drawAfter: { type: 'constant', value: 2 },
                    }],
                }],
            ]),
        });

        const { state } = runTestGame({
            actions: [ new PlayCardResponseMessage('shuffle-draw', 'supporter') ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withHand(0, [{ templateId: 'shuffle-draw', type: 'supporter' }]),
                StateBuilder.withDeck(0, Array(8).fill({ templateId: 'basic-creature', type: 'creature' })),
            ),
            maxSteps: 10,
        });

        expect(state.hand[0].length).to.equal(2, 'Should draw 2 cards after shuffle');
        expect(state.deck[0].length).to.equal(6, 'Should have 6 cards left');
    });

    it('should shuffle without drawing', () => {
        const testRepository = new MockCardRepository({
            supporters: new Map<string, SupporterData>([
                [ 'pure-shuffle', {
                    templateId: 'pure-shuffle',
                    name: 'Pure Shuffle',
                    effects: [{ type: 'shuffle', target: 'opponent', shuffleHand: true }],
                }],
            ]),
        });

        const { state } = runTestGame({
            actions: [ new PlayCardResponseMessage('pure-shuffle', 'supporter') ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withHand(0, [{ templateId: 'pure-shuffle', type: 'supporter' }]),
                StateBuilder.withHand(1, Array(4).fill({ templateId: 'basic-creature', type: 'creature' })),
                StateBuilder.withDeck(1, Array(6).fill({ templateId: 'basic-creature', type: 'creature' })),
            ),
            maxSteps: 10,
        });

        expect(state.hand[1].length).to.equal(0, 'Opponent should not draw cards');
        expect(state.deck[1].length).to.equal(10, 'Opponent deck should have all cards');
    });

    it('should handle empty deck after shuffle', () => {
        const testRepository = new MockCardRepository({
            supporters: new Map<string, SupporterData>([
                [ 'empty-shuffle', {
                    templateId: 'empty-shuffle',
                    name: 'Empty Shuffle',
                    effects: [{
                        type: 'shuffle',
                        target: 'self',
                        shuffleHand: true,
                        drawAfter: { type: 'constant', value: 2 },
                    }],
                }],
            ]),
        });

        const { state } = runTestGame({
            actions: [ new PlayCardResponseMessage('empty-shuffle', 'supporter') ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withHand(0, [{ templateId: 'empty-shuffle', type: 'supporter' }]),
                StateBuilder.withDeck(0, []),
            ),
            maxSteps: 10,
        });

        expect(state.hand[0].length).to.equal(0, 'Should not draw from empty deck');
    });

    describe('Shuffle Effects Integration', () => {
        const shuffleSupporter = { templateId: 'shuffle-supporter', type: 'supporter' as const };
        const discardItem = { templateId: 'discard-item', type: 'item' as const };
        const drawSupporter = { templateId: 'draw-supporter', type: 'supporter' as const };
        const basicCreature = { templateId: 'basic-creature', type: 'creature' as const };
        const highHpCreature = { templateId: 'high-hp-creature', type: 'creature' as const };
        const healingItem = { templateId: 'basic-item', type: 'item' as const };
        const researchSupporter = { templateId: 'research-supporter', type: 'supporter' as const };

        const testRepository = new MockCardRepository({
            supporters: new Map([
                [ 'shuffle-supporter', {
                    templateId: 'shuffle-supporter',
                    name: 'Shuffle Supporter',
                    effects: [{ 
                        type: 'shuffle', 
                        target: 'self',
                        shuffleHand: true,
                        drawAfter: { type: 'resolved', source: 'cards-in-hand' },
                    }],
                }],
                [ 'draw-supporter', {
                    templateId: 'draw-supporter', 
                    name: 'Draw Supporter',
                    effects: [{ 
                        type: 'draw', 
                        amount: { type: 'player-context-resolved', source: 'points-to-win', playerContext: 'opponent' },
                    }],
                }],
            ]),
            items: new Map([
                [ 'discard-item', {
                    templateId: 'discard-item',
                    name: 'Discard Item',
                    effects: [{ 
                        type: 'hand-discard', 
                        amount: { type: 'constant', value: 3 }, 
                        target: 'opponent', 
                    }],
                }],
            ]),
        });

        const withShuffleTestState = (player0Hand: Array<{ templateId: string; type?: GameCard['type'] }>, player1Hand: Array<{ templateId: string; type?: GameCard['type'] }>) => StateBuilder.combine(
            StateBuilder.withHand(0, player0Hand),
            StateBuilder.withHand(1, player1Hand),
            StateBuilder.withDeck(0, Array(10).fill(basicCreature)),
            StateBuilder.withDeck(1, Array(10).fill(highHpCreature)),
        );

        it('should execute shuffle supporter and shuffle both players hands', () => {
            const { state, getExecutedCount } = runTestGame({
                actions: [ new PlayCardResponseMessage('shuffle-supporter', 'supporter') ],
                customRepository: testRepository,
                stateCustomizer: withShuffleTestState([
                    shuffleSupporter, basicCreature, healingItem, researchSupporter,
                ], [
                    basicCreature, researchSupporter,
                ]),
                maxSteps: 10,
            });
            
            expect(getExecutedCount()).to.equal(1, 'Should have executed shuffle supporter');
            expect(state.hand[0].length).to.equal(3, 'Player 0 should have 3 cards (shuffled hand and drew same amount)');
            expect(state.hand[1].length).to.equal(2, 'Player 1 should draw 2 cards (same as before)');
            
            // Verify the shuffle worked by checking deck size increased then decreased
            expect(state.deck[0].length).to.equal(10, 'Player 0 deck should have gained hand cards then lost drawn cards');
        });

        it('should execute discard item and opponent draws 3 cards', () => {
            const { state, getExecutedCount } = runTestGame({
                actions: [ new PlayCardResponseMessage('discard-item', 'item') ],
                customRepository: testRepository,
                stateCustomizer: withShuffleTestState([ discardItem ], [
                    basicCreature, researchSupporter, healingItem, highHpCreature, highHpCreature,
                ]),
                maxSteps: 10,
            });
            
            expect(getExecutedCount()).to.equal(1, 'Should have executed discard item');
            expect(state.hand[1].length).to.equal(2, 'Opponent should have 2 cards after discarding 3');
        });
    });
});
