import { expect } from 'chai';
import { runTestGame } from '../../helpers/test-helpers.js';
import { StateBuilder } from '../../helpers/state-builder.js';
import { MockCardRepository } from '../../mock-repository.js';
import { PlayCardResponseMessage } from '../../../src/messages/response/play-card-response-message.js';
import { HandlerDataBuilder } from '../../helpers/handler-data-builder.js';
import { SwapCardsEffectHandler } from '../../../src/effects/handlers/swap-cards-effect-handler.js';
import { EffectContextFactory } from '../../../src/effects/effect-context.js';
import { SwapCardsEffect } from '../../../src/repository/effect-types.js';

describe('Swap Cards Effect', () => {
    describe('canApply', () => {
        const handler = new SwapCardsEffectHandler();
        const mockRepository = new MockCardRepository();

        it('should return true when player has cards in hand', () => {
            const handlerData = HandlerDataBuilder.default(
                HandlerDataBuilder.withHand([{ templateId: 'test-card', type: 'item' }]),
            );

            const effect: SwapCardsEffect = {
                type: 'swap-cards',
                discardAmount: { type: 'constant', value: 1 },
                drawAmount: { type: 'constant', value: 1 },
                target: 'self',
            };

            const context = EffectContextFactory.createCardContext(0, 'Test Swap Cards', 'item');
            const result = handler.canApply(handlerData, effect, context, mockRepository);
            
            expect(result).to.be.true;
        });

        it('should return true even when player has no cards in hand', () => {
            const handlerData = HandlerDataBuilder.default(
                HandlerDataBuilder.withHand([]),
            );

            const effect: SwapCardsEffect = {
                type: 'swap-cards',
                discardAmount: { type: 'constant', value: 1 },
                drawAmount: { type: 'constant', value: 1 },
                target: 'self',
            };

            const context = EffectContextFactory.createCardContext(0, 'Test Swap Cards', 'item');
            const result = handler.canApply(handlerData, effect, context, mockRepository);
            
            expect(result).to.be.true;
        });
    });

    it('should discard and draw equal amounts', () => {
        const testRepository = new MockCardRepository({
            items: new Map([
                [ 'swap-item', {
                    templateId: 'swap-item',
                    name: 'Swap Item',
                    effects: [{
                        type: 'swap-cards',
                        discardAmount: { type: 'constant', value: 2 },
                        drawAmount: { type: 'constant', value: 2 },
                        target: 'self',
                    }],
                }],
            ]),
        });

        const { state } = runTestGame({
            actions: [ new PlayCardResponseMessage('swap-item', 'item') ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature'),
                StateBuilder.withCreatures(1, 'basic-creature'),
                StateBuilder.withHand(0, [
                    { templateId: 'swap-item', type: 'item' },
                    { templateId: 'basic-creature', type: 'creature' },
                    { templateId: 'basic-creature', type: 'creature' },
                    { templateId: 'basic-creature', type: 'creature' },
                ]),
                StateBuilder.withDeck(0, Array(5).fill({ templateId: 'basic-creature', type: 'creature' })),
            ),
        });

        // Started with 4 cards (including swap-item), played 1, discarded 2, drew 2
        // Final hand: 3 cards
        expect(state.hand[0]).to.have.length(3);
        
        // Check that 3 cards were discarded (swap-item + 2 cards)
        expect(state.discard[0]).to.have.length(3);
    });

    it('should respect maxDrawn cap', () => {
        const testRepository = new MockCardRepository({
            items: new Map([
                [ 'capped-swap-item', {
                    templateId: 'capped-swap-item',
                    name: 'Capped Swap Item',
                    effects: [{
                        type: 'swap-cards',
                        discardAmount: { type: 'constant', value: 1 },
                        drawAmount: { type: 'constant', value: 5 },
                        maxDrawn: 2,
                        target: 'self',
                    }],
                }],
            ]),
        });

        const { state } = runTestGame({
            actions: [ new PlayCardResponseMessage('capped-swap-item', 'item') ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature'),
                StateBuilder.withCreatures(1, 'basic-creature'),
                StateBuilder.withHand(0, [
                    { templateId: 'capped-swap-item', type: 'item' },
                    { templateId: 'basic-creature', type: 'creature' },
                    { templateId: 'basic-creature', type: 'creature' },
                ]),
                StateBuilder.withDeck(0, Array(5).fill({ templateId: 'basic-creature', type: 'creature' })),
            ),
        });

        // Started with 3 cards, played 1, discarded 1, drew 2 (capped)
        // Final hand: 3 cards
        expect(state.hand[0]).to.have.length(3);
        
        // Check that 2 cards were discarded (swap-item + 1 card)
        expect(state.discard[0]).to.have.length(2);
    });

    it('should target opponent player', () => {
        const testRepository = new MockCardRepository({
            items: new Map([
                [ 'disruptive-swap-item', {
                    templateId: 'disruptive-swap-item',
                    name: 'Disruptive Swap',
                    effects: [{
                        type: 'swap-cards',
                        discardAmount: { type: 'constant', value: 2 },
                        drawAmount: { type: 'constant', value: 1 },
                        target: 'opponent',
                    }],
                }],
            ]),
        });

        const { state } = runTestGame({
            actions: [ new PlayCardResponseMessage('disruptive-swap-item', 'item') ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature'),
                StateBuilder.withCreatures(1, 'basic-creature'),
                StateBuilder.withHand(0, [{ templateId: 'disruptive-swap-item', type: 'item' }]),
                StateBuilder.withHand(1, [
                    { templateId: 'basic-creature', type: 'creature' },
                    { templateId: 'basic-creature', type: 'creature' },
                    { templateId: 'basic-creature', type: 'creature' },
                ]),
                StateBuilder.withDeck(1, Array(5).fill({ templateId: 'basic-creature', type: 'creature' })),
            ),
        });

        // Opponent started with 3 cards, discarded 2, drew 1
        // Opponent final hand: 2 cards
        expect(state.hand[1]).to.have.length(2);
        
        // Check that opponent discarded 2 cards
        expect(state.discard[1]).to.have.length(2);
    });

    it('should handle empty deck scenario (no draws)', () => {
        const testRepository = new MockCardRepository({
            items: new Map([
                [ 'swap-item', {
                    templateId: 'swap-item',
                    name: 'Swap Item',
                    effects: [{
                        type: 'swap-cards',
                        discardAmount: { type: 'constant', value: 1 },
                        drawAmount: { type: 'constant', value: 3 },
                        target: 'self',
                    }],
                }],
            ]),
        });

        const { state } = runTestGame({
            actions: [ new PlayCardResponseMessage('swap-item', 'item') ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature'),
                StateBuilder.withCreatures(1, 'basic-creature'),
                StateBuilder.withHand(0, [
                    { templateId: 'swap-item', type: 'item' },
                    { templateId: 'basic-creature', type: 'creature' },
                ]),
                StateBuilder.withDeck(0, []), // Empty deck
            ),
        });

        // Started with 2 cards, played 1, discarded 1, drew 0 (empty deck)
        // Final hand: 0 cards
        expect(state.hand[0]).to.have.length(0);
        
        // Check that 2 cards were discarded
        expect(state.discard[0]).to.have.length(2);
    });
});
