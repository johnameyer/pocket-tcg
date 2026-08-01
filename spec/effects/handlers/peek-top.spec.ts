import { expect } from 'chai';
import { PlayCardResponseMessage } from '../../../src/messages/response/play-card-response-message.js';
import { EvolveResponseMessage } from '../../../src/messages/response/evolve-response-message.js';
import { StateBuilder } from '../../helpers/state-builder.js';
import { runTestGame } from '../../helpers/test-helpers.js';
import { MockCardRepository } from '../../mock-repository.js';
import { PeekTopEffectHandler } from '../../../src/effects/handlers/peek-top-effect-handler.js';
import { EffectContextFactory } from '../../../src/effects/effect-context.js';
import { PeekTopEffect } from '../../../src/repository/effect-types.js';
import { HandlerDataBuilder } from '../../helpers/handler-data-builder.js';

describe('Peek Top Effect', () => {
    describe('canApply', () => {
        const handler = new PeekTopEffectHandler();

        const effect: PeekTopEffect = {
            type: 'peek-top',
            n: 4,
            criteria: { cardType: 'item' },
            destination: 'hand',
        };

        it('should return true when deck has cards', () => {
            const handlerData = HandlerDataBuilder.default(HandlerDataBuilder.withDeck(5));
            const context = EffectContextFactory.createCardContext(0, 'Test Peek', 'supporter');
            expect(handler.canApply(handlerData, effect, context)).to.be.true;
        });

        it('should return false when deck is empty', () => {
            const handlerData = HandlerDataBuilder.default(HandlerDataBuilder.withDeck(0));
            const context = EffectContextFactory.createCardContext(0, 'Test Peek', 'supporter');
            expect(handler.canApply(handlerData, effect, context)).to.be.false;
        });
    });

    const basicCreature = { templateId: 'basic-creature', type: 'creature' as const };
    const stage1Creature = { templateId: 'stage-1-creature', type: 'creature' as const };
    const basicItem = { templateId: 'basic-item', type: 'item' as const };
    const basicTool = { templateId: 'basic-tool', type: 'tool' as const };
    const basicSupporter = { templateId: 'basic-supporter-card', type: 'supporter' as const };
    const attackCreature = { templateId: 'attack-creature', type: 'creature' as const };

    const testRepository = new MockCardRepository({
        creatures: {
            'basic-creature': {
                templateId: 'basic-creature',
                name: 'Basic Creature',
                maxHp: 60,
                type: 'fire',
                weakness: 'water',
                retreatCost: 1,
                attacks: [{ name: 'Basic Attack', damage: 20, energyRequirements: [{ type: 'fire', amount: 1 }] }],
            },
            'stage-1-creature': {
                templateId: 'stage-1-creature',
                name: 'Stage 1 Creature',
                maxHp: 90,
                type: 'fire',
                weakness: 'water',
                retreatCost: 1,
                previousStageName: 'Basic Creature',
                attacks: [{ name: 'Stage 1 Attack', damage: 40, energyRequirements: [{ type: 'fire', amount: 2 }] }],
            },
            'attack-creature': {
                templateId: 'attack-creature',
                name: 'Attack Creature',
                maxHp: 70,
                type: 'colorless',
                weakness: 'fighting',
                retreatCost: 1,
                attacks: [{ name: 'Special Move', damage: 30, energyRequirements: [{ type: 'colorless', amount: 1 }] }],
            },
            'on-play-peek-creature': {
                templateId: 'on-play-peek-creature',
                name: 'On Play Peek Creature',
                maxHp: 80,
                type: 'colorless',
                weakness: 'fighting',
                retreatCost: 1,
                previousStageName: 'Basic Creature',
                attacks: [{ name: 'Basic Attack', damage: 20, energyRequirements: [] }],
                ability: {
                    name: 'Item Collector',
                    description: 'Once during your turn, when you play this Pokemon from your hand to evolve 1 of your Pokemon, you may look at the top 4 cards of your deck and put all Item cards you find there into your hand.',
                    trigger: { type: 'on-play' },
                    effects: [{
                        type: 'peek-top',
                        n: 4,
                        criteria: { cardType: 'item' },
                        destination: 'hand',
                    }],
                },
            },
        },
        supporters: {
            'item-peek-supporter': {
                templateId: 'item-peek-supporter',
                name: 'Item Peek Supporter',
                description: 'Look at the top 4 cards of your deck. Put all Item cards you find there into your hand.',
                effects: [{
                    type: 'peek-top',
                    n: 4,
                    criteria: { cardType: 'item' },
                    destination: 'hand',
                }],
            },
            'tool-peek-supporter': {
                templateId: 'tool-peek-supporter',
                name: 'Tool Peek Supporter',
                description: 'Look at the top 4 cards of your deck. Put all Tool cards you find there into your hand.',
                effects: [{
                    type: 'peek-top',
                    n: 4,
                    criteria: { cardType: 'tool' },
                    destination: 'hand',
                }],
            },
            'stage1-peek-supporter': {
                templateId: 'stage1-peek-supporter',
                name: 'Stage 1 Peek Supporter',
                description: 'Look at the top 4 cards of your deck. Put all Stage 1 Pokemon you find there into your hand.',
                effects: [{
                    type: 'peek-top',
                    n: 4,
                    criteria: { cardType: 'creature', stage: 1 },
                    destination: 'hand',
                }],
            },
            'attack-peek-supporter': {
                templateId: 'attack-peek-supporter',
                name: 'Attack Peek Supporter',
                description: 'Look at the top 4 cards of your deck. Put all Pokemon with the Special Move attack into your hand.',
                effects: [{
                    type: 'peek-top',
                    n: 4,
                    criteria: { cardType: 'creature', hasAttack: 'Special Move' },
                    destination: 'hand',
                }],
            },
        },
        items: {
            'basic-item': {
                templateId: 'basic-item',
                name: 'Basic Item',
                effects: [{ type: 'hp', operation: 'heal', amount: { type: 'constant', value: 20 }, target: { type: 'fixed', player: 'self', position: 'active' }}],
            },
        },
        tools: {
            'basic-tool': {
                templateId: 'basic-tool',
                name: 'Basic Tool',
                effects: [],
            },
        },
    });

    it('should put all matching cards from the top N into hand', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [ new PlayCardResponseMessage('item-peek-supporter', 'supporter') ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature'),
                StateBuilder.withHand(0, [{ templateId: 'item-peek-supporter', type: 'supporter' }]),
                // deck order: top = last element; items are at positions 2 and 3 (top 4 = all 4)
                StateBuilder.withDeck(0, [ basicCreature, basicSupporter, basicItem, basicItem ]),
            ),
        });

        expect(getExecutedCount()).to.equal(1, 'Supporter should have played');
        expect(state.hand[0].filter(c => c.templateId === 'basic-item').length).to.equal(2, 'Both items should be in hand');
        expect(state.deck[0].filter(c => c.templateId === 'basic-item').length).to.equal(0, 'No items remain in deck');
    });

    it('should only look at the top N cards, not the whole deck', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [ new PlayCardResponseMessage('item-peek-supporter', 'supporter') ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature'),
                StateBuilder.withHand(0, [{ templateId: 'item-peek-supporter', type: 'supporter' }]),
                // item is at position 0 (bottom), outside the top 4 window
                StateBuilder.withDeck(0, [ basicItem, basicCreature, basicCreature, basicCreature, basicCreature ]),
            ),
        });

        expect(getExecutedCount()).to.equal(1);
        expect(state.hand[0].filter(c => c.templateId === 'basic-item').length).to.equal(0, 'Item below top 4 should not be found');
        expect(state.deck[0].length).to.equal(5, 'Deck size unchanged — no cards taken');
    });

    it('should shuffle the deck after peeking', () => {
        // Verify deck size is unchanged (shuffle is side-effect; ordering not testable deterministically)
        const { state, getExecutedCount } = runTestGame({
            actions: [ new PlayCardResponseMessage('item-peek-supporter', 'supporter') ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature'),
                StateBuilder.withHand(0, [{ templateId: 'item-peek-supporter', type: 'supporter' }]),
                StateBuilder.withDeck(0, [ basicCreature, basicCreature, basicItem, basicCreature ]),
            ),
        });

        expect(getExecutedCount()).to.equal(1);
        expect(state.deck[0].length).to.equal(3, 'Non-matching cards shuffled back into deck');
    });

    it('should find no cards when none match criteria', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [ new PlayCardResponseMessage('item-peek-supporter', 'supporter') ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature'),
                StateBuilder.withHand(0, [{ templateId: 'item-peek-supporter', type: 'supporter' }]),
                StateBuilder.withDeck(0, [ basicCreature, basicCreature, basicCreature, basicCreature ]),
            ),
        });

        expect(getExecutedCount()).to.equal(1);
        expect(state.hand[0].length).to.equal(0, 'No items found, hand stays empty');
        expect(state.deck[0].length).to.equal(4, 'All cards shuffled back');
    });

    it('should filter by tool card type', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [ new PlayCardResponseMessage('tool-peek-supporter', 'supporter') ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature'),
                StateBuilder.withHand(0, [{ templateId: 'tool-peek-supporter', type: 'supporter' }]),
                StateBuilder.withDeck(0, [ basicCreature, basicItem, basicTool, basicCreature ]),
            ),
        });

        expect(getExecutedCount()).to.equal(1);
        expect(state.hand[0].filter(c => c.templateId === 'basic-tool').length).to.equal(1, 'Tool should be in hand');
        expect(state.hand[0].filter(c => c.templateId === 'basic-item').length).to.equal(0, 'Item should not be in hand');
    });

    it('should filter by stage 1 Pokemon', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [ new PlayCardResponseMessage('stage1-peek-supporter', 'supporter') ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature'),
                StateBuilder.withHand(0, [{ templateId: 'stage1-peek-supporter', type: 'supporter' }]),
                StateBuilder.withDeck(0, [ basicCreature, basicItem, stage1Creature, basicCreature ]),
            ),
        });

        expect(getExecutedCount()).to.equal(1);
        expect(state.hand[0].filter(c => c.templateId === 'stage-1-creature').length).to.equal(1, 'Stage 1 should be in hand');
        expect(state.hand[0].filter(c => c.templateId === 'basic-creature').length).to.equal(0, 'Basic creature should not be taken');
    });

    it('should filter by specific attack name', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [ new PlayCardResponseMessage('attack-peek-supporter', 'supporter') ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature'),
                StateBuilder.withHand(0, [{ templateId: 'attack-peek-supporter', type: 'supporter' }]),
                StateBuilder.withDeck(0, [ basicCreature, stage1Creature, attackCreature, basicItem ]),
            ),
        });

        expect(getExecutedCount()).to.equal(1);
        expect(state.hand[0].filter(c => c.templateId === 'attack-creature').length).to.equal(1, 'Pokemon with named attack should be in hand');
        expect(state.hand[0].filter(c => c.templateId === 'basic-creature').length).to.equal(0, 'Other Pokemon should not be taken');
    });

    it('should not play when deck is empty', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [ new PlayCardResponseMessage('item-peek-supporter', 'supporter') ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature'),
                StateBuilder.withHand(0, [{ templateId: 'item-peek-supporter', type: 'supporter' }]),
                StateBuilder.withDeck(0, []),
            ),
        });

        expect(getExecutedCount()).to.equal(0, 'Should not play with empty deck');
        expect(state.hand[0].length).to.equal(1, 'Supporter remains in hand');
    });

    it('should trigger on-play ability when creature is evolved', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [ new EvolveResponseMessage('on-play-peek-creature', 0) ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature'),
                StateBuilder.withCreatures(1, 'basic-creature'),
                StateBuilder.withHand(0, [{ templateId: 'on-play-peek-creature', type: 'creature' }]),
                StateBuilder.withDeck(0, [ basicCreature, basicItem, basicItem, basicCreature ]),
                StateBuilder.withCanEvolve(0, 0),
            ),
        });

        expect(getExecutedCount()).to.equal(1, 'Evolution should have executed');
        expect(state.hand[0].filter(c => c.templateId === 'basic-item').length).to.equal(2, 'Items from top 4 should be in hand');
        expect(state.deck[0].length).to.equal(2, 'Non-matching cards remain in deck');
    });
});
