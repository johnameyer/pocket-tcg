import { expect } from 'chai';
import { PlayCardResponseMessage } from '../src/messages/response/play-card-response-message.js';
import { EvolveResponseMessage } from '../src/messages/response/evolve-response-message.js';
import { EndTurnResponseMessage } from '../src/messages/response/end-turn-response-message.js';
import { AttackResponseMessage } from '../src/messages/response/attack-response-message.js';
import { RetreatResponseMessage } from '../src/messages/response/retreat-response-message.js';
import { DiscardFossilResponseMessage } from '../src/messages/response/discard-fossil-response-message.js';
import { GameCard } from '../src/controllers/card-types.js';
import { FossilData, CreatureData } from '../src/repository/card-types.js';
import { StateBuilder } from './helpers/state-builder.js';
import { runTestGame } from './helpers/test-helpers.js';
import { MockCardRepository } from './mock-repository.js';

const mockFossils: Record<string, FossilData> = {
    'dome-fossil': {
        templateId: 'dome-fossil',
        name: 'Dome Fossil',
        maxHp: 40,
    },
    'helix-fossil': {
        templateId: 'helix-fossil',
        name: 'Helix Fossil',
        maxHp: 40,
    },
};

const fossilEvolutions: Record<string, CreatureData> = {
    'dome-evolution': {
        templateId: 'dome-evolution',
        name: 'Dome Evolution',
        maxHp: 90,
        type: 'rock',
        retreatCost: 2,
        previousStageName: 'Dome Fossil',
        attacks: [{ name: 'Rock Smash', damage: 30, energyRequirements: [{ type: 'fighting', amount: 1 }] }],
    },
};

const fossilRepository = new MockCardRepository({
    fossils: mockFossils,
    creatures: fossilEvolutions,
});

