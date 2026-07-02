import { expect } from 'chai';
import { AttackResponseMessage } from '../../../src/messages/response/attack-response-message.js';
import { StateBuilder } from '../../helpers/state-builder.js';
import { runTestGame } from '../../helpers/test-helpers.js';
import { MockCardRepository } from '../../mock-repository.js';

describe('Try-Then Effect', () => {
    const testRepository = new MockCardRepository({
        creatures: {
            'try-then-attacker': {
                templateId: 'try-then-attacker',
                name: 'Try-Then Attacker',
                maxHp: 100,
                type: 'colorless',
                retreatCost: 1,
                attacks: [{
                    name: 'Soul Shot',
                    damage: 0,
                    energyRequirements: [],
                    effects: [{
                        type: 'try-then',
                        attempt: {
                            type: 'hand-discard',
                            amount: { type: 'constant', value: 1 },
                            target: 'self',
                        },
                        then: {
                            type: 'hp',
                            amount: { type: 'constant', value: 70 },
                            target: { type: 'fixed', player: 'opponent', position: 'active' },
                            operation: 'damage',
                        },
                    }],
                }],
            },
            defender: {
                templateId: 'defender',
                name: 'Defender',
                maxHp: 200,
                type: 'colorless',
                retreatCost: 1,
                attacks: [{ name: 'Basic Attack', damage: 10, energyRequirements: [] }],
            },
        },
    });

    it('fires both attempt and then when attacker has cards in hand', () => {
        const { state } = runTestGame({
            actions: [ new AttackResponseMessage(0) ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'try-then-attacker'),
                StateBuilder.withCreatures(1, 'defender'),
                StateBuilder.withHand(0, [{ templateId: 'defender', type: 'creature' }]),
            ),
        });

        // Attempt (discard 1) succeeded → then (70 damage) fires
        expect(state.field.creatures[1][0].damageTaken).to.equal(70, 'Should deal 70 damage when hand has cards');
        // Attacker's hand should be empty after discarding
        expect(state.hand[0].length).to.equal(0, 'Should have discarded the card from hand');
    });

    it('blocks both attempt and then when attacker has no cards in hand', () => {
        const { state } = runTestGame({
            actions: [ new AttackResponseMessage(0) ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'try-then-attacker'),
                StateBuilder.withCreatures(1, 'defender'),
                StateBuilder.withHand(0, []),
            ),
        });

        // Attempt (discard 1) failed → neither effect fires
        expect(state.field.creatures[1][0].damageTaken).to.equal(0, 'Should deal no damage when hand is empty');
    });
});
