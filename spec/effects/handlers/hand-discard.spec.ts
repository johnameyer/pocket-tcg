import { expect } from 'chai';
import { PlayCardResponseMessage } from '../../../src/messages/response/play-card-response-message.js';
import { StateBuilder } from '../../helpers/state-builder.js';
import { runTestGame } from '../../helpers/test-helpers.js';
import { MockCardRepository } from '../../mock-repository.js';
import { CreatureData, SupporterData, ItemData } from '../../../src/repository/card-types.js';

describe('Hand Discard Effect', () => {
    const basicCreature = { templateId: 'basic-creature', type: 'creature' as const };
    const highHpCreature = { templateId: 'high-hp-creature', type: 'creature' as const };
    const basicItem = { templateId: 'basic-item', type: 'item' as const };
    const researchSupporter = { templateId: 'research-supporter', type: 'supporter' as const };
    const discardSupporter = { templateId: 'discard-supporter', type: 'supporter' as const };

    const testRepository = new MockCardRepository({
        creatures: new Map<string, CreatureData>([
            [ 'basic-creature', {
                templateId: 'basic-creature',
                name: 'Basic Creature',
                maxHp: 80,
                type: 'fire',
                weakness: 'water',
                retreatCost: 1,
                attacks: [{ name: 'Basic Attack', damage: 20, energyRequirements: [{ type: 'fire', amount: 1 }] }],
            }],
            [ 'high-hp-creature', {
                templateId: 'high-hp-creature',
                name: 'High HP Creature',
                maxHp: 140,
                type: 'water',
                weakness: 'grass',
                retreatCost: 2,
                attacks: [{ name: 'Water Attack', damage: 30, energyRequirements: [{ type: 'water', amount: 2 }] }],
            }],
        ]),
        supporters: new Map<string, SupporterData>([
            [ 'discard-supporter', {
                templateId: 'discard-supporter',
                name: 'Discard Supporter',
                effects: [{
                    type: 'hand-discard',
                    amount: { type: 'constant', value: 2 },
                    target: 'self',
                }],
            }],
            [ 'opponent-discard-supporter', {
                templateId: 'opponent-discard-supporter',
                name: 'Opponent Discard Supporter',
                effects: [{
                    type: 'hand-discard',
                    amount: { type: 'constant', value: 3 },
                    target: 'opponent',
                }],
            }],
            [ 'both-discard-supporter', {
                templateId: 'both-discard-supporter',
                name: 'Both Discard Supporter',
                effects: [{
                    type: 'hand-discard',
                    amount: { type: 'constant', value: 1 },
                    target: 'both',
                }],
            }],
            [ 'shuffle-discard-supporter', {
                templateId: 'shuffle-discard-supporter',
                name: 'Shuffle Discard Supporter',
                effects: [{
                    type: 'hand-discard',
                    amount: { type: 'constant', value: 2 },
                    target: 'self',
                    shuffleIntoDeck: true,
                }],
            }],
            [ 'variable-discard-supporter', {
                templateId: 'variable-discard-supporter',
                name: 'Variable Discard Supporter',
                effects: [{
                    type: 'hand-discard',
                    amount: { type: 'player-context-resolved', source: 'hand-size', playerContext: 'opponent' },
                    target: 'opponent',
                }],
            }],
            [ 'research-supporter', {
                templateId: 'research-supporter',
                name: 'Research Supporter',
                effects: [{ type: 'draw', amount: { type: 'constant', value: 2 }}],
            }],
        ]),
        items: new Map<string, ItemData>([
            [ 'basic-item', {
                templateId: 'basic-item',
                name: 'Basic Item',
                effects: [{ type: 'hp', operation: 'heal', amount: { type: 'constant', value: 20 }, target: { type: 'fixed', player: 'self', position: 'active' }}],
            }],
        ]),
    });

    const opponentDiscardSupporter = { templateId: 'opponent-discard-supporter', type: 'supporter' as const };
    const bothDiscardSupporter = { templateId: 'both-discard-supporter', type: 'supporter' as const };
    const shuffleDiscardSupporter = { templateId: 'shuffle-discard-supporter', type: 'supporter' as const };
    const variableDiscardSupporter = { templateId: 'variable-discard-supporter', type: 'supporter' as const };

    it('should discard 2 cards from self hand (basic operation)', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [ new PlayCardResponseMessage('discard-supporter', 'supporter') ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature'),
                StateBuilder.withHand(0, [ discardSupporter, basicCreature, highHpCreature, basicItem, researchSupporter ]),
            ),
            maxSteps: 10,
        });

        expect(getExecutedCount()).to.equal(1, 'Should have executed discard supporter');
        expect(state.hand[0].length).to.equal(2, 'Player 0 should have 2 cards remaining (5 - 1 played - 2 discarded)');
    });

    it('should discard from different targets (opponent)', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [ new PlayCardResponseMessage('opponent-discard-supporter', 'supporter') ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature'),
                StateBuilder.withHand(0, [ opponentDiscardSupporter ]),
                StateBuilder.withHand(1, [ basicCreature, highHpCreature, basicItem, researchSupporter, basicItem ]),
            ),
            maxSteps: 10,
        });

        expect(getExecutedCount()).to.equal(1, 'Should have executed opponent discard supporter');
        expect(state.hand[0].length).to.equal(0, 'Player 0 should have no cards (played supporter)');
        expect(state.hand[1].length).to.equal(2, 'Player 1 should have 2 cards remaining (5 - 3 discarded)');
    });

    it('should discard different amounts (variable based on opponent hand size)', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [ new PlayCardResponseMessage('variable-discard-supporter', 'supporter') ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature'),
                StateBuilder.withHand(0, [ variableDiscardSupporter ]),
                StateBuilder.withHand(1, [ basicCreature, highHpCreature, basicItem ]), // 3 cards, so should discard 3
            ),
            maxSteps: 10,
        });

        expect(getExecutedCount()).to.equal(1, 'Should have executed variable discard supporter');
        expect(state.hand[0].length).to.equal(0, 'Player 0 should have no cards (played supporter)');
        expect(state.hand[1].length).to.equal(0, 'Player 1 should have no cards (all 3 discarded)');
    });

    it('should handle both players discard', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [ new PlayCardResponseMessage('both-discard-supporter', 'supporter') ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature'),
                StateBuilder.withHand(0, [ bothDiscardSupporter, basicCreature, highHpCreature ]),
                StateBuilder.withHand(1, [ basicItem, researchSupporter ]),
            ),
            maxSteps: 10,
        });

        expect(getExecutedCount()).to.equal(1, 'Should have executed both discard supporter');
        expect(state.hand[0].length).to.equal(1, 'Player 0 should have 1 card remaining (3 - 1 played - 1 discarded)');
        expect(state.hand[1].length).to.equal(1, 'Player 1 should have 1 card remaining (2 - 1 discarded)');
    });

    it('should shuffle discarded cards into deck when specified', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [ new PlayCardResponseMessage('shuffle-discard-supporter', 'supporter') ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature'),
                StateBuilder.withHand(0, [ shuffleDiscardSupporter, basicCreature, highHpCreature, basicItem ]),
                StateBuilder.withDeck(0, [ researchSupporter ]), // Start with 1 card in deck
            ),
            maxSteps: 10,
        });

        expect(getExecutedCount()).to.equal(1, 'Should have executed shuffle discard supporter');
        expect(state.hand[0].length).to.equal(1, 'Player 0 should have 1 card remaining (4 - 1 played - 2 discarded)');
        expect(state.deck[0].length).to.equal(3, 'Player 0 deck should have 3 cards (1 original + 2 shuffled in)');
    });

    it('should cap discard at available hand size', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [ new PlayCardResponseMessage('opponent-discard-supporter', 'supporter') ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature'),
                StateBuilder.withHand(0, [ opponentDiscardSupporter ]),
                StateBuilder.withHand(1, [ basicCreature, highHpCreature ]), // Only 2 cards, but effect wants to discard 3
            ),
            maxSteps: 10,
        });

        expect(getExecutedCount()).to.equal(1, 'Should have executed opponent discard supporter');
        expect(state.hand[0].length).to.equal(0, 'Player 0 should have no cards (played supporter)');
        expect(state.hand[1].length).to.equal(0, 'Player 1 should have no cards (all 2 discarded, capped)');
    });

    it('should handle empty hand gracefully', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [ new PlayCardResponseMessage('discard-supporter', 'supporter') ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature'),
                StateBuilder.withHand(0, [ discardSupporter ]), // Only the supporter card
            ),
            maxSteps: 10,
        });

        expect(getExecutedCount()).to.equal(1, 'Should have executed discard supporter');
        expect(state.hand[0].length).to.equal(0, 'Player 0 should have no cards (played supporter, no cards to discard)');
    });
});
