import { expect } from 'chai';
import { UseStadiumResponseMessage } from '../../../src/messages/response/use-stadium-response-message.js';
import { EndTurnResponseMessage } from '../../../src/messages/response/end-turn-response-message.js';
import { StateBuilder } from '../../helpers/state-builder.js';
import { runTestGame } from '../../helpers/test-helpers.js';
import { MockCardRepository } from '../../mock-repository.js';

describe('Use Stadium Ability', () => {
    const drawStadiumId = 'draw-stadium';

    const testRepository = new MockCardRepository({
        creatures: {
            'basic-attacker': {
                templateId: 'basic-attacker',
                name: 'Basic Attacker',
                maxHp: 100,
                type: 'colorless',
                retreatCost: 1,
                attacks: [{ name: 'Tackle', damage: 10, energyRequirements: [] }],
            },
        },
        stadiums: {
            [drawStadiumId]: {
                templateId: drawStadiumId,
                name: 'Draw Stadium',
                description: 'Once per turn, draw a card.',
                trigger: { type: 'manual', unlimited: false },
                effects: [{ type: 'draw', amount: { type: 'constant', value: 1 }}],
            },
            'unlimited-draw-stadium': {
                templateId: 'unlimited-draw-stadium',
                name: 'Unlimited Draw Stadium',
                description: 'Any number of times per turn, draw a card.',
                trigger: { type: 'manual', unlimited: true },
                effects: [{ type: 'draw', amount: { type: 'constant', value: 1 }}],
            },
            'shuffle-draw-stadium': {
                templateId: 'shuffle-draw-stadium',
                name: 'Shuffle Draw Stadium',
                description: 'Once per turn, shuffle a Basic Pokemon from hand into deck, then draw a card.',
                trigger: { type: 'manual', unlimited: false },
                effects: [{
                    type: 'try-then',
                    attempt: {
                        type: 'hand-discard',
                        target: 'self',
                        amount: { type: 'constant', value: 1 },
                        shuffleIntoDeck: true,
                        criteria: { cardType: 'creature', stage: 0 },
                    },
                    then: { type: 'draw', amount: { type: 'constant', value: 1 }},
                }],
            },
        },
    });

    const setupBase = StateBuilder.combine(
        StateBuilder.withCreatures(0, 'basic-attacker'),
        StateBuilder.withCreatures(1, 'basic-attacker'),
        StateBuilder.withDeck(0, [
            { templateId: 'basic-attacker', type: 'creature' },
            { templateId: 'basic-attacker', type: 'creature' },
            { templateId: 'basic-attacker', type: 'creature' },
        ]),
    );

    it('fires ability effects when stadium has trigger', () => {
        const { state } = runTestGame({
            actions: [ new UseStadiumResponseMessage(), new EndTurnResponseMessage() ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                setupBase,
                StateBuilder.withStadium(drawStadiumId),
                StateBuilder.withHand(0, []),
            ),
        });

        expect(state.hand[0].length).to.equal(1, 'Should have drawn 1 card from stadium ability');
    });

    it('blocks second activation of once-per-turn stadium ability', () => {
        const { state } = runTestGame({
            actions: [
                new UseStadiumResponseMessage(),
                new UseStadiumResponseMessage(),
                new EndTurnResponseMessage(),
            ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                setupBase,
                StateBuilder.withStadium(drawStadiumId),
                StateBuilder.withHand(0, []),
            ),
        });

        expect(state.hand[0].length).to.equal(1, 'Should only draw once with once-per-turn ability');
    });

    it('allows unlimited stadium ability to fire multiple times', () => {
        const { state } = runTestGame({
            actions: [
                new UseStadiumResponseMessage(),
                new UseStadiumResponseMessage(),
                new EndTurnResponseMessage(),
            ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                setupBase,
                StateBuilder.withStadium('unlimited-draw-stadium'),
                StateBuilder.withHand(0, []),
            ),
        });

        expect(state.hand[0].length).to.equal(2, 'Should draw twice with unlimited ability');
    });

    it('try-then stadium ability: fires draw when Basic Pokemon in hand', () => {
        const { state } = runTestGame({
            actions: [ new UseStadiumResponseMessage(), new EndTurnResponseMessage() ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                setupBase,
                StateBuilder.withStadium('shuffle-draw-stadium'),
                StateBuilder.withHand(0, [{ templateId: 'basic-attacker', type: 'creature' }]),
            ),
        });

        expect(state.hand[0].length).to.equal(1, 'Should draw 1 after shuffling Basic into deck');
    });

    it('try-then stadium ability: blocks draw when no Basic Pokemon in hand', () => {
        const { state } = runTestGame({
            actions: [ new UseStadiumResponseMessage(), new EndTurnResponseMessage() ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                setupBase,
                StateBuilder.withStadium('shuffle-draw-stadium'),
                StateBuilder.withHand(0, []),
            ),
        });

        expect(state.hand[0].length).to.equal(0, 'Should not draw when no Basic Pokemon in hand');
    });
});
