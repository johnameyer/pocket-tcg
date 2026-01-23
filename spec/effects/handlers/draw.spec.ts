import { expect } from 'chai';
import { runTestGame } from '../../helpers/test-helpers.js';
import { StateBuilder } from '../../helpers/state-builder.js';
import { PlayCardResponseMessage } from '../../../src/messages/response/play-card-response-message.js';
import { MockCardRepository } from '../../mock-repository.js';
import { SupporterData } from '../../../src/repository/card-types.js';
import { DrawEffectHandler } from '../../../src/effects/handlers/draw-effect-handler.js';
import { EffectContextFactory } from '../../../src/effects/effect-context.js';
import { DrawEffect } from '../../../src/repository/effect-types.js';
import { HandlerDataBuilder } from '../../helpers/handler-data-builder.js';

describe('Draw Effect', () => {
    describe('canApply', () => {
        const handler = new DrawEffectHandler();

        it('should return true when deck has cards', () => {
            const handlerData = HandlerDataBuilder.default(
                HandlerDataBuilder.withDeck(10)
            );

            const effect: DrawEffect = {
                type: 'draw',
                amount: { type: 'constant', value: 3 }
            };

            const context = EffectContextFactory.createCardContext(0, 'Test Draw', 'item');
            const result = handler.canApply(handlerData, effect, context);
            
            expect(result).to.be.true;
        });

        it('should return false when deck is empty', () => {
            const handlerData = HandlerDataBuilder.default(
                HandlerDataBuilder.withDeck(0)
            );

            const effect: DrawEffect = {
                type: 'draw',
                amount: { type: 'constant', value: 3 }
            };

            const context = EffectContextFactory.createCardContext(0, 'Test Draw', 'item');
            const result = handler.canApply(handlerData, effect, context);
            
            expect(result).to.be.false;
        });
    });

    it('should draw 2 cards (basic amount)', () => {
        const testRepository = new MockCardRepository({
            supporters: new Map<string, SupporterData>([
                ['draw-supporter', {
                    templateId: 'draw-supporter',
                    name: 'Draw Supporter',
                    effects: [{ type: 'draw', amount: { type: 'constant', value: 2 } }]
                }]
            ])
        });

        const { state } = runTestGame({
            actions: [new PlayCardResponseMessage('draw-supporter', 'supporter')],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withHand(0, [{ templateId: 'draw-supporter', type: 'supporter' }]),
                StateBuilder.withDeck(0, Array(5).fill({ templateId: 'basic-creature', type: 'creature' }))
            ),
            maxSteps: 10
        });

        expect(state.hand[0].length).to.equal(2, 'Should draw 2 cards');
        expect(state.deck[0].length).to.equal(3, 'Should have 3 cards left');
    });

    it('should draw different amounts (4 cards)', () => {
        const testRepository = new MockCardRepository({
            supporters: new Map<string, SupporterData>([
                ['big-draw', {
                    templateId: 'big-draw',
                    name: 'Big Draw',
                    effects: [{ type: 'draw', amount: { type: 'constant', value: 4 } }]
                }]
            ])
        });

        const { state } = runTestGame({
            actions: [new PlayCardResponseMessage('big-draw', 'supporter')],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withHand(0, [{ templateId: 'big-draw', type: 'supporter' }]),
                StateBuilder.withDeck(0, Array(10).fill({ templateId: 'basic-creature', type: 'creature' }))
            ),
            maxSteps: 10
        });

        expect(state.hand[0].length).to.equal(4, 'Should draw 4 cards');
    });

    it('should draw limited by deck size', () => {
        const testRepository = new MockCardRepository({
            supporters: new Map<string, SupporterData>([
                ['big-draw', {
                    templateId: 'big-draw',
                    name: 'Big Draw',
                    effects: [{ type: 'draw', amount: { type: 'constant', value: 5 } }]
                }]
            ])
        });

        const { state } = runTestGame({
            actions: [new PlayCardResponseMessage('big-draw', 'supporter')],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withHand(0, [{ templateId: 'big-draw', type: 'supporter' }]),
                StateBuilder.withDeck(0, Array(2).fill({ templateId: 'basic-creature', type: 'creature' }))
            ),
            maxSteps: 10
        });

        expect(state.hand[0].length).to.equal(2, 'Should draw only available cards');
        expect(state.deck[0].length).to.equal(0, 'Deck should be empty');
    });

    it('should handle empty deck', () => {
        const testRepository = new MockCardRepository({
            supporters: new Map<string, SupporterData>([
                ['draw-supporter', {
                    templateId: 'draw-supporter',
                    name: 'Draw Supporter',
                    effects: [{ type: 'draw', amount: { type: 'constant', value: 2 } }]
                }]
            ])
        });

        const { state } = runTestGame({
            actions: [new PlayCardResponseMessage('draw-supporter', 'supporter')],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withHand(0, [{ templateId: 'draw-supporter', type: 'supporter' }]),
                StateBuilder.withDeck(0, [])
            ),
            maxSteps: 10
        });

        expect(state.hand[0].length).to.equal(1, 'Card should remain in hand when draw is blocked due to empty deck');
    });

    it('should draw based on context (hand size)', () => {
        const testRepository = new MockCardRepository({
            supporters: new Map<string, SupporterData>([
                ['context-draw', {
                    templateId: 'context-draw',
                    name: 'Context Draw',
                    effects: [{
                        type: 'draw',
                        amount: { type: 'player-context-resolved', source: 'hand-size', playerContext: 'self' }
                    }]
                }]
            ])
        });

        const { state } = runTestGame({
            actions: [new PlayCardResponseMessage('context-draw', 'supporter')],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withHand(0, [
                    { templateId: 'context-draw', type: 'supporter' },
                    { templateId: 'basic-creature', type: 'creature' },
                    { templateId: 'basic-creature', type: 'creature' }
                ]),
                StateBuilder.withDeck(0, Array(10).fill({ templateId: 'basic-creature', type: 'creature' }))
            ),
            maxSteps: 10
        });

        expect(state.hand[0].length).to.equal(4, 'Should draw 2 cards (hand size after playing) + 2 existing');
    });
});
