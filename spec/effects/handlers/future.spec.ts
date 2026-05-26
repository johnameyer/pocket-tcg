import { expect } from 'chai';
import { EndTurnResponseMessage } from '../../../src/messages/response/end-turn-response-message.js';
import { PlayCardResponseMessage } from '../../../src/messages/response/play-card-response-message.js';
import { StateBuilder } from '../../helpers/state-builder.js';
import { runTestGame } from '../../helpers/test-helpers.js';
import { MockCardRepository } from '../../mock-repository.js';

describe('Future Effect Handler', () => {
    const delayedSupporter = { templateId: 'delayed-supporter', type: 'supporter' as const };

    const testRepository = new MockCardRepository({
        supporters: {
            'delayed-supporter': {
                templateId: 'delayed-supporter',
                name: 'Delayed Supporter',
                effects: [{
                    type: 'future',
                    delayTurns: 0,
                    targetPlayer: 'opponent',
                    phase: 'end-of-turn',
                    effects: [{
                        type: 'hp',
                        amount: { type: 'constant', value: 20 },
                        target: { type: 'fixed', player: 'opponent', position: 'active' },
                        operation: 'damage',
                    }],
                }],
            },
        },
        creatures: {
            'basic-creature': {
                templateId: 'basic-creature',
                name: 'Basic Creature',
                maxHp: 80,
                type: 'colorless',
                retreatCost: 1,
                attacks: [{ name: 'Basic Attack', damage: 20, energyRequirements: [] }],
            },
        },
    });

    it('should apply delayed effects on the matching later turn phase', () => {
        const { state: afterPlayer0Turn } = runTestGame({
            actions: [
                new PlayCardResponseMessage('delayed-supporter', 'supporter'),
                new EndTurnResponseMessage(),
            ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature'),
                StateBuilder.withCreatures(1, 'basic-creature'),
                StateBuilder.withHand(0, [ delayedSupporter ]),
            ),
        });

        expect(afterPlayer0Turn.field.creatures[1][0].damageTaken).to.equal(0, 'Should not trigger during the source turn');

        const { state } = runTestGame({
            actions: [ new EndTurnResponseMessage() ],
            customRepository: testRepository,
            resumeFrom: afterPlayer0Turn,
            playerPosition: 1,
        });

        expect(state.field.creatures[1][0].damageTaken).to.equal(20, 'Should trigger on the opponent end step');
    });
});
