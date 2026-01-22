import { expect } from 'chai';
import { runTestGame } from '../../helpers/test-helpers.js';
import { StateBuilder } from '../../helpers/state-builder.js';
import { PlayCardResponseMessage } from '../../../src/messages/response/play-card-response-message.js';
import { createSupporterRepo, createCardArray } from '../../helpers/test-utils.js';

describe('Draw Effect', () => {
    it('should draw 2 cards (basic amount)', () => {
        const testRepository = createSupporterRepo('draw-supporter', 'Draw Supporter',
            [{ type: 'draw', amount: { type: 'constant', value: 2 } }]);

        const { state } = runTestGame({
            actions: [new PlayCardResponseMessage('draw-supporter', 'supporter')],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withHand(0, [{ templateId: 'draw-supporter', type: 'supporter' }]),
                StateBuilder.withDeck(0, createCardArray(5, 'basic-creature'))
            ),
            maxSteps: 10
        });

        expect(state.hand[0].length).to.equal(2, 'Should draw 2 cards');
        expect(state.deck[0].length).to.equal(3, 'Should have 3 cards left');
    });

    it('should draw different amounts (4 cards)', () => {
        const testRepository = createSupporterRepo('big-draw', 'Big Draw',
            [{ type: 'draw', amount: { type: 'constant', value: 4 } }]);

        const { state } = runTestGame({
            actions: [new PlayCardResponseMessage('big-draw', 'supporter')],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withHand(0, [{ templateId: 'big-draw', type: 'supporter' }]),
                StateBuilder.withDeck(0, createCardArray(10, 'basic-creature'))
            ),
            maxSteps: 10
        });

        expect(state.hand[0].length).to.equal(4, 'Should draw 4 cards');
    });

    it('should draw limited by deck size', () => {
        const testRepository = createSupporterRepo('big-draw', 'Big Draw',
            [{ type: 'draw', amount: { type: 'constant', value: 5 } }]);

        const { state } = runTestGame({
            actions: [new PlayCardResponseMessage('big-draw', 'supporter')],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withHand(0, [{ templateId: 'big-draw', type: 'supporter' }]),
                StateBuilder.withDeck(0, createCardArray(2, 'basic-creature'))
            ),
            maxSteps: 10
        });

        expect(state.hand[0].length).to.equal(2, 'Should draw only available cards');
        expect(state.deck[0].length).to.equal(0, 'Deck should be empty');
    });

    it('should handle empty deck', () => {
        const testRepository = createSupporterRepo('draw-supporter', 'Draw Supporter',
            [{ type: 'draw', amount: { type: 'constant', value: 2 } }]);

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
        const testRepository = createSupporterRepo('context-draw', 'Context Draw', [{
            type: 'draw',
            amount: { type: 'player-context-resolved', source: 'hand-size', playerContext: 'self' }
        }]);

        const { state } = runTestGame({
            actions: [new PlayCardResponseMessage('context-draw', 'supporter')],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withHand(0, [
                    { templateId: 'context-draw', type: 'supporter' },
                    { templateId: 'basic-creature', type: 'creature' },
                    { templateId: 'basic-creature', type: 'creature' }
                ]),
                StateBuilder.withDeck(0, createCardArray(10, 'basic-creature'))
            ),
            maxSteps: 10
        });

        expect(state.hand[0].length).to.equal(4, 'Should draw 2 cards (hand size after playing) + 2 existing');
    });
});
