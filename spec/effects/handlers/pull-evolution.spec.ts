import { expect } from 'chai';
import { HandlerDataBuilder } from '../../helpers/handler-data-builder.js';
import { PullEvolutionEffectHandler } from '../../../src/effects/handlers/pull-evolution-effect-handler.js';
import { EffectContextFactory } from '../../../src/effects/effect-context.js';
import { PullEvolutionEffect } from '../../../src/repository/effect-types.js';
import { MockCardRepository } from '../../mock-repository.js';
import { FieldTarget } from '../../../src/index.js';
import { PlayCardResponseMessage } from '../../../src/messages/response/play-card-response-message.js';
import { runTestGame } from '../../helpers/test-helpers.js';
import { StateBuilder } from '../../helpers/state-builder.js';
import { getCurrentTemplateId } from '../../../src/utils/field-card-utils.js';

describe('Pull Evolution Effect', () => {
    describe('canApply', () => {
        const handler = new PullEvolutionEffectHandler();
        const mockRepository = new MockCardRepository();

        it('should return true when target creature exists', () => {
            const handlerData = HandlerDataBuilder.default(
                HandlerDataBuilder.withCreatures(0, 'basic-creature', []),
                HandlerDataBuilder.withCreatures(1, 'basic-creature', []),
            );

            const effect: PullEvolutionEffect = {
                type: 'pull-evolution',
                target: { type: 'fixed', player: 'self', position: 'active' },
                evolutionCriteria: { cardType: 'creature', stage: 2 },
            };

            const context = EffectContextFactory.createCardContext(0, 'Test Pull Evolution', 'item');
            const result = handler.canApply(handlerData, effect, context, mockRepository);
            
            expect(result).to.be.true;
        });

        it('should return false when target creature does not exist', () => {
            const handlerData = HandlerDataBuilder.default(
                HandlerDataBuilder.withCreatures(1, 'basic-creature', []),
            );

            const effect: PullEvolutionEffect = {
                type: 'pull-evolution',
                target: { type: 'fixed', player: 'self', position: 'active' },
            };

            const context = EffectContextFactory.createCardContext(0, 'Test Pull Evolution', 'item');
            const result = handler.canApply(handlerData, effect, context, mockRepository);
            
            expect(result).to.be.false;
        });

        it('should return false when no target is specified', () => {
            const handlerData = HandlerDataBuilder.default(
                HandlerDataBuilder.withCreatures(0, 'basic-creature', []),
            );

            const effect: PullEvolutionEffect = {
                type: 'pull-evolution',
                target: undefined as unknown as FieldTarget,
            };

            const context = EffectContextFactory.createCardContext(0, 'Test Pull Evolution', 'item');
            const result = handler.canApply(handlerData, effect, context, mockRepository);
            
            expect(result).to.be.false;
        });

        it('should return false when restricted to notFirstTurn on first turn', () => {
            const handlerData = HandlerDataBuilder.default(
                HandlerDataBuilder.withCreatures(0, 'basic-creature', []),
                HandlerDataBuilder.withEnergyState([ null, null ], true),
                HandlerDataBuilder.withTurnNumber(1),
            );

            const effect: PullEvolutionEffect = {
                type: 'pull-evolution',
                target: { type: 'fixed', player: 'self', position: 'active' },
                restrictions: { notFirstTurn: true },
            };

            const context = EffectContextFactory.createCardContext(0, 'Test Pull Evolution', 'item');
            const result = handler.canApply(handlerData, effect, context, mockRepository);
            expect(result).to.be.false;
        });
    });

    describe('getResolutionRequirements', () => {
        const handler = new PullEvolutionEffectHandler();

        it('should require target resolution', () => {
            const effect: PullEvolutionEffect = {
                type: 'pull-evolution',
                target: { type: 'fixed', player: 'self', position: 'active' },
            };

            const requirements = handler.getResolutionRequirements(effect);
            
            expect(requirements).to.have.length(1);
            expect(requirements[0].targetProperty).to.equal('target');
            expect(requirements[0].required).to.be.true;
        });
    });

    describe('apply', () => {
        const testRepository = new MockCardRepository({
            items: {
                'pull-item': {
                    templateId: 'pull-item',
                    name: 'Pull Item',
                    effects: [{
                        type: 'pull-evolution',
                        target: {
                            type: 'single-choice',
                            chooser: 'self',
                            criteria: { player: 'self', location: 'field' },
                        },
                    }],
                },
                'pull-item-not-played-this-turn': {
                    templateId: 'pull-item-not-played-this-turn',
                    name: 'Pull Item Not Played This Turn',
                    effects: [{
                        type: 'pull-evolution',
                        target: {
                            type: 'single-choice',
                            chooser: 'self',
                            criteria: { player: 'self', location: 'field' },
                        },
                        restrictions: { notPlayedThisTurn: true },
                    }],
                },
            },
        });

        it('should evolve target and remove evolution card from deck', () => {
            const { state, getExecutedCount } = runTestGame({
                actions: [
                    new PlayCardResponseMessage('pull-item', 'item'),
                ],
                customRepository: testRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature', []),
                    StateBuilder.withCreatures(1, 'basic-creature', []),
                    StateBuilder.withHand(0, [{ templateId: 'pull-item', type: 'item' }]),
                    StateBuilder.withDeck(0, [{ templateId: 'evolution-creature', type: 'creature' }]),
                ),
            });

            expect(getExecutedCount()).to.equal(1, 'Should play item');
            expect(getCurrentTemplateId(state.field.creatures[0][0])).to.equal('evolution-creature', 'Target should evolve from deck card');
            expect(state.deck[0]).to.have.length(0, 'Evolution card should be removed from deck');
        });

        it('should not evolve target when restricted by notPlayedThisTurn', () => {
            const { state, getExecutedCount } = runTestGame({
                actions: [
                    new PlayCardResponseMessage('pull-item-not-played-this-turn', 'item'),
                ],
                customRepository: testRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature', []),
                    StateBuilder.withCreatures(1, 'basic-creature', []),
                    StateBuilder.withHand(0, [{ templateId: 'pull-item-not-played-this-turn', type: 'item' }]),
                    StateBuilder.withDeck(0, [{ templateId: 'evolution-creature', type: 'creature' }]),
                    StateBuilder.withTurnNumber(3),
                    (gameState) => {
                        gameState.field.creatures[0][0].turnLastPlayed = 3;
                    },
                ),
            });

            expect(getExecutedCount()).to.equal(1, 'Item play resolves');
            expect(getCurrentTemplateId(state.field.creatures[0][0])).to.equal('basic-creature', 'Target should not evolve when played this turn');
            expect(state.deck[0]).to.have.length(1, 'Deck should remain unchanged when evolution is blocked');
        });
    });
});
