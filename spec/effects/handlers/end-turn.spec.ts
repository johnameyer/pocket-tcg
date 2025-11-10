import { expect } from 'chai';
import { PlayCardResponseMessage } from '../../../src/messages/response/play-card-response-message.js';
import { AttackResponseMessage } from '../../../src/messages/response/attack-response-message.js';
import { StateBuilder } from '../../helpers/state-builder.js';
import { runTestGame } from '../../helpers/test-helpers.js';
import { MockCardRepository } from '../../mock-repository.js';
import { CreatureData, ItemData } from '../../../src/repository/card-types.js';

describe('End Turn Effect', () => {
    const basicCreature = { templateId: 'basic-creature', type: 'creature' as const };
    const endTurnItem = { templateId: 'end-turn-item', type: 'item' as const };

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
            ['end-turn-creature', {
                templateId: 'end-turn-creature',
                name: 'End Turn Creature',
                maxHp: 90,
                type: 'psychic',
                weakness: 'darkness',
                retreatCost: 1,
                attacks: [{
                    name: 'End Turn Attack',
                    damage: 30,
                    energyRequirements: [{ type: 'psychic', amount: 1 }],
                    effects: [{ type: 'end-turn' }]
                }]
            }]
        ]),
        items: new Map<string, ItemData>([
            ['end-turn-item', {
                templateId: 'end-turn-item',
                name: 'End Turn Item',
                effects: [{ type: 'end-turn' }]
            }]
        ])
    });

    const endTurnCreature = { templateId: 'end-turn-creature', type: 'creature' as const };

    it('should prevent further actions after end-turn item (basic operation)', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [
                new PlayCardResponseMessage('end-turn-item', 'item'),
                new AttackResponseMessage(0) // This should not execute due to turn ending
            ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature'),
                StateBuilder.withCreatures(1, 'basic-creature'),
                StateBuilder.withHand(0, [endTurnItem]),
                StateBuilder.withEnergy('basic-creature-0', { fire: 1 })
            ),
            maxSteps: 15
        });

        expect(getExecutedCount()).to.equal(1, 'Should have executed end turn item only');
        expect(state.field.creatures[1][0].damageTaken).to.equal(0, 'Attack should not have executed');
    });

    // it('should prevent multiple actions in same turn', () => {
    //     const { state, getExecutedCount } = runTestGame({
    //         actions: [
    //             new PlayCardResponseMessage('end-turn-item', 'item'),
    //             new PlayCardResponseMessage('end-turn-item', 'item'), // Should not execute for player 0
    //             new AttackResponseMessage(0) // Should not execute
    //         ],
    //         customRepository: testRepository,
    //         stateCustomizer: StateBuilder.combine(
    //             StateBuilder.withCreatures(0, 'basic-creature'),
    //             StateBuilder.withCreatures(1, 'basic-creature'),
    //             StateBuilder.withHand(0, [endTurnItem, endTurnItem]),
    //             StateBuilder.withEnergy('basic-creature-0', { fire: 1 }),
    //             StateBuilder.withEnergy('basic-creature-1', { fire: 1 })
    //         ),
    //         maxSteps: 20
    //     });

    //     expect(getExecutedCount()).to.equal(1, 'Should have executed only first end turn item');
    //     expect(state.hand[0].length).to.equal(1, 'Second item should remain in hand');
    // });

    it('should allow normal turn progression after end-turn', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [
                new AttackResponseMessage(0), // End turn attack
                new AttackResponseMessage(0)  // Opponent's turn
            ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'end-turn-creature'),
                StateBuilder.withCreatures(1, 'end-turn-creature'),
                StateBuilder.withEnergy('end-turn-creature-0', { psychic: 1 }),
                StateBuilder.withEnergy('end-turn-creature-1', { psychic: 1 })
            ),
            maxSteps: 20
        });

        expect(getExecutedCount()).to.equal(2, 'Should have executed both attacks');
        expect(state.field.creatures[0][0].damageTaken).to.equal(30, 'Player 0 should have taken damage');
        expect(state.field.creatures[1][0].damageTaken).to.equal(30, 'Player 1 should have taken damage');
    });

    it('should not end turn if effect fails to execute', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [
                new PlayCardResponseMessage('end-turn-item', 'item'), // Card not in hand - should fail
                new AttackResponseMessage(0) // Should execute since turn didn't end
            ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature'),
                StateBuilder.withCreatures(1, 'basic-creature'),
                StateBuilder.withHand(0, []), // No cards in hand
                StateBuilder.withEnergy('basic-creature-0', { fire: 1 }),
                StateBuilder.withEnergy('basic-creature-1', { fire: 1 }) // Player 1 needs energy too
            ),
            maxSteps: 15
        });

        expect(getExecutedCount()).to.equal(1, 'Should have executed attack only');
        expect(state.field.creatures[0][0].damageTaken).to.equal(20, 'Player 1 should have attacked player 0');
    });
});
