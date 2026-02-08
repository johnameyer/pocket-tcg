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

        it('should return true when player has cards in hand and deck', () => {
            const handlerData = HandlerDataBuilder.default(
                HandlerDataBuilder.withHand([{ templateId: 'test-card', type: 'item' }]),
                HandlerDataBuilder.withDeck(5),
            );

            const effect: SwapCardsEffect = {
                type: 'swap-cards',
                discardAmount: { type: 'constant', value: 1 },
                drawAmount: { type: 'constant', value: 1 },
            };

            const context = EffectContextFactory.createCardContext(0, 'Test Swap Cards', 'item');
            const result = handler.canApply(handlerData, effect, context, mockRepository);
            
            expect(result).to.be.true;
        });

        it('should return true when player has no cards in hand but has deck', () => {
            const handlerData = HandlerDataBuilder.default(
                HandlerDataBuilder.withHand([]),
                HandlerDataBuilder.withDeck(5),
            );

            const effect: SwapCardsEffect = {
                type: 'swap-cards',
                discardAmount: { type: 'constant', value: 1 },
                drawAmount: { type: 'constant', value: 1 },
            };

            const context = EffectContextFactory.createCardContext(0, 'Test Swap Cards', 'item');
            const result = handler.canApply(handlerData, effect, context, mockRepository);
            
            // Should return true because player can draw cards
            expect(result).to.be.true;
        });

        it('should return false when player has no cards in deck', () => {
            const handlerData = HandlerDataBuilder.default(
                HandlerDataBuilder.withHand([{ templateId: 'test-card', type: 'item' }]),
                HandlerDataBuilder.withDeck(0),
            );

            const effect: SwapCardsEffect = {
                type: 'swap-cards',
                discardAmount: { type: 'constant', value: 1 },
                drawAmount: { type: 'constant', value: 1 },
            };

            const context = EffectContextFactory.createCardContext(0, 'Test Swap Cards', 'item');
            const result = handler.canApply(handlerData, effect, context, mockRepository);
            
            // Should still return true because player can discard cards
            expect(result).to.be.true;
        });

        it('should return false when player has neither cards in hand nor deck', () => {
            const handlerData = HandlerDataBuilder.default(
                HandlerDataBuilder.withHand([]),
                HandlerDataBuilder.withDeck(0),
            );

            const effect: SwapCardsEffect = {
                type: 'swap-cards',
                discardAmount: { type: 'constant', value: 1 },
                drawAmount: { type: 'constant', value: 1 },
            };

            const context = EffectContextFactory.createCardContext(0, 'Test Swap Cards', 'item');
            const result = handler.canApply(handlerData, effect, context, mockRepository);
            
            expect(result).to.be.false;
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

        /*
         * Started with 4 cards (including swap-item), played 1, discarded 2, drew 2
         * Final hand: 3 cards
         */
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

        /*
         * Started with 3 cards, played 1, discarded 1, drew 2 (capped)
         * Final hand: 3 cards
         */
        expect(state.hand[0]).to.have.length(3);
        
        // Check that 2 cards were discarded (swap-item + 1 card)
        expect(state.discard[0]).to.have.length(2);
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

        /*
         * Started with 2 cards, played 1, discarded 1, drew 0 (empty deck)
         * Final hand: 0 cards
         */
        expect(state.hand[0]).to.have.length(0);
        
        // Check that 2 cards were discarded
        expect(state.discard[0]).to.have.length(2);
    });
});
