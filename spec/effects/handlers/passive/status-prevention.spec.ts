import { expect } from 'chai';
import { AttackResponseMessage } from '../../../../src/messages/response/attack-response-message.js';
import { PlayCardResponseMessage } from '../../../../src/messages/response/play-card-response-message.js';
import { EndTurnResponseMessage } from '../../../../src/messages/response/end-turn-response-message.js';
import { StateBuilder } from '../../../helpers/state-builder.js';
import { runTestGame } from '../../../helpers/test-helpers.js';
import { MockCardRepository } from '../../../mock-repository.js';

describe('Status Prevention Effect', () => {
    const poisonAttacker = { templateId: 'poison-attacker', type: 'creature' as const };
    const basicCreature = { templateId: 'basic-creature', type: 'creature' as const };
    const selfPreventionItem = { templateId: 'self-prevention-item', type: 'item' as const };
    const opponentPreventionItem = { templateId: 'opponent-prevention-item', type: 'item' as const };

    const testRepository = new MockCardRepository({
        creatures: {
            'poison-attacker': {
                templateId: 'poison-attacker',
                name: 'Poison Attacker',
                maxHp: 100,
                type: 'grass',
                weakness: 'fire',
                retreatCost: 1,
                attacks: [{
                    name: 'Poison Sting',
                    damage: 10,
                    energyRequirements: [{ type: 'grass', amount: 1 }],
                    effects: [{
                        type: 'status',
                        condition: 'poison',
                        target: { type: 'fixed', player: 'opponent', position: 'active' },
                    }],
                }],
            },
            'basic-creature': {
                templateId: 'basic-creature',
                name: 'Basic Creature',
                maxHp: 100,
                type: 'colorless',
                weakness: 'lightning',
                retreatCost: 1,
                attacks: [{ name: 'Tackle', damage: 10, energyRequirements: [] }],
            },
        },
        items: {
            /**
             * Played by player 0, targets `self` — player 0's active is protected.
             * Uses `passiveEffect.sourcePlayer` (0) directly for the `self` branch.
             */
            'self-prevention-item': {
                templateId: 'self-prevention-item',
                name: 'Self Status Shield',
                effects: [{
                    type: 'passive',
                    modifier: {
                        type: 'status-prevention',
                        target: { player: 'self', position: 'active' },
                        duration: { type: 'until-end-of-next-turn' },
                    },
                }],
            },
            /**
             * Played by player 1, targets `opponent` — resolves to player 0 via
             * `(passiveEffect.sourcePlayer + 1) % controllers.players.count`
             * with sourcePlayer=1 → 0.
             */
            'opponent-prevention-item': {
                templateId: 'opponent-prevention-item',
                name: 'Opponent Status Shield',
                effects: [{
                    type: 'passive',
                    modifier: {
                        type: 'status-prevention',
                        target: { player: 'opponent', position: 'active' },
                        duration: { type: 'until-end-of-next-turn' },
                    },
                }],
            },
        },
    });

    /**
     * Baseline: without any prevention active, Poison Sting poisons the opponent.
     */
    it('should apply poison when no prevention is active', () => {
        // Player 0 attacks player 1 with a regular poison-attacker.
        const testRepository2 = new MockCardRepository({
            creatures: {
                'poison-attacker': {
                    templateId: 'poison-attacker',
                    name: 'Poison Attacker',
                    maxHp: 100,
                    type: 'grass',
                    weakness: 'fire',
                    retreatCost: 1,
                    attacks: [{
                        name: 'Poison Sting',
                        damage: 10,
                        energyRequirements: [{ type: 'grass', amount: 1 }],
                        effects: [{
                            type: 'status',
                            condition: 'poison',
                            target: { type: 'fixed', player: 'opponent', position: 'active' },
                        }],
                    }],
                },
                'basic-creature': {
                    templateId: 'basic-creature',
                    name: 'Basic Creature',
                    maxHp: 100,
                    type: 'colorless',
                    weakness: 'lightning',
                    retreatCost: 1,
                    attacks: [{ name: 'Tackle', damage: 10, energyRequirements: [] }],
                },
            },
        });

        const { state } = runTestGame({
            actions: [ new AttackResponseMessage(0) ],
            customRepository: testRepository2,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'poison-attacker'),
                StateBuilder.withCreatures(1, 'basic-creature'),
                StateBuilder.withEnergy('poison-attacker-0', { grass: 1 }),
            ),
        });

        // Player 1 should be poisoned
        const effects = state.statusEffects.activeStatusEffects[1];
        expect(effects).to.have.length(1);
        expect(effects[0].type).to.equal('poison');
    });

    /**
     * Player 0's self-prevention shields player 0's active from status.
     * Player 1 attacks player 0 with Poison Sting — player 0 should not be poisoned.
     */
    it('should prevent poison on self when self-prevention is active (self-targeting)', () => {
        // Player 0 plays self-prevention item and ends turn.
        const { state: afterSetup } = runTestGame({
            actions: [
                new PlayCardResponseMessage('self-prevention-item', 'item'),
                new EndTurnResponseMessage(),
            ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature'),
                StateBuilder.withCreatures(1, 'poison-attacker'),
                StateBuilder.withHand(0, [ selfPreventionItem ]),
                StateBuilder.withEnergy('poison-attacker-1', { grass: 1 }),
            ),
        });

        // Player 1 attacks player 0 with Poison Sting.
        const { state } = runTestGame({
            actions: [ new AttackResponseMessage(0) ],
            customRepository: testRepository,
            resumeFrom: afterSetup,
            playerPosition: 1,
        });

        // Player 0's active was protected — no poison.
        const effects = state.statusEffects.activeStatusEffects[0];
        expect(effects).to.have.length(0);
    });

    /**
     * Player 1 plays opponent-prevention targeting "opponent" (= player 0).
     * The player resolution formula `(sourcePlayer + 1) % players.count` with sourcePlayer=1
     * must resolve to player 0, not to 1 - 1 = 0 (which is the same result for 2 players,
     * but the modulo form is the established codebase pattern).
     * Player 1 then attacks player 0 with Poison Sting — player 0 should not be poisoned.
     */
    it('should prevent poison on opponent when opponent-targeting prevention is active (player formula)', () => {
        // Player 0 ends turn so player 1 can act.
        const { state: afterP0Turn } = runTestGame({
            actions: [ new EndTurnResponseMessage() ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature'),
                StateBuilder.withCreatures(1, 'poison-attacker'),
                StateBuilder.withHand(1, [ opponentPreventionItem ]),
                StateBuilder.withEnergy('poison-attacker-1', { grass: 1 }),
            ),
        });

        // Player 1 plays opponent-prevention item, then attacks player 0 with Poison Sting.
        const { state } = runTestGame({
            actions: [
                new PlayCardResponseMessage('opponent-prevention-item', 'item'),
                new AttackResponseMessage(0),
            ],
            customRepository: testRepository,
            resumeFrom: afterP0Turn,
            playerPosition: 1,
        });

        // Player 0's active was protected by the opponent-targeting prevention — no poison.
        const effects = state.statusEffects.activeStatusEffects[0];
        expect(effects).to.have.length(0);
    });
});
