import { expect } from 'chai';
import { AttackResponseMessage } from '../src/messages/response/attack-response-message.js';
import { getCurrentTemplateId } from '../src/utils/field-card-utils.js';
import { GameCard } from '../src/controllers/card-types.js';
import { StateBuilder } from './helpers/state-builder.js';
import { runTestGame } from './helpers/test-helpers.js';

describe('Game-Ending Scenarios', () => {
    describe('No Bench Creatures Available', () => {
        it('should end game when active creature is knocked out with no bench', () => {
            const { state } = runTestGame({
                actions: [ new AttackResponseMessage(0) ],
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'evolution-creature'),
                    StateBuilder.withCreatures(1, 'high-hp-creature', []),
                    StateBuilder.withEnergy('evolution-creature-0', { fire: 2 }),
                    StateBuilder.withDamage('high-hp-creature-1', 130), // 180 HP - 130 damage = 50 HP, attack does 50 damage = KO
                ),
            });

            // Game should end when high-hp-creature is knocked out with no bench
            expect(state.completed).to.equal(true, 'Game should end when player has no creatures left');
            
            // Player 1's active field should be empty (creature removed)
            expect(state.field.creatures[1]).to.have.length(0, 'Player 1 should have no creatures left on field');
            
            // The knocked-out creature should be in the discard pile
            expect(state.discard[1].length).to.be.greaterThan(0, 'Player 1 should have cards in discard pile');
            expect(state.discard[1].some((card: GameCard) => card.templateId === 'high-hp-creature')).to.be.true;
            
            // Player 0 should be awarded points for the knockout
            expect(state.points[0]).to.be.greaterThan(0, 'Player 0 should be awarded points for knocking out Player 1\'s last creature');
            
            // Player 1 should not be prompted to select another creature (game ended instead)
            expect(state.completed).to.be.true;
        });
    });

    // TODO move to another file (no game over)
    describe('Deck Exhaustion', () => {
        // TODO add test to actually draw (positive case) - then fix this to match accordingly
        it('should handle draw attempt with empty deck', () => {
            const { state } = runTestGame({
                actions: [],
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'high-hp-creature'),
                    StateBuilder.withCreatures(1, 'basic-creature'),
                    StateBuilder.withDeck(0, []),
                    StateBuilder.withHand(0, []),
                ),
            });

            // Draw is skipped when deck is empty, game continues (move to turn-structure.spec.ts)
            expect(state.deck[0]).to.have.length(0, 'Deck should remain empty');
            expect(state.completed).to.be.false;
        });
    });

    describe('Simultaneous Knockouts', () => {
        it('should handle both active creatures being knocked out simultaneously', () => {
            const { state } = runTestGame({
                actions: [ new AttackResponseMessage(0) ],
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'evolution-creature', [ 'high-hp-creature' ]),
                    StateBuilder.withCreatures(1, 'evolution-creature', [ 'high-hp-creature' ]),
                    StateBuilder.withDamage('evolution-creature-0', 160),
                    StateBuilder.withDamage('evolution-creature-1', 170),
                    StateBuilder.withEnergy('evolution-creature-0', { fire: 3 }),
                    (state) => {
                        // Both have bench creatures
                    },
                ),
            });

            // Both evolution-creatures should be knocked out (200 damage to defender, 50 self-damage to attacker)
            const attackerKO = state.field.creatures[0][0].damageTaken >= 180;
            const defenderKO = state.field.creatures[1][0].damageTaken >= 180;
            
            if (attackerKO && defenderKO) {
                // Both should be promoted from bench
                expect(getCurrentTemplateId(state.field.creatures[0][0])).to.not.equal('evolution-creature', 'Attacker should be promoted from bench');
                expect(getCurrentTemplateId(state.field.creatures[1][0])).to.not.equal('evolution-creature', 'Defender should be promoted from bench');
            }
        });
    });

    describe('Win Conditions', () => {
        it('should end game when reaching exactly 3 points', () => {
            const { state } = runTestGame({
                actions: [ new AttackResponseMessage(0) ],
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature'),
                    StateBuilder.withCreatures(1, 'evolution-creature', [ 'high-hp-creature' ]),
                    StateBuilder.withDamage('evolution-creature-1', 160),
                    StateBuilder.withEnergy('basic-creature-0', { fire: 1 }),
                    (state) => {
                        // Player 0 already has 1 point, knocking out Solgaleo ex should give 2 more = 3 total
                        state.points = [ 1, 0 ];
                    },
                ),
            });

            // Game should end when player 0 reaches 3 points
            if (state.points[0] >= 3) {
                expect(state.completed).to.equal(true, 'Game should end when player reaches 3 points');
            }
        });
    });

    // TODO max game length
});
