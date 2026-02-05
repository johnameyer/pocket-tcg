import { expect } from 'chai';
import { runTestGame } from '../../helpers/test-helpers.js';
import { StateBuilder } from '../../helpers/state-builder.js';
import { PlayCardResponseMessage } from '../../../src/messages/response/play-card-response-message.js';
import { MockCardRepository } from '../../mock-repository.js';
import { SupporterData } from '../../../src/repository/card-types.js';
import { SearchEffectHandler } from '../../../src/effects/handlers/search-effect-handler.js';
import { EffectContextFactory } from '../../../src/effects/effect-context.js';
import { SearchEffect } from '../../../src/repository/effect-types.js';
import { HandlerDataBuilder } from '../../helpers/handler-data-builder.js';

describe('CardTargetResolver (via SearchEffectHandler)', () => {
    describe('canApply', () => {
        const handler = new SearchEffectHandler();
        const mockRepository = new MockCardRepository();

        it('should return true when deck has cards for fixed deck search', () => {
            const handlerData = HandlerDataBuilder.default(
                HandlerDataBuilder.withDeck(10),
            );

            const effect: SearchEffect = {
                type: 'search',
                source: { type: 'fixed', player: 'self', location: 'deck' },
                amount: { type: 'constant', value: 1 },
                destination: 'hand',
            };

            const context = EffectContextFactory.createCardContext(0, 'Test Search', 'item');
            const result = handler.canApply(handlerData, effect, context, mockRepository);
            
            expect(result).to.be.true;
        });

        it('should return false for item when deck is empty', () => {
            const handlerData = HandlerDataBuilder.default(
                HandlerDataBuilder.withDeck(0),
            );

            const effect: SearchEffect = {
                type: 'search',
                source: { type: 'fixed', player: 'self', location: 'deck' },
                amount: { type: 'constant', value: 1 },
                destination: 'hand',
            };

            const context = EffectContextFactory.createCardContext(0, 'Test Search', 'item');
            const result = handler.canApply(handlerData, effect, context, mockRepository);
            
            expect(result).to.be.false;
        });

        it('should return false for supporter when deck is empty', () => {
            const handlerData = HandlerDataBuilder.default(
                HandlerDataBuilder.withDeck(0),
            );

            const effect: SearchEffect = {
                type: 'search',
                source: { type: 'fixed', player: 'self', location: 'deck' },
                amount: { type: 'constant', value: 1 },
                destination: 'hand',
            };

            const context = EffectContextFactory.createCardContext(0, 'Test Search', 'supporter');
            const result = handler.canApply(handlerData, effect, context, mockRepository);
            
            expect(result).to.be.false;
        });
    });

    describe('resolve with fixed target', () => {
        it('should search deck for cards', () => {
            const testRepository = new MockCardRepository({
                supporters: new Map<string, SupporterData>([
                    [ 'search-supporter', {
                        templateId: 'search-supporter',
                        name: 'Search Supporter',
                        effects: [{
                            type: 'search',
                            source: { type: 'fixed', player: 'self', location: 'deck' },
                            amount: { type: 'constant', value: 1 },
                            destination: 'hand',
                        }],
                    }],
                ]),
            });

            const { state } = runTestGame({
                actions: [ new PlayCardResponseMessage('search-supporter', 'supporter') ],
                customRepository: testRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withHand(0, [{ templateId: 'search-supporter', type: 'supporter' }]),
                    StateBuilder.withDeck(0, Array(5).fill({ templateId: 'basic-creature', type: 'creature' })),
                ),
                maxSteps: 10,
            });

            expect(state.hand[0].length).to.equal(1, 'Should have searched 1 card from deck');
            expect(state.deck[0].length).to.equal(4, 'Should have 4 cards left in deck');
        });

        it('should handle multiple card search', () => {
            const testRepository = new MockCardRepository({
                supporters: new Map<string, SupporterData>([
                    [ 'multi-search-supporter', {
                        templateId: 'multi-search-supporter',
                        name: 'Multi Search Supporter',
                        effects: [{
                            type: 'search',
                            source: { type: 'fixed', player: 'self', location: 'deck' },
                            amount: { type: 'constant', value: 2 },
                            destination: 'hand',
                        }],
                    }],
                ]),
            });

            const { state } = runTestGame({
                actions: [ new PlayCardResponseMessage('multi-search-supporter', 'supporter') ],
                customRepository: testRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withHand(0, [{ templateId: 'multi-search-supporter', type: 'supporter' }]),
                    StateBuilder.withDeck(0, Array(5).fill({ templateId: 'basic-creature', type: 'creature' })),
                ),
                maxSteps: 10,
            });

            expect(state.hand[0].length).to.equal(2, 'Should have searched 2 cards from deck');
            expect(state.deck[0].length).to.equal(3, 'Should have 3 cards left in deck');
        });

        it('should limit search to available cards', () => {
            const testRepository = new MockCardRepository({
                supporters: new Map<string, SupporterData>([
                    [ 'greedy-search', {
                        templateId: 'greedy-search',
                        name: 'Greedy Search',
                        effects: [{
                            type: 'search',
                            source: { type: 'fixed', player: 'self', location: 'deck' },
                            amount: { type: 'constant', value: 10 },
                            destination: 'hand',
                        }],
                    }],
                ]),
            });

            const { state } = runTestGame({
                actions: [ new PlayCardResponseMessage('greedy-search', 'supporter') ],
                customRepository: testRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withHand(0, [{ templateId: 'greedy-search', type: 'supporter' }]),
                    StateBuilder.withDeck(0, Array(3).fill({ templateId: 'basic-creature', type: 'creature' })),
                ),
                maxSteps: 10,
            });

            expect(state.hand[0].length).to.equal(3, 'Should have searched only 3 available cards');
            expect(state.deck[0].length).to.equal(0, 'Deck should be empty');
        });
    });
});
