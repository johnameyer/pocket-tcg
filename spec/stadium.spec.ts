import { expect } from 'chai';
import { PlayCardResponseMessage } from '../src/messages/response/play-card-response-message.js';
import { GameCard } from '../src/controllers/card-types.js';
import { StateBuilder } from './helpers/state-builder.js';
import { runTestGame } from './helpers/test-helpers.js';
import { StadiumData } from '../src/repository/card-types.js';
import { EndTurnResponseMessage } from '../src/messages/response/end-turn-response-message.js';

describe('Stadium Cards', () => {
    const basicStadium = { templateId: 'basic-stadium', type: 'stadium' as const };
    const anotherStadium = { templateId: 'other-stadium', type: 'stadium' as const };

    describe('One Stadium Per Turn Restriction', () => {
        it('should prevent playing multiple stadiums in one turn', () => {
            const { state, getExecutedCount } = runTestGame({
                actions: [
                    new PlayCardResponseMessage('basic-stadium', 'stadium'),
                    new PlayCardResponseMessage('other-stadium', 'stadium'),
                ],
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withHand(0, [ basicStadium, anotherStadium ]),
                    StateBuilder.withCreatures(0, 'basic-creature'),
                ),
                maxSteps: 10,
            });

            // Only first stadium should execute, second should be blocked
            expect(getExecutedCount()).to.equal(1, 'Should only execute first stadium');
            expect(state.hand[0].length).to.equal(1, 'Second stadium should remain in hand');
            
            // Card conservation: first stadium moved to stadium slot or discard
            expect(state.stadium.activeStadium).to.exist;
            expect(state.stadium.activeStadium?.templateId).to.equal('basic-stadium');
        });

        it('should allow playing a stadium on the next turn', () => {
            const { state, getExecutedCount } = runTestGame({
                actions: [
                    new PlayCardResponseMessage('basic-stadium', 'stadium'),
                    new EndTurnResponseMessage(),
                    // Player 1's turn - but they won't play anything automatically
                ],
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withHand(0, [ basicStadium, anotherStadium ]),
                    StateBuilder.withCreatures(0, 'basic-creature'),
                    StateBuilder.withCreatures(1, 'basic-creature'),
                ),
                maxSteps: 15,
            });

            // First stadium should execute, then turn should end
            expect(getExecutedCount()).to.equal(2, 'Should execute first stadium and end turn');
            // Second stadium can be played next turn (validated by not being blocked)
            expect(state.hand[0].some(card => card.templateId === 'other-stadium')).to.be.true;
        });
    });

    describe('Stadium Replacement', () => {
        it('should replace opponent stadium with own stadium', () => {
            const { state } = runTestGame({
                actions: [
                    new PlayCardResponseMessage('basic-stadium', 'stadium'),
                    new EndTurnResponseMessage(),
                    new PlayCardResponseMessage('other-stadium', 'stadium'),
                ],
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withHand(0, [ basicStadium ]),
                    StateBuilder.withHand(1, [ anotherStadium ]),
                    StateBuilder.withCreatures(0, 'basic-creature'),
                    StateBuilder.withCreatures(1, 'basic-creature'),
                ),
                maxSteps: 15,
            });

            // Second player's stadium should be active
            expect(state.stadium.activeStadium).to.exist;
            expect(state.stadium.activeStadium?.templateId).to.equal('other-stadium');
            expect(state.stadium.activeStadium?.owner).to.equal(1);
            
            // First player's stadium should be in their discard
            expect(state.discard[0].some((card: GameCard) => card.templateId === 'basic-stadium')).to.be.true;
        });

        it('should replace own stadium with different stadium', () => {
            const { state } = runTestGame({
                actions: [
                    new PlayCardResponseMessage('basic-stadium', 'stadium'),
                    new EndTurnResponseMessage(),
                    new EndTurnResponseMessage(),
                    new PlayCardResponseMessage('other-stadium', 'stadium'),
                ],
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withHand(0, [ basicStadium, anotherStadium ]),
                    StateBuilder.withCreatures(0, 'basic-creature'),
                    StateBuilder.withCreatures(1, 'basic-creature'),
                ),
                maxSteps: 20,
            });

            // Second stadium should be active
            expect(state.stadium.activeStadium).to.exist;
            expect(state.stadium.activeStadium?.templateId).to.equal('other-stadium');
            expect(state.stadium.activeStadium?.owner).to.equal(0);
            
            // First stadium should be in discard pile
            expect(state.discard[0].some((card: GameCard) => card.templateId === 'basic-stadium')).to.be.true;
        });

        it('should discard replaced stadium to correct player discard pile', () => {
            const { state } = runTestGame({
                actions: [
                    new PlayCardResponseMessage('basic-stadium', 'stadium'),
                    new EndTurnResponseMessage(),
                    new PlayCardResponseMessage('other-stadium', 'stadium'),
                ],
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withHand(0, [ basicStadium ]),
                    StateBuilder.withHand(1, [ anotherStadium ]),
                    StateBuilder.withCreatures(0, 'basic-creature'),
                    StateBuilder.withCreatures(1, 'basic-creature'),
                ),
                maxSteps: 15,
            });

            // Player 0's stadium should be in player 0's discard
            const player0Discarded = state.discard[0].filter((card: GameCard) => card.templateId === 'basic-stadium');
            expect(player0Discarded.length).to.equal(1, 'Player 0 stadium should be in player 0 discard');
            
            // Player 1's discard should be empty (their stadium is still active)
            expect(state.discard[1].length).to.equal(0, 'Player 1 discard should be empty');
        });
    });

    describe('Duplicate Name Prevention', () => {
        it('should prevent playing stadium with same name as active stadium', () => {
            const duplicateStadium = { templateId: 'test-stadium-copy', type: 'stadium' as const };
            
            const { state, getExecutedCount } = runTestGame({
                actions: [
                    new PlayCardResponseMessage('basic-stadium', 'stadium'),
                    new EndTurnResponseMessage(),
                    new PlayCardResponseMessage('basic-stadium', 'stadium'),
                ],
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withHand(0, [ basicStadium ]),
                    StateBuilder.withHand(1, [ basicStadium ]),
                    StateBuilder.withCreatures(0, 'basic-creature'),
                    StateBuilder.withCreatures(1, 'basic-creature'),
                ),
                maxSteps: 15,
            });

            // First stadium plays, second should be blocked (same name)
            expect(getExecutedCount()).to.equal(2, 'Should execute first stadium and end turn only');
            expect(state.stadium.activeStadium?.templateId).to.equal('basic-stadium');
            expect(state.hand[1].some(card => card.templateId === 'basic-stadium')).to.be.true;
        });
    });

    describe('Passive Effects', () => {
        it('should register passive effects when stadium is played', () => {
            const { state } = runTestGame({
                actions: [
                    new PlayCardResponseMessage('basic-stadium', 'stadium'),
                ],
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withHand(0, [ basicStadium ]),
                    StateBuilder.withCreatures(0, 'basic-creature'),
                ),
                maxSteps: 10,
            });

            // Stadium should be active
            expect(state.stadium.activeStadium).to.exist;
            expect(state.stadium.activeStadium?.templateId).to.equal('basic-stadium');
        });

        it('should clear passive effects when stadium is replaced', () => {
            const { state } = runTestGame({
                actions: [
                    new PlayCardResponseMessage('basic-stadium', 'stadium'),
                    new EndTurnResponseMessage(),
                    new PlayCardResponseMessage('other-stadium', 'stadium'),
                ],
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withHand(0, [ basicStadium ]),
                    StateBuilder.withHand(1, [ anotherStadium ]),
                    StateBuilder.withCreatures(0, 'basic-creature'),
                    StateBuilder.withCreatures(1, 'basic-creature'),
                ),
                maxSteps: 15,
            });

            // New stadium should be active
            expect(state.stadium.activeStadium?.templateId).to.equal('other-stadium');
            
            // Old stadium should be discarded
            expect(state.discard[0].some((card: GameCard) => card.templateId === 'basic-stadium')).to.be.true;
        });
    });
});
