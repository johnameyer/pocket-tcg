import { expect } from 'chai';
import { PlayCardResponseMessage } from '../src/messages/response/play-card-response-message.js';
import { StateBuilder } from './helpers/state-builder.js';
import { runTestGame } from './helpers/test-helpers.js';
import { createCardArray } from './helpers/test-utils.js';

describe('Supporters', () => {
    const basicSupporter = { templateId: 'basic-supporter', type: 'supporter' as const };
    const deckCards = createCardArray(4, 'basic-creature');

    it('should prevent playing multiple supporters in one turn', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [
                new PlayCardResponseMessage('basic-supporter', 'supporter'),
                new PlayCardResponseMessage('basic-supporter', 'supporter')
            ],
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withHand(0, [basicSupporter, basicSupporter]),
                StateBuilder.withCreatures(0, 'basic-creature'),
                StateBuilder.withDamage('basic-creature-0', 30),
                StateBuilder.withDeck(0, deckCards)
            ),
            maxSteps: 10
        });

        expect(getExecutedCount()).to.equal(1, 'Should only execute first supporter');
        expect(state.hand[0].length).to.equal(1, 'Second supporter should remain in hand');
    });
});