describe('Fossils', () => {

    describe('Playing fossils to the bench', () => {
        it('should play a fossil to the bench from hand', () => {
            const { state, getExecutedCount } = runTestGame({
                actions: [
                    new PlayCardResponseMessage('dome-fossil', 'fossil'),
                ],
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature'),
                    StateBuilder.withHand(0, [{ templateId: 'dome-fossil', type: 'fossil' as const }]),
                ),
                customRepository: fossilRepository,
            });

            expect(getExecutedCount()).to.equal(1, 'Fossil play should be validated');
            // Fossil should be on bench (position 1)
            expect(state.field.creatures[0]).to.have.lengthOf(2, 'Fossil should be on bench');
            expect(state.field.creatures[0][1].evolutionStack[0].templateId).to.equal('dome-fossil');
            // Fossil should be removed from hand
            expect(state.hand[0]).to.have.lengthOf(0, 'Hand should be empty after playing fossil');
        });

        it('should not play fossil when bench is full (3 bench cards)', () => {
            const { state, getExecutedCount } = runTestGame({
                actions: [
                    new PlayCardResponseMessage('dome-fossil', 'fossil'),
                ],
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature', [
                        'basic-creature', 'basic-creature', 'basic-creature',
                    ]),
                    StateBuilder.withHand(0, [{ templateId: 'dome-fossil', type: 'fossil' as const }]),
                ),
                customRepository: fossilRepository,
            });

            expect(getExecutedCount()).to.equal(0, 'Should be blocked when bench is full');
            // Fossil should remain in hand
            expect(state.hand[0]).to.have.lengthOf(1, 'Fossil should remain in hand when bench is full');
        });

        it('should not count fossil as a basic creature in initial draw guarantee', () => {
            // This tests that isBasicCreature returns false for fossil cards
            // by checking that getCard returns 'fossil' type, not 'creature'
            const cardResult = fossilRepository.getCard('dome-fossil');
            expect(cardResult.type).to.equal('fossil', 'Fossil should be returned as fossil type from getCard');
        });
    });

    describe('Fossil HP and knockouts', () => {
        it('should give opponent 1 point when fossil is knocked out', () => {
            // Set up fossil on active position with enough damage to be knocked out
            const { state } = runTestGame({
                actions: [
                    new AttackResponseMessage(0), // Player 1 attacks player 0's active fossil
                ],
                stateCustomizer: StateBuilder.combine(
                    // Player 0 has fossil as active with near-max damage
                    (s) => {
                        s.field.creatures[0] = [
                            {
                                fieldInstanceId: 'dome-fossil-0',
                                evolutionStack: [{ templateId: 'dome-fossil', instanceId: 'dome-fossil-0' }],
                                damageTaken: 20,
                                turnLastPlayed: 1,
                            },
                        ];
                    },
                    StateBuilder.withCreatures(1, 'basic-creature'),
                    StateBuilder.withEnergy('basic-creature-1', { fire: 1 }),
                    StateBuilder.withTurn(1), // Player 1's turn
                ),
                customRepository: fossilRepository,
                playerPosition: 1,
            });

            // Player 1 should have earned a point from knocking out the fossil
            expect(state.points[1]).to.equal(1, 'Opponent should get 1 point for knocking out fossil');
        });

        it('should give opponent 1 point when benched fossil is knocked out', () => {
            const { state } = runTestGame({
                actions: [
                    new AttackResponseMessage(0),
                ],
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature'),
                    // Player 1 has active creature and a fossil on bench with near-max HP
                    (s) => {
                        s.field.creatures[1] = [
                            {
                                fieldInstanceId: 'basic-creature-1',
                                evolutionStack: [{ templateId: 'basic-creature', instanceId: 'basic-creature-1' }],
                                damageTaken: 0,
                                turnLastPlayed: 1,
                            },
                            {
                                fieldInstanceId: 'dome-fossil-bench',
                                evolutionStack: [{ templateId: 'dome-fossil', instanceId: 'dome-fossil-bench' }],
                                damageTaken: 40, // At max HP (40), knocked out
                                turnLastPlayed: 1,
                            },
                        ];
                    },
                    StateBuilder.withEnergy('basic-creature-0', { fire: 1 }),
                ),
                customRepository: fossilRepository,
            });

            // Player 0 should have earned a point from knocking out the bench fossil
            expect(state.points[0]).to.equal(1, 'Should get 1 point for knocking out fossil on bench');
        });
    });

    describe('Fossil retreat prevention', () => {
        it('should prevent retreating when active card is a fossil', () => {
            const { state, getExecutedCount } = runTestGame({
                actions: [
                    new RetreatResponseMessage(0), // Try to retreat fossil
                ],
                stateCustomizer: StateBuilder.combine(
                    // Player 0 has fossil as active with a bench creature
                    (s) => {
                        s.field.creatures[0] = [
                            {
                                fieldInstanceId: 'dome-fossil-0',
                                evolutionStack: [{ templateId: 'dome-fossil', instanceId: 'dome-fossil-0' }],
                                damageTaken: 0,
                                turnLastPlayed: 1,
                            },
                            {
                                fieldInstanceId: 'basic-creature-0-1',
                                evolutionStack: [{ templateId: 'basic-creature', instanceId: 'basic-creature-0-1' }],
                                damageTaken: 0,
                                turnLastPlayed: 1,
                            },
                        ];
                    },
                    StateBuilder.withCreatures(1, 'basic-creature'),
                ),
                customRepository: fossilRepository,
            });

            expect(getExecutedCount()).to.equal(0, 'Retreat should be blocked for fossil');
            // Fossil should still be at position 0 (active)
            expect(state.field.creatures[0][0].evolutionStack[0].templateId).to.equal('dome-fossil');
        });

        it('should allow normal creatures to retreat even with fossil on bench', () => {
            const { state, getExecutedCount } = runTestGame({
                actions: [
                    new RetreatResponseMessage(0), // Retreat active creature to bench
                ],
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature'),
                    // Add fossil to bench
                    (s) => {
                        s.field.creatures[0].push({
                            fieldInstanceId: 'dome-fossil-bench',
                            evolutionStack: [{ templateId: 'dome-fossil', instanceId: 'dome-fossil-bench' }],
                            damageTaken: 0,
                            turnLastPlayed: 1,
                        });
                    },
                    StateBuilder.withCreatures(1, 'basic-creature'),
                    // Creature has enough energy to retreat
                    StateBuilder.withEnergy('basic-creature-0', { fire: 1 }),
                ),
                customRepository: fossilRepository,
            });

            expect(getExecutedCount()).to.equal(1, 'Normal creature should be able to retreat');
            // After retreat, the fossil should now be active
            expect(state.field.creatures[0][0].evolutionStack[0].templateId).to.equal('dome-fossil');
        });
    });

    describe('Fossil evolution', () => {
        it('should allow evolving a fossil on the bench', () => {
            const { state, getExecutedCount } = runTestGame({
                actions: [
                    new EvolveResponseMessage('dome-evolution', 1), // Evolve fossil at bench position 1
                ],
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature'),
                    // Fossil was played last turn, so can evolve now
                    (s) => {
                        s.field.creatures[0].push({
                            fieldInstanceId: 'dome-fossil-bench',
                            evolutionStack: [{ templateId: 'dome-fossil', instanceId: 'dome-fossil-bench' }],
                            damageTaken: 0,
                            turnLastPlayed: 1, // Played on turn 1, current is turn 2 - can evolve
                        });
                    },
                    StateBuilder.withHand(0, [{ templateId: 'dome-evolution', type: 'creature' as const }]),
                    StateBuilder.withCreatures(1, 'basic-creature'),
                ),
                customRepository: fossilRepository,
            });

            expect(getExecutedCount()).to.equal(1, 'Evolution from fossil should succeed');
            // Evolved card should be at bench position 1
            expect(state.field.creatures[0][1].evolutionStack).to.have.lengthOf(2, 'Should have evolution stack of 2');
            expect(state.field.creatures[0][1].evolutionStack[1].templateId).to.equal('dome-evolution');
        });

        it('should allow evolving a fossil that is the active card', () => {
            const { state, getExecutedCount } = runTestGame({
                actions: [
                    new EvolveResponseMessage('dome-evolution', 0), // Evolve active fossil
                ],
                stateCustomizer: StateBuilder.combine(
                    // Fossil as active card
                    (s) => {
                        s.field.creatures[0] = [
                            {
                                fieldInstanceId: 'dome-fossil-0',
                                evolutionStack: [{ templateId: 'dome-fossil', instanceId: 'dome-fossil-0' }],
                                damageTaken: 0,
                                turnLastPlayed: 1,
                            },
                        ];
                    },
                    StateBuilder.withHand(0, [{ templateId: 'dome-evolution', type: 'creature' as const }]),
                    StateBuilder.withCreatures(1, 'basic-creature'),
                ),
                customRepository: fossilRepository,
            });

            expect(getExecutedCount()).to.equal(1, 'Evolution from active fossil should succeed');
            expect(state.field.creatures[0][0].evolutionStack[1].templateId).to.equal('dome-evolution');
        });
    });

    describe('Voluntary fossil discard', () => {
        it('should allow discarding a fossil from the bench', () => {
            const { state, getExecutedCount } = runTestGame({
                actions: [
                    new DiscardFossilResponseMessage(0), // Discard fossil at bench index 0
                ],
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature'),
                    // Add fossil to bench
                    (s) => {
                        s.field.creatures[0].push({
                            fieldInstanceId: 'dome-fossil-bench',
                            evolutionStack: [{ templateId: 'dome-fossil', instanceId: 'dome-fossil-bench' }],
                            damageTaken: 0,
                            turnLastPlayed: 1,
                        });
                    },
                    StateBuilder.withCreatures(1, 'basic-creature'),
                ),
                customRepository: fossilRepository,
            });

            expect(getExecutedCount()).to.equal(1, 'Fossil discard should succeed');
            // Fossil should be removed from bench
            expect(state.field.creatures[0]).to.have.lengthOf(1, 'Bench should be empty after discarding fossil');
            // Fossil should be in discard pile
            expect(state.discard[0].some((c: GameCard) => c.templateId === 'dome-fossil')).to.be.true;
        });

        it('should not award points when fossil is voluntarily discarded', () => {
            const { state, getExecutedCount } = runTestGame({
                actions: [
                    new DiscardFossilResponseMessage(0),
                ],
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature'),
                    (s) => {
                        s.field.creatures[0].push({
                            fieldInstanceId: 'dome-fossil-bench',
                            evolutionStack: [{ templateId: 'dome-fossil', instanceId: 'dome-fossil-bench' }],
                            damageTaken: 0,
                            turnLastPlayed: 1,
                        });
                    },
                    StateBuilder.withCreatures(1, 'basic-creature'),
                ),
                customRepository: fossilRepository,
            });

            expect(getExecutedCount()).to.equal(1, 'Fossil discard should succeed');
            // No points should be awarded to opponent
            expect(state.points[1]).to.equal(0, 'Opponent should not get points for voluntary discard');
        });

        it('should not allow discarding a non-fossil bench card', () => {
            const { state, getExecutedCount } = runTestGame({
                actions: [
                    new DiscardFossilResponseMessage(0), // Try to discard a regular creature
                ],
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature', ['basic-creature']),
                    StateBuilder.withCreatures(1, 'basic-creature'),
                ),
                customRepository: fossilRepository,
            });

            expect(getExecutedCount()).to.equal(0, 'Should not be able to discard a non-fossil card');
            // Bench creature should still be there
            expect(state.field.creatures[0]).to.have.lengthOf(2, 'Bench creature should remain');
        });

        it('should not allow discarding an out-of-range bench index', () => {
            const { state, getExecutedCount } = runTestGame({
                actions: [
                    new DiscardFossilResponseMessage(5), // Invalid bench index
                ],
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature'),
                    (s) => {
                        s.field.creatures[0].push({
                            fieldInstanceId: 'dome-fossil-bench',
                            evolutionStack: [{ templateId: 'dome-fossil', instanceId: 'dome-fossil-bench' }],
                            damageTaken: 0,
                            turnLastPlayed: 1,
                        });
                    },
                    StateBuilder.withCreatures(1, 'basic-creature'),
                ),
                customRepository: fossilRepository,
            });

            expect(getExecutedCount()).to.equal(0, 'Should not discard with invalid bench index');
        });

        it('should clean up energy attached to discarded fossil', () => {
            const { state, getExecutedCount } = runTestGame({
                actions: [
                    new DiscardFossilResponseMessage(0),
                ],
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature'),
                    (s) => {
                        s.field.creatures[0].push({
                            fieldInstanceId: 'dome-fossil-bench',
                            evolutionStack: [{ templateId: 'dome-fossil', instanceId: 'dome-fossil-bench' }],
                            damageTaken: 0,
                            turnLastPlayed: 1,
                        });
                    },
                    StateBuilder.withEnergy('dome-fossil-bench', { fire: 1 }),
                    StateBuilder.withCreatures(1, 'basic-creature'),
                ),
                customRepository: fossilRepository,
            });

            expect(getExecutedCount()).to.equal(1, 'Fossil discard should succeed');
            // Energy attached to the fossil should be cleaned up
            expect(state.energy.attachedEnergyByInstance['dome-fossil-bench']).to.be.undefined;
        });
    });

    describe('Fossil isFossil and getCard', () => {
        it('should correctly identify fossils via isFossil()', () => {
            expect(fossilRepository.isFossil('dome-fossil')).to.be.true;
            expect(fossilRepository.isFossil('basic-creature')).to.be.false;
            expect(fossilRepository.isFossil('dome-evolution')).to.be.false;
        });

        it('should return fossil type from getCard()', () => {
            const card = fossilRepository.getCard('dome-fossil');
            expect(card.type).to.equal('fossil');
        });

        it('should return correct fossil data from getCard()', () => {
            const card = fossilRepository.getCard('dome-fossil');
            expect(card.type).to.equal('fossil');
            if (card.type === 'fossil') {
                expect(card.data.name).to.equal('Dome Fossil');
                expect(card.data.maxHp).to.equal(40);
            }
        });

        it('should return correct creature data for fossil via getCreature()', () => {
            // Fossils are registered as creatures internally for field operations
            const creature = fossilRepository.getCreature('dome-fossil');
            expect(creature.fossil).to.be.true;
            expect(creature.name).to.equal('Dome Fossil');
            expect(creature.maxHp).to.equal(40);
            expect(creature.attacks).to.have.lengthOf(0, 'Fossils have no attacks');
        });

        it('should list all fossil ids', () => {
            const ids = fossilRepository.getAllFossilIds();
            expect(ids).to.include('dome-fossil');
            expect(ids).to.include('helix-fossil');
        });
    });
});
