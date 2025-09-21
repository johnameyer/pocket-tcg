import { expect } from 'chai';
import { PlayCardResponseMessage } from '../src/messages/response/play-card-response-message.js';
import { StateBuilder } from './helpers/state-builder.js';
import { runTestGame } from './helpers/test-helpers.js';

describe('Supporters', () => {
    const basicSupporter = { templateId: 'basic-supporter', type: 'supporter' as const };

    it('should prevent playing multiple supporters in one turn', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [
                new PlayCardResponseMessage('basic-supporter', 'supporter'),
                new PlayCardResponseMessage('basic-supporter', 'supporter')
            ],
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withHand(0, [basicSupporter, basicSupporter]),
                StateBuilder.withcreature(0, 'basic-creature'), // Add active creature for HP effect target
                StateBuilder.withDamage('basic-creature-0', 30), // Add damage so healing can work
                StateBuilder.withDeck(0, [
                    { templateId: 'basic-creature', type: 'creature' }, 
                    { templateId: 'basic-creature', type: 'creature' }, 
                    { templateId: 'basic-creature', type: 'creature' }, 
                    { templateId: 'basic-creature', type: 'creature' }
                ])
            ),
            maxSteps: 10
        });

        // Only first supporter should execute, second should be blocked
        expect(getExecutedCount()).to.equal(1, 'Should only execute first supporter');
        expect(state.hand[0].length).to.equal(1, 'Second supporter should remain in hand');
    });
});
