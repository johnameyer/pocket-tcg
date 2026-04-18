import { expect } from 'chai';
import { PlayCardResponseMessage } from '../../../src/messages/response/play-card-response-message.js';
import { AttackResponseMessage } from '../../../src/messages/response/attack-response-message.js';
import { SelectChoiceResponseMessage } from '../../../src/messages/response/select-choice-response-message.js';
import { StateBuilder } from '../../helpers/state-builder.js';
import { runTestGame } from '../../helpers/test-helpers.js';
import { MockCardRepository } from '../../mock-repository.js';

describe('Choice Delegation Effect', () => {
    describe('basic choice between two effects', () => {
        const testRepository = new MockCardRepository({
            supporters: {
                'choice-supporter': {
                    templateId: 'choice-supporter',
                    name: 'Choice Supporter',
                    effects: [{
                        type: 'choice-delegation',
                        options: [
                            {
                                name: 'Draw 3',
                                effects: [{
                                    type: 'draw',
                                    amount: { type: 'constant', value: 3 },
                                }],
                            },
                            {
                                name: 'Heal 20',
                                effects: [{
                                    type: 'hp',
                                    amount: { type: 'constant', value: 20 },
                                    target: { type: 'fixed', player: 'self', position: 'active' },
                                    operation: 'heal',
                                }],
                            },
                        ],
                    }],
                },
            },
        });

        it('should apply the first option when chosen', () => {
            const { state } = runTestGame({
                actions: [
                    new PlayCardResponseMessage('choice-supporter', 'supporter'),
                    new SelectChoiceResponseMessage([ 'Draw 3' ]),
                ],
                customRepository: testRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature'),
                    StateBuilder.withHand(0, [{ templateId: 'choice-supporter', type: 'supporter' }]),
                    StateBuilder.withDeck(0, Array(5).fill({ templateId: 'basic-creature', type: 'creature' })),
                ),
            });

            expect(state.hand[0].length).to.equal(3, 'Should draw 3 cards when Draw 3 is chosen');
        });

        it('should apply the second option when chosen', () => {
            const { state } = runTestGame({
                actions: [
                    new PlayCardResponseMessage('choice-supporter', 'supporter'),
                    new SelectChoiceResponseMessage([ 'Heal 20' ]),
                ],
                customRepository: testRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature'),
                    StateBuilder.withHand(0, [{ templateId: 'choice-supporter', type: 'supporter' }]),
                    StateBuilder.withDeck(0, Array(5).fill({ templateId: 'basic-creature', type: 'creature' })),
                ),
            });

            expect(state.hand[0].length).to.equal(0, 'Should not draw any cards when Heal 20 is chosen');
        });
    });

    describe('choice in attack effects', () => {
        const testRepository = new MockCardRepository({
            creatures: {
                'choice-attacker': {
                    templateId: 'choice-attacker',
                    name: 'Choice Attacker',
                    maxHp: 80,
                    type: 'fire',
                    retreatCost: 1,
                    attacks: [{
                        name: 'Dual Option',
                        damage: 0,
                        energyRequirements: [{ type: 'fire', amount: 1 }],
                        effects: [{
                            type: 'choice-delegation',
                            options: [
                                {
                                    name: 'Deal 30',
                                    effects: [{
                                        type: 'hp',
                                        amount: { type: 'constant', value: 30 },
                                        target: { type: 'fixed', player: 'opponent', position: 'active' },
                                        operation: 'damage',
                                    }],
                                },
                                {
                                    name: 'Apply Status',
                                    effects: [{
                                        type: 'status',
                                        condition: 'poison',
                                        target: { type: 'fixed', player: 'opponent', position: 'active' },
                                    }],
                                },
                            ],
                        }],
                    }],
                },
            },
        });

        it('should deal damage when damage option is chosen', () => {
            const { state } = runTestGame({
                actions: [
                    new AttackResponseMessage(0),
                    new SelectChoiceResponseMessage([ 'Deal 30' ]),
                ],
                customRepository: testRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'choice-attacker'),
                    StateBuilder.withCreatures(1, 'high-hp-creature'),
                    StateBuilder.withEnergy('choice-attacker-0', { fire: 1 }),
                ),
            });

            expect(state.field.creatures[1][0].damageTaken).to.equal(30, 'Should deal 30 damage');
            expect(state.statusEffects.activeStatusEffects[1]).to.have.length(0, 'Should not apply status');
        });

        it('should apply status when status option is chosen', () => {
            const { state } = runTestGame({
                actions: [
                    new AttackResponseMessage(0),
                    new SelectChoiceResponseMessage([ 'Apply Status' ]),
                ],
                customRepository: testRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'choice-attacker'),
                    StateBuilder.withCreatures(1, 'high-hp-creature'),
                    StateBuilder.withEnergy('choice-attacker-0', { fire: 1 }),
                ),
            });

            expect(state.field.creatures[1][0].damageTaken).to.equal(0, 'Should deal no damage');
            expect(state.statusEffects.activeStatusEffects[1]).to.have.length(1, 'Should apply a status');
            expect(state.statusEffects.activeStatusEffects[1][0].type).to.equal('poison', 'Should apply poison');
        });
    });
});
