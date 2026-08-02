import { expect } from 'chai';
import { HandlerDataBuilder } from '../../helpers/handler-data-builder.js';
import { RemoveFieldCardEffectHandler } from '../../../src/effects/handlers/remove-field-card-effect-handler.js';
import { EffectContextFactory } from '../../../src/effects/effect-context.js';
import { RemoveFieldCardEffect } from '../../../src/repository/effect-types.js';
import { MockCardRepository } from '../../mock-repository.js';
import { FieldTarget } from '../../../src/index.js';
import { runTestGame } from '../../helpers/test-helpers.js';
import { StateBuilder } from '../../helpers/state-builder.js';
import { PlayCardResponseMessage } from '../../../src/messages/response/play-card-response-message.js';

describe('Remove Field Card Effect', () => {
    describe('canApply', () => {
        const handler = new RemoveFieldCardEffectHandler();
        const mockRepository = new MockCardRepository();

        it('should return true when target creature exists', () => {
            const handlerData = HandlerDataBuilder.default(
                HandlerDataBuilder.withCreatures(0, 'basic-creature', []),
                HandlerDataBuilder.withCreatures(1, 'basic-creature', []),
            );

            const effect: RemoveFieldCardEffect = {
                type: 'remove-field-card',
                target: { type: 'fixed', player: 'opponent', position: 'active' },
                destination: 'hand',
            };

            const context = EffectContextFactory.createCardContext(0, 'Test Remove Field Card', 'item');
            const result = handler.canApply(handlerData, effect, context, mockRepository);

            expect(result).to.be.true;
        });

        it('should return false when target creature does not exist', () => {
            const handlerData = HandlerDataBuilder.default(
                HandlerDataBuilder.withCreatures(0, 'basic-creature', []),
            );

            const effect: RemoveFieldCardEffect = {
                type: 'remove-field-card',
                target: { type: 'fixed', player: 'opponent', position: 'active' },
                destination: 'hand',
            };

            const context = EffectContextFactory.createCardContext(0, 'Test Remove Field Card', 'item');
            const result = handler.canApply(handlerData, effect, context, mockRepository);

            expect(result).to.be.false;
        });

        it('should return false when no target is specified', () => {
            const handlerData = HandlerDataBuilder.default(
                HandlerDataBuilder.withCreatures(0, 'basic-creature', []),
                HandlerDataBuilder.withCreatures(1, 'basic-creature', []),
            );

            const effect: RemoveFieldCardEffect = {
                type: 'remove-field-card',
                target: undefined as unknown as FieldTarget,
                destination: 'hand',
            };

            const context = EffectContextFactory.createCardContext(0, 'Test Remove Field Card', 'item');
            const result = handler.canApply(handlerData, effect, context, mockRepository);

            expect(result).to.be.false;
        });
    });

    describe('getResolutionRequirements', () => {
        const handler = new RemoveFieldCardEffectHandler();

        it('should require target resolution', () => {
            const effect: RemoveFieldCardEffect = {
                type: 'remove-field-card',
                target: { type: 'fixed', player: 'opponent', position: 'active' },
                destination: 'hand',
            };

            const requirements = handler.getResolutionRequirements(effect);

            expect(requirements).to.have.length(1);
            expect(requirements[0].targetProperty).to.equal('target');
            expect(requirements[0].required).to.be.true;
        });
    });

    describe('apply — discard destination', () => {
        const makeDiscardRepository = () => new MockCardRepository({
            items: {
                'remove-field-card-item': {
                    templateId: 'remove-field-card-item',
                    name: 'Remove Field Card Item',
                    effects: [{
                        type: 'remove-field-card',
                        target: { type: 'fixed', player: 'opponent', position: 'active' },
                        destination: 'discard',
                    }],
                },
            },
        });

        it('should discard the opponent active creature', () => {
            const { state } = runTestGame({
                actions: [ new PlayCardResponseMessage('remove-field-card-item', 'item') ],
                customRepository: makeDiscardRepository(),
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature'),
                    StateBuilder.withCreatures(1, 'basic-creature'),
                    StateBuilder.withHand(0, [{ templateId: 'remove-field-card-item', type: 'item' }]),
                ),
            });

            // Opponent's field should be empty
            expect(state.field.creatures[1]).to.have.length(0);

            // Opponent's discard pile should contain the creature
            expect(state.discard[1]).to.have.length(1);
            expect(state.discard[1][0].type).to.equal('creature');
            expect(state.discard[1][0].templateId).to.equal('basic-creature');
        });

        it('should discard all cards in the evolution stack', () => {
            const { state } = runTestGame({
                actions: [ new PlayCardResponseMessage('remove-field-card-item', 'item') ],
                customRepository: makeDiscardRepository(),
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature'),
                    StateBuilder.withCreatures(1, 'basic-creature'),
                    StateBuilder.withHand(0, [{ templateId: 'remove-field-card-item', type: 'item' }]),
                    (st) => {
                        // Manually replace the opponent active creature with an evolved stack
                        st.field.creatures[1][0] = {
                            fieldInstanceId: 'basic-creature-1',
                            damageTaken: 0,
                            turnLastPlayed: 0,
                            evolutionStack: [
                                { instanceId: 'basic-creature-1', templateId: 'basic-creature' },
                                { instanceId: 'evolution-creature-1', templateId: 'evolution-creature' },
                            ],
                        };
                    },
                ),
            });

            // Both cards in the stack should appear in the discard pile
            expect(state.discard[1]).to.have.length(2);
            const discardedIds = state.discard[1].map(c => c.templateId).sort();
            expect(discardedIds).to.deep.equal([ 'basic-creature', 'evolution-creature' ].sort());
        });

        it('should remove all energy from the discarded creature', () => {
            const { state } = runTestGame({
                actions: [ new PlayCardResponseMessage('remove-field-card-item', 'item') ],
                customRepository: makeDiscardRepository(),
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature'),
                    StateBuilder.withCreatures(1, 'basic-creature'),
                    StateBuilder.withHand(0, [{ templateId: 'remove-field-card-item', type: 'item' }]),
                    StateBuilder.withEnergy('basic-creature-1', { fire: 2 }),
                ),
            });

            // Opponent's field should be empty
            expect(state.field.creatures[1]).to.have.length(0);

            // No energy should remain for that field instance
            const remaining = state.energy.attachedEnergyByInstance['basic-creature-1'];
            const totalEnergy = remaining
                ? Object.values(remaining).reduce((sum: number, n) => sum + (n as number), 0)
                : 0;
            expect(totalEnergy).to.equal(0);
        });

        it('should discard and detach any attached tool', () => {
            const { state } = runTestGame({
                actions: [ new PlayCardResponseMessage('remove-field-card-item', 'item') ],
                customRepository: makeDiscardRepository(),
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature'),
                    StateBuilder.withCreatures(1, 'basic-creature'),
                    StateBuilder.withHand(0, [{ templateId: 'remove-field-card-item', type: 'item' }]),
                    StateBuilder.withTool('basic-creature-1', 'test-tool'),
                ),
            });

            // No tool should remain attached to the field instance
            expect(state.tools.attachedTools['basic-creature-1']).to.be.undefined;

            // The tool should appear in the opponent's discard pile
            const discardedTools = state.discard[1].filter(c => c.type === 'tool');
            expect(discardedTools).to.have.length(1);
            expect(discardedTools[0].templateId).to.equal('test-tool');
        });
    });

    describe('apply — hand destination', () => {
        const makeHandRepository = () => new MockCardRepository({
            items: {
                'remove-field-card-to-hand': {
                    templateId: 'remove-field-card-to-hand',
                    name: 'Remove To Hand',
                    effects: [{
                        type: 'remove-field-card',
                        target: { type: 'fixed', player: 'opponent', position: 'active' },
                        destination: 'hand',
                    }],
                },
            },
        });

        it('should return the opponent active creature to their hand', () => {
            const { state } = runTestGame({
                actions: [ new PlayCardResponseMessage('remove-field-card-to-hand', 'item') ],
                customRepository: makeHandRepository(),
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature'),
                    StateBuilder.withCreatures(1, 'basic-creature'),
                    StateBuilder.withHand(0, [{ templateId: 'remove-field-card-to-hand', type: 'item' }]),
                ),
            });

            expect(state.field.creatures[1]).to.have.length(0);
            const creatureInHand = state.hand[1].filter(c => c.templateId === 'basic-creature');
            expect(creatureInHand).to.have.length(1);
            expect(creatureInHand[0].type).to.equal('creature');
        });

        it('should return all evolution stack cards to hand', () => {
            const { state } = runTestGame({
                actions: [ new PlayCardResponseMessage('remove-field-card-to-hand', 'item') ],
                customRepository: makeHandRepository(),
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature'),
                    StateBuilder.withCreatures(1, 'basic-creature'),
                    StateBuilder.withHand(0, [{ templateId: 'remove-field-card-to-hand', type: 'item' }]),
                    (st) => {
                        st.field.creatures[1][0] = {
                            fieldInstanceId: 'basic-creature-1',
                            damageTaken: 0,
                            turnLastPlayed: 0,
                            evolutionStack: [
                                { instanceId: 'basic-creature-1', templateId: 'basic-creature' },
                                { instanceId: 'evolution-creature-1', templateId: 'evolution-creature' },
                            ],
                        };
                    },
                ),
            });

            expect(state.field.creatures[1]).to.have.length(0);
            const handTemplates = state.hand[1].map(c => c.templateId);
            expect(handTemplates).to.include('basic-creature');
            expect(handTemplates).to.include('evolution-creature');
        });

        it('should discard energy and detach tool when returning to hand', () => {
            const { state } = runTestGame({
                actions: [ new PlayCardResponseMessage('remove-field-card-to-hand', 'item') ],
                customRepository: makeHandRepository(),
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature'),
                    StateBuilder.withCreatures(1, 'basic-creature'),
                    StateBuilder.withHand(0, [{ templateId: 'remove-field-card-to-hand', type: 'item' }]),
                    StateBuilder.withEnergy('basic-creature-1', { fire: 1 }),
                    StateBuilder.withTool('basic-creature-1', 'test-tool'),
                ),
            });

            const remaining = state.energy.attachedEnergyByInstance['basic-creature-1'];
            const totalEnergy = remaining
                ? Object.values(remaining).reduce((sum: number, n) => sum + (n as number), 0)
                : 0;
            expect(totalEnergy).to.equal(0);
            expect(state.tools.attachedTools['basic-creature-1']).to.be.undefined;
            const discardedTools = state.discard[1].filter(c => c.type === 'tool');
            expect(discardedTools).to.have.length(1);
        });
    });

    describe('apply — deck destination', () => {
        const makeDeckRepository = () => new MockCardRepository({
            items: {
                'remove-field-card-to-deck': {
                    templateId: 'remove-field-card-to-deck',
                    name: 'Remove To Deck',
                    effects: [{
                        type: 'remove-field-card',
                        target: { type: 'fixed', player: 'opponent', position: 'active' },
                        destination: 'deck',
                    }],
                },
            },
        });

        it('should shuffle the opponent active creature into their deck', () => {
            const { state } = runTestGame({
                actions: [ new PlayCardResponseMessage('remove-field-card-to-deck', 'item') ],
                customRepository: makeDeckRepository(),
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature'),
                    StateBuilder.withCreatures(1, 'basic-creature'),
                    StateBuilder.withHand(0, [{ templateId: 'remove-field-card-to-deck', type: 'item' }]),
                ),
            });

            expect(state.field.creatures[1]).to.have.length(0);
            const creatureInDeck = state.deck[1].filter(c => c.templateId === 'basic-creature');
            expect(creatureInDeck).to.have.length(1);
            expect(creatureInDeck[0].type).to.equal('creature');
        });

        it('should shuffle all evolution stack cards into the deck', () => {
            const { state } = runTestGame({
                actions: [ new PlayCardResponseMessage('remove-field-card-to-deck', 'item') ],
                customRepository: makeDeckRepository(),
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature'),
                    StateBuilder.withCreatures(1, 'basic-creature'),
                    StateBuilder.withHand(0, [{ templateId: 'remove-field-card-to-deck', type: 'item' }]),
                    (st) => {
                        st.field.creatures[1][0] = {
                            fieldInstanceId: 'basic-creature-1',
                            damageTaken: 0,
                            turnLastPlayed: 0,
                            evolutionStack: [
                                { instanceId: 'basic-creature-1', templateId: 'basic-creature' },
                                { instanceId: 'evolution-creature-1', templateId: 'evolution-creature' },
                            ],
                        };
                    },
                ),
            });

            expect(state.field.creatures[1]).to.have.length(0);
            const deckTemplates = state.deck[1].map(c => c.templateId);
            expect(deckTemplates).to.include('basic-creature');
            expect(deckTemplates).to.include('evolution-creature');
        });

        it('should discard energy and detach tool when shuffling into deck', () => {
            const { state } = runTestGame({
                actions: [ new PlayCardResponseMessage('remove-field-card-to-deck', 'item') ],
                customRepository: makeDeckRepository(),
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature'),
                    StateBuilder.withCreatures(1, 'basic-creature'),
                    StateBuilder.withHand(0, [{ templateId: 'remove-field-card-to-deck', type: 'item' }]),
                    StateBuilder.withEnergy('basic-creature-1', { fire: 1 }),
                    StateBuilder.withTool('basic-creature-1', 'test-tool'),
                ),
            });

            const remaining = state.energy.attachedEnergyByInstance['basic-creature-1'];
            const totalEnergy = remaining
                ? Object.values(remaining).reduce((sum: number, n) => sum + (n as number), 0)
                : 0;
            expect(totalEnergy).to.equal(0);
            expect(state.tools.attachedTools['basic-creature-1']).to.be.undefined;
            const discardedTools = state.discard[1].filter(c => c.type === 'tool');
            expect(discardedTools).to.have.length(1);
        });
    });
});
