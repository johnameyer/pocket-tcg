import { expect } from 'chai';
import { runTestGame } from '../../helpers/test-helpers.js';
import { StateBuilder } from '../../helpers/state-builder.js';
import { PlayCardResponseMessage } from '../../../src/messages/response/play-card-response-message.js';
import { AttackResponseMessage } from '../../../src/messages/response/attack-response-message.js';
import { MockCardRepository } from '../../mock-repository.js';
import { CreatureData, SupporterData } from '../../../src/repository/card-types.js';

describe('Damage Boost Conditions', () => {
    const testRepository = new MockCardRepository({
        creatures: new Map<string, CreatureData>([
            ['basic-creature', {
                templateId: 'basic-creature',
                name: 'Basic Creature',
                maxHp: 80,
                type: 'fire',
                weakness: 'water',
                retreatCost: 1,
                attacks: [{ name: 'Basic Attack', damage: 20, energyRequirements: [{ type: 'fire', amount: 1 }] }]
            }],
            ['evolution-creature', {
                templateId: 'evolution-creature', 
                name: 'Evolution Creature',
                maxHp: 120,
                type: 'fire',
                weakness: 'water',
                previousStageName: 'Basic Creature',
                retreatCost: 2,
                attacks: [{ name: 'Evolution Attack', damage: 40, energyRequirements: [{ type: 'fire', amount: 2 }] }]
            }],
            ['ex-creature', {
                templateId: 'ex-creature',
                name: 'EX Creature', 
                maxHp: 180,
                type: 'water',
                weakness: 'lightning',
                retreatCost: 3,
                attributes: { ex: true },
                attacks: [{ name: 'EX Attack', damage: 60, energyRequirements: [{ type: 'water', amount: 3 }] }]
            }]
        ]),
        supporters: new Map<string, SupporterData>([
            ['evolution-boost-supporter', {
                templateId: 'evolution-boost-supporter',
                name: 'Evolution Boost Supporter',
                effects: [{
                    type: 'damage-boost',
                    amount: { type: 'constant', value: 30 },
                    condition: { previousStageName: 'Basic Creature' },
                    duration: 'this-turn'
                }]
            }],
            ['ex-boost-supporter', {
                templateId: 'ex-boost-supporter', 
                name: 'EX Boost Supporter',
                effects: [{
                    type: 'damage-boost',
                    amount: { type: 'constant', value: 20 },
                    condition: { attributes: { ex: true } },
                    duration: 'this-turn'
                }]
            }]
        ])
    });

    it('should boost damage against evolution creatures with evolvesFrom condition', () => {
        const { state } = runTestGame({
            actions: [
                new PlayCardResponseMessage('evolution-boost-supporter', 'supporter'),
                new AttackResponseMessage(0)
            ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature'),
                StateBuilder.withCreatures(1, 'evolution-creature'),
                StateBuilder.withHand(0, [{ templateId: 'evolution-boost-supporter', type: 'supporter' }]),
                StateBuilder.withEnergy('basic-creature-0', { fire: 1 })
            ),
            maxSteps: 10
        });

        const opponentPokemon = state.field.creatures[1][0];
        expect(opponentPokemon.damageTaken).to.equal(50, 'Should deal 20 base + 30 boost = 50 damage to evolution creature');
    });

    it('should boost damage against ex creatures with isType condition', () => {
        const { state } = runTestGame({
            actions: [
                new PlayCardResponseMessage('ex-boost-supporter', 'supporter'),
                new AttackResponseMessage(0)
            ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature'),
                StateBuilder.withCreatures(1, 'ex-creature'),
                StateBuilder.withHand(0, [{ templateId: 'ex-boost-supporter', type: 'supporter' }]),
                StateBuilder.withEnergy('basic-creature-0', { fire: 1 })
            ),
            maxSteps: 10
        });

        const opponentPokemon = state.field.creatures[1][0];
        expect(opponentPokemon.damageTaken).to.equal(40, 'Should deal 20 base + 20 boost = 40 damage to ex creature');
    });

    it('should not boost damage when condition does not match', () => {
        const { state } = runTestGame({
            actions: [
                new PlayCardResponseMessage('evolution-boost-supporter', 'supporter'),
                new AttackResponseMessage(0)
            ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature'),
                StateBuilder.withCreatures(1, 'basic-creature'), // Basic creature, not evolution
                StateBuilder.withHand(0, [{ templateId: 'evolution-boost-supporter', type: 'supporter' }]),
                StateBuilder.withEnergy('basic-creature-0', { fire: 1 })
            ),
            maxSteps: 10
        });

        const opponentPokemon = state.field.creatures[1][0];
        expect(opponentPokemon.damageTaken).to.equal(20, 'Should deal only 20 base damage when condition does not match');
    });
});
