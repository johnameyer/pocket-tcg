import { expect } from 'chai';
import { AttackResponseMessage } from '../../../src/messages/response/attack-response-message.js';
import { PlayCardResponseMessage } from '../../../src/messages/response/play-card-response-message.js';
import { StateBuilder } from '../../helpers/state-builder.js';
import { runTestGame } from '../../helpers/test-helpers.js';
import { MockCardRepository } from '../../mock-repository.js';
import { CreatureData, SupporterData } from '../../../src/repository/card-types.js';

describe('Damage Boost Effect', () => {
    const testRepository = new MockCardRepository({
        creatures: new Map<string, CreatureData>([
            [ 'basic-attacker', {
                templateId: 'basic-attacker',
                name: 'Basic Attacker',
                maxHp: 80,
                type: 'fire',
                weakness: 'water',
                retreatCost: 1,
                attacks: [{
                    name: 'Fire Punch',
                    damage: 30,
                    energyRequirements: [{ type: 'fire', amount: 1 }],
                }],
            }],
        ]),
        supporters: new Map<string, SupporterData>([
            [ 'damage-boost-supporter', {
                templateId: 'damage-boost-supporter',
                name: 'Power Boost',
                effects: [{
                    type: 'damage-boost',
                    amount: { type: 'constant', value: 20 },
                    // No targetCondition means applies to all targets
                }],
            }],
        ]),
    });

    it('should boost attack damage after playing supporter', () => {
        const { state } = runTestGame({
            actions: [
                new PlayCardResponseMessage('damage-boost-supporter', 'supporter'),
                new AttackResponseMessage(0),
            ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-attacker'),
                StateBuilder.withCreatures(1, 'high-hp-creature'), // Target
                StateBuilder.withHand(0, [{ templateId: 'damage-boost-supporter', type: 'supporter' }]),
                StateBuilder.withEnergy('basic-attacker-0', { fire: 1 }),
            ),
            maxSteps: 10,
        });

        expect(state.field.creatures[1][0].damageTaken).to.equal(50, 'Should deal 50 damage (30 base + 20 boost)');
    });
});
