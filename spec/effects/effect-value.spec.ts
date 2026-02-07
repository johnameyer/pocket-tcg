import { expect } from 'chai';
import { runTestGame } from '../helpers/test-helpers.js';
import { StateBuilder } from '../helpers/state-builder.js';
import { PlayCardResponseMessage } from '../../src/messages/response/play-card-response-message.js';
import { MockCardRepository } from '../mock-repository.js';
import { SupporterData } from '../../src/repository/card-types.js';

describe('Effect Value Calculation', () => {
    describe('Constant Values', () => {
        it('should use constant value (20)', () => {
            const testRepository = new MockCardRepository({
                supporters: new Map<string, SupporterData>([
                    [ 'constant-20', {
                        templateId: 'constant-20',
                        name: 'Constant 20',
                        effects: [{
                            type: 'hp',
                            amount: { type: 'constant', value: 20 },
                            target: { type: 'fixed', player: 'self', position: 'active' },
                            operation: 'heal',
                        }],
                    }],
                ]),
            });

            const { state } = runTestGame({
                actions: [ new PlayCardResponseMessage('constant-20', 'supporter') ],
                customRepository: testRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature'),
                    StateBuilder.withHand(0, [{ templateId: 'constant-20', type: 'supporter' }]),
                    StateBuilder.withDamage('basic-creature-0', 30),
                ),
            });

            expect(state.field.creatures[0][0].damageTaken).to.equal(10, 'Should heal exactly 20');
        });

        it('should use different constant values (50)', () => {
            const testRepository = new MockCardRepository({
                supporters: new Map<string, SupporterData>([
                    [ 'constant-50', {
                        templateId: 'constant-50',
                        name: 'Constant 50',
                        effects: [{
                            type: 'hp',
                            amount: { type: 'constant', value: 50 },
                            target: { type: 'fixed', player: 'self', position: 'active' },
                            operation: 'heal',
                        }],
                    }],
                ]),
            });

            const { state } = runTestGame({
                actions: [ new PlayCardResponseMessage('constant-50', 'supporter') ],
                customRepository: testRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature'),
                    StateBuilder.withHand(0, [{ templateId: 'constant-50', type: 'supporter' }]),
                    StateBuilder.withDamage('basic-creature-0', 40),
                ),
            });

            expect(state.field.creatures[0][0].damageTaken).to.equal(0, 'Should heal all 40 damage');
        });
    });

    describe('Player Context Resolved Values', () => {
        it('should resolve hand-size for self', () => {
            const testRepository = new MockCardRepository({
                supporters: new Map<string, SupporterData>([
                    [ 'hand-size-heal', {
                        templateId: 'hand-size-heal',
                        name: 'Hand Size Heal',
                        effects: [{
                            type: 'hp',
                            amount: { type: 'player-context-resolved', source: 'hand-size', playerContext: 'self' },
                            target: { type: 'fixed', player: 'self', position: 'active' },
                            operation: 'heal',
                        }],
                    }],
                ]),
            });

            const { state } = runTestGame({
                actions: [ new PlayCardResponseMessage('hand-size-heal', 'supporter') ],
                customRepository: testRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature'),
                    StateBuilder.withHand(0, [
                        { templateId: 'hand-size-heal', type: 'supporter' },
                        { templateId: 'basic-creature', type: 'creature' },
                        { templateId: 'basic-creature', type: 'creature' },
                        { templateId: 'basic-creature', type: 'creature' },
                    ]),
                    StateBuilder.withDamage('basic-creature-0', 50),
                ),
            });

            expect(state.field.creatures[0][0].damageTaken).to.equal(47, 'Should heal 3 (hand size after playing)');
        });

        it('should resolve hand-size for opponent', () => {
            const testRepository = new MockCardRepository({
                supporters: new Map<string, SupporterData>([
                    [ 'opp-hand-heal', {
                        templateId: 'opp-hand-heal',
                        name: 'Opponent Hand Heal',
                        effects: [{
                            type: 'hp',
                            amount: { type: 'player-context-resolved', source: 'hand-size', playerContext: 'opponent' },
                            target: { type: 'fixed', player: 'self', position: 'active' },
                            operation: 'heal',
                        }],
                    }],
                ]),
            });

            const { state } = runTestGame({
                actions: [ new PlayCardResponseMessage('opp-hand-heal', 'supporter') ],
                customRepository: testRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature'),
                    StateBuilder.withHand(0, [{ templateId: 'opp-hand-heal', type: 'supporter' }]),
                    StateBuilder.withHand(1, Array(5).fill({ templateId: 'basic-creature', type: 'creature' })),
                    StateBuilder.withDamage('basic-creature-0', 30),
                ),
            });

            expect(state.field.creatures[0][0].damageTaken).to.equal(25, 'Should heal 5 (opponent hand size)');
        });

        it('should resolve current-points', () => {
            const testRepository = new MockCardRepository({
                supporters: new Map<string, SupporterData>([
                    [ 'points-heal', {
                        templateId: 'points-heal',
                        name: 'Points Heal',
                        effects: [{
                            type: 'hp',
                            amount: { type: 'player-context-resolved', source: 'current-points', playerContext: 'self' },
                            target: { type: 'fixed', player: 'self', position: 'active' },
                            operation: 'heal',
                        }],
                    }],
                ]),
            });

            const { state } = runTestGame({
                actions: [ new PlayCardResponseMessage('points-heal', 'supporter') ],
                customRepository: testRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature'),
                    StateBuilder.withHand(0, [{ templateId: 'points-heal', type: 'supporter' }]),
                    StateBuilder.withDamage('basic-creature-0', 30),
                    (state) => {
                        state.points = [ 2, 1 ]; 
                    },
                ),
            });

            expect(state.field.creatures[0][0].damageTaken).to.equal(28, 'Should heal 2 (current points)');
        });

        it('should resolve points-to-win', () => {
            const testRepository = new MockCardRepository({
                supporters: new Map<string, SupporterData>([
                    [ 'points-to-win-heal', {
                        templateId: 'points-to-win-heal',
                        name: 'Points To Win Heal',
                        effects: [{
                            type: 'hp',
                            amount: { type: 'player-context-resolved', source: 'points-to-win', playerContext: 'self' },
                            target: { type: 'fixed', player: 'self', position: 'active' },
                            operation: 'heal',
                        }],
                    }],
                ]),
            });

            const { state } = runTestGame({
                actions: [ new PlayCardResponseMessage('points-to-win-heal', 'supporter') ],
                customRepository: testRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature'),
                    StateBuilder.withHand(0, [{ templateId: 'points-to-win-heal', type: 'supporter' }]),
                    StateBuilder.withDamage('basic-creature-0', 30),
                    (state) => {
                        state.points = [ 1, 0 ]; 
                    },
                ),
            });

            expect(state.field.creatures[0][0].damageTaken).to.equal(28, 'Should heal 2 (3 - 1 = 2 points to win)');
        });
    });

    describe('Multiplication Values', () => {
        it('should multiply by constant (10 x 2)', () => {
            const testRepository = new MockCardRepository({
                supporters: new Map<string, SupporterData>([
                    [ 'multiply-heal', {
                        templateId: 'multiply-heal',
                        name: 'Multiply Heal',
                        effects: [{
                            type: 'hp',
                            amount: {
                                type: 'multiplication',
                                multiplier: { type: 'constant', value: 10 },
                                base: { type: 'constant', value: 2 },
                            },
                            target: { type: 'fixed', player: 'self', position: 'active' },
                            operation: 'heal',
                        }],
                    }],
                ]),
            });

            const { state } = runTestGame({
                actions: [ new PlayCardResponseMessage('multiply-heal', 'supporter') ],
                customRepository: testRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature'),
                    StateBuilder.withHand(0, [{ templateId: 'multiply-heal', type: 'supporter' }]),
                    StateBuilder.withDamage('basic-creature-0', 30),
                ),
            });

            expect(state.field.creatures[0][0].damageTaken).to.equal(10, 'Should heal 20 (10 x 2)');
        });

        it('should multiply by hand size (10 x hand size)', () => {
            const testRepository = new MockCardRepository({
                supporters: new Map<string, SupporterData>([
                    [ 'hand-multiply', {
                        templateId: 'hand-multiply',
                        name: 'Hand Multiply',
                        effects: [{
                            type: 'hp',
                            amount: {
                                type: 'multiplication',
                                multiplier: { type: 'constant', value: 10 },
                                base: { type: 'player-context-resolved', source: 'hand-size', playerContext: 'self' },
                            },
                            target: { type: 'fixed', player: 'self', position: 'active' },
                            operation: 'heal',
                        }],
                    }],
                ]),
            });

            const { state } = runTestGame({
                actions: [ new PlayCardResponseMessage('hand-multiply', 'supporter') ],
                customRepository: testRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature'),
                    StateBuilder.withHand(0, [
                        { templateId: 'hand-multiply', type: 'supporter' },
                        { templateId: 'basic-creature', type: 'creature' },
                        { templateId: 'basic-creature', type: 'creature' },
                    ]),
                    StateBuilder.withDamage('basic-creature-0', 50),
                ),
            });

            expect(state.field.creatures[0][0].damageTaken).to.equal(30, 'Should heal 20 (10 x 2 hand size)');
        });
    });

    describe('Addition Values', () => {
        it('should add multiple values (10 + 5)', () => {
            const testRepository = new MockCardRepository({
                supporters: new Map<string, SupporterData>([
                    [ 'addition-heal', {
                        templateId: 'addition-heal',
                        name: 'Addition Heal',
                        effects: [{
                            type: 'hp',
                            amount: {
                                type: 'addition',
                                values: [
                                    { type: 'constant', value: 10 },
                                    { type: 'constant', value: 5 },
                                ],
                            },
                            target: { type: 'fixed', player: 'self', position: 'active' },
                            operation: 'heal',
                        }],
                    }],
                ]),
            });

            const { state } = runTestGame({
                actions: [ new PlayCardResponseMessage('addition-heal', 'supporter') ],
                customRepository: testRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature'),
                    StateBuilder.withHand(0, [{ templateId: 'addition-heal', type: 'supporter' }]),
                    StateBuilder.withDamage('basic-creature-0', 30),
                ),
            });

            expect(state.field.creatures[0][0].damageTaken).to.equal(15, 'Should heal 15 (10 + 5)');
        });

        it('should add constant + context (20 + hand size)', () => {
            const testRepository = new MockCardRepository({
                supporters: new Map<string, SupporterData>([
                    [ 'mixed-addition', {
                        templateId: 'mixed-addition',
                        name: 'Mixed Addition',
                        effects: [{
                            type: 'hp',
                            amount: {
                                type: 'addition',
                                values: [
                                    { type: 'constant', value: 20 },
                                    { type: 'player-context-resolved', source: 'hand-size', playerContext: 'self' },
                                ],
                            },
                            target: { type: 'fixed', player: 'self', position: 'active' },
                            operation: 'heal',
                        }],
                    }],
                ]),
            });

            const { state } = runTestGame({
                actions: [ new PlayCardResponseMessage('mixed-addition', 'supporter') ],
                customRepository: testRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature'),
                    StateBuilder.withHand(0, [
                        { templateId: 'mixed-addition', type: 'supporter' },
                        { templateId: 'basic-creature', type: 'creature' },
                        { templateId: 'basic-creature', type: 'creature' },
                        { templateId: 'basic-creature', type: 'creature' },
                    ]),
                    StateBuilder.withDamage('basic-creature-0', 50),
                ),
            });

            expect(state.field.creatures[0][0].damageTaken).to.equal(27, 'Should heal 23 (20 + 3 hand size)');
        });
    });

    describe('Player Context Resolved Values', () => {
        it('should resolve opponent hand-size value', () => {
            const testRepository = new MockCardRepository({ 
                supporters: new Map([
                    [ 'opponent-hand-damage', {
                        templateId: 'opponent-hand-damage',
                        name: 'Opponent Hand Damage',
                        effects: [{
                            type: 'hp',
                            amount: { type: 'player-context-resolved', source: 'hand-size', playerContext: 'opponent' },
                            target: { type: 'fixed', player: 'opponent', position: 'active' },
                            operation: 'damage',
                        }],
                    }],
                ]),
            });

            const { state } = runTestGame({
                actions: [ new PlayCardResponseMessage('opponent-hand-damage', 'supporter') ],
                customRepository: testRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature'),
                    StateBuilder.withCreatures(1, 'high-hp-creature'),
                    StateBuilder.withHand(0, [{ templateId: 'opponent-hand-damage', type: 'supporter' }]),
                    StateBuilder.withHand(1, [
                        { templateId: 'basic-creature', type: 'creature' },
                        { templateId: 'basic-creature', type: 'creature' },
                        { templateId: 'basic-creature', type: 'creature' },
                        { templateId: 'basic-creature', type: 'creature' },
                    ]),
                ),
            });

            expect(state.field.creatures[1][0].damageTaken).to.equal(4, 'Should deal damage equal to opponent hand size (4)');
        });

        it('should resolve points-to-win value', () => {
            const testRepository = new MockCardRepository({ 
                supporters: new Map([
                    [ 'points-heal', {
                        templateId: 'points-heal',
                        name: 'Points Heal',
                        effects: [{
                            type: 'hp',
                            amount: { type: 'player-context-resolved', source: 'points-to-win', playerContext: 'self' },
                            target: { type: 'fixed', player: 'self', position: 'active' },
                            operation: 'heal',
                        }],
                    }],
                ]),
            });

            const { state } = runTestGame({
                actions: [ new PlayCardResponseMessage('points-heal', 'supporter') ],
                customRepository: testRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature'),
                    StateBuilder.withHand(0, [{ templateId: 'points-heal', type: 'supporter' }]),
                    StateBuilder.withDamage('basic-creature-0', 30),
                    (state) => {
                        state.points = [ 1, 0 ]; 
                    }, // Player has 1 point, needs 2 more to win
                ),
            });

            expect(state.field.creatures[0][0].damageTaken).to.equal(28, 'Should heal 2 HP (3 points needed - 1 current = 2)');
        });
    });

    describe('Count Values', () => {
        describe('Field Count', () => {
            it('should count all creatures on field', () => {
                const testRepository = new MockCardRepository({
                    supporters: new Map<string, SupporterData>([
                        [ 'count-all-field', {
                            templateId: 'count-all-field',
                            name: 'Count All Field',
                            effects: [{
                                type: 'hp',
                                amount: {
                                    type: 'count',
                                    countType: 'field',
                                    criteria: {},
                                },
                                target: { type: 'fixed', player: 'self', position: 'active' },
                                operation: 'heal',
                            }],
                        }],
                    ]),
                });

                const { state } = runTestGame({
                    actions: [ new PlayCardResponseMessage('count-all-field', 'supporter') ],
                    customRepository: testRepository,
                    stateCustomizer: StateBuilder.combine(
                        StateBuilder.withCreatures(0, 'basic-creature', 'basic-creature', 'basic-creature'),
                        StateBuilder.withCreatures(1, 'basic-creature', 'basic-creature'),
                        StateBuilder.withHand(0, [{ templateId: 'count-all-field', type: 'supporter' }]),
                        StateBuilder.withDamage('basic-creature-0', 30),
                    ),
                });

                // Should count 3 own + 2 opponent = 5 total creatures
                expect(state.field.creatures[0][0].damageTaken).to.equal(25, 'Should heal 5 (total creatures on field)');
            });

            it('should count only benched creatures', () => {
                const testRepository = new MockCardRepository({
                    supporters: new Map<string, SupporterData>([
                        [ 'count-benched', {
                            templateId: 'count-benched',
                            name: 'Count Benched',
                            effects: [{
                                type: 'hp',
                                amount: {
                                    type: 'count',
                                    countType: 'field',
                                    criteria: { position: 'bench' },
                                },
                                target: { type: 'fixed', player: 'self', position: 'active' },
                                operation: 'heal',
                            }],
                        }],
                    ]),
                });

                const { state } = runTestGame({
                    actions: [ new PlayCardResponseMessage('count-benched', 'supporter') ],
                    customRepository: testRepository,
                    stateCustomizer: StateBuilder.combine(
                        StateBuilder.withCreatures(0, 'basic-creature', 'basic-creature', 'basic-creature'),
                        StateBuilder.withCreatures(1, 'basic-creature', 'basic-creature'),
                        StateBuilder.withHand(0, [{ templateId: 'count-benched', type: 'supporter' }]),
                        StateBuilder.withDamage('basic-creature-0', 30),
                    ),
                });

                // Should count 2 own bench + 1 opponent bench = 3 benched
                expect(state.field.creatures[0][0].damageTaken).to.equal(27, 'Should heal 3 (benched creatures)');
            });

            it('should count own benched creatures only', () => {
                const testRepository = new MockCardRepository({
                    supporters: new Map<string, SupporterData>([
                        [ 'count-own-bench', {
                            templateId: 'count-own-bench',
                            name: 'Count Own Bench',
                            effects: [{
                                type: 'hp',
                                amount: {
                                    type: 'count',
                                    countType: 'field',
                                    criteria: { player: 'self', position: 'bench' },
                                },
                                target: { type: 'fixed', player: 'self', position: 'active' },
                                operation: 'heal',
                            }],
                        }],
                    ]),
                });

                const { state } = runTestGame({
                    actions: [ new PlayCardResponseMessage('count-own-bench', 'supporter') ],
                    customRepository: testRepository,
                    stateCustomizer: StateBuilder.combine(
                        StateBuilder.withCreatures(0, 'basic-creature', 'basic-creature', 'basic-creature'),
                        StateBuilder.withCreatures(1, 'basic-creature', 'basic-creature'),
                        StateBuilder.withHand(0, [{ templateId: 'count-own-bench', type: 'supporter' }]),
                        StateBuilder.withDamage('basic-creature-0', 30),
                    ),
                });

                // Should count only 2 own benched
                expect(state.field.creatures[0][0].damageTaken).to.equal(28, 'Should heal 2 (own benched creatures)');
            });
        });

        describe('Card Count', () => {
            it('should count cards in hand', () => {
                const testRepository = new MockCardRepository({
                    supporters: new Map<string, SupporterData>([
                        [ 'count-hand', {
                            templateId: 'count-hand',
                            name: 'Count Hand',
                            effects: [{
                                type: 'hp',
                                amount: {
                                    type: 'count',
                                    countType: 'card',
                                    player: 'self',
                                    location: 'hand',
                                },
                                target: { type: 'fixed', player: 'self', position: 'active' },
                                operation: 'heal',
                            }],
                        }],
                    ]),
                });

                const { state } = runTestGame({
                    actions: [ new PlayCardResponseMessage('count-hand', 'supporter') ],
                    customRepository: testRepository,
                    stateCustomizer: StateBuilder.combine(
                        StateBuilder.withCreatures(0, 'basic-creature'),
                        StateBuilder.withHand(0, [
                            { templateId: 'count-hand', type: 'supporter' },
                            { templateId: 'basic-creature', type: 'creature' },
                            { templateId: 'basic-creature', type: 'creature' },
                            { templateId: 'basic-creature', type: 'creature' },
                        ]),
                        StateBuilder.withDamage('basic-creature-0', 30),
                    ),
                });

                // Should count 3 cards remaining after playing the supporter
                expect(state.field.creatures[0][0].damageTaken).to.equal(27, 'Should heal 3 (cards in hand after playing)');
            });

            it('should count opponent hand', () => {
                const testRepository = new MockCardRepository({
                    supporters: new Map<string, SupporterData>([
                        [ 'count-opp-hand', {
                            templateId: 'count-opp-hand',
                            name: 'Count Opponent Hand',
                            effects: [{
                                type: 'hp',
                                amount: {
                                    type: 'count',
                                    countType: 'card',
                                    player: 'opponent',
                                    location: 'hand',
                                },
                                target: { type: 'fixed', player: 'self', position: 'active' },
                                operation: 'heal',
                            }],
                        }],
                    ]),
                });

                const { state } = runTestGame({
                    actions: [ new PlayCardResponseMessage('count-opp-hand', 'supporter') ],
                    customRepository: testRepository,
                    stateCustomizer: StateBuilder.combine(
                        StateBuilder.withCreatures(0, 'basic-creature'),
                        StateBuilder.withHand(0, [{ templateId: 'count-opp-hand', type: 'supporter' }]),
                        StateBuilder.withHand(1, Array(5).fill({ templateId: 'basic-creature', type: 'creature' })),
                        StateBuilder.withDamage('basic-creature-0', 30),
                    ),
                });

                // Should count 5 cards in opponent's hand
                expect(state.field.creatures[0][0].damageTaken).to.equal(25, 'Should heal 5 (opponent hand size)');
            });
        });

        describe('Energy Count', () => {
            it('should count all energy on own creatures', () => {
                const testRepository = new MockCardRepository({
                    supporters: new Map<string, SupporterData>([
                        [ 'count-energy', {
                            templateId: 'count-energy',
                            name: 'Count Energy',
                            effects: [{
                                type: 'hp',
                                amount: {
                                    type: 'count',
                                    countType: 'energy',
                                    fieldCriteria: { player: 'self' },
                                },
                                target: { type: 'fixed', player: 'self', position: 'active' },
                                operation: 'heal',
                            }],
                        }],
                    ]),
                });

                const { state } = runTestGame({
                    actions: [ new PlayCardResponseMessage('count-energy', 'supporter') ],
                    customRepository: testRepository,
                    stateCustomizer: StateBuilder.combine(
                        StateBuilder.withCreatures(0, 'basic-creature', 'basic-creature'),
                        StateBuilder.withHand(0, [{ templateId: 'count-energy', type: 'supporter' }]),
                        StateBuilder.withEnergy('basic-creature-0', { fire: 2, water: 1 }),
                        StateBuilder.withEnergy('basic-creature-1', { fire: 1 }),
                        StateBuilder.withDamage('basic-creature-0', 30),
                    ),
                });

                // Should count 2+1+1 = 4 energy
                expect(state.field.creatures[0][0].damageTaken).to.equal(26, 'Should heal 4 (total energy on own creatures)');
            });

            it('should count energy on active creature only', () => {
                const testRepository = new MockCardRepository({
                    supporters: new Map<string, SupporterData>([
                        [ 'count-active-energy', {
                            templateId: 'count-active-energy',
                            name: 'Count Active Energy',
                            effects: [{
                                type: 'hp',
                                amount: {
                                    type: 'count',
                                    countType: 'energy',
                                    fieldCriteria: { player: 'self', position: 'active' },
                                },
                                target: { type: 'fixed', player: 'self', position: 'active' },
                                operation: 'heal',
                            }],
                        }],
                    ]),
                });

                const { state } = runTestGame({
                    actions: [ new PlayCardResponseMessage('count-active-energy', 'supporter') ],
                    customRepository: testRepository,
                    stateCustomizer: StateBuilder.combine(
                        StateBuilder.withCreatures(0, 'basic-creature', 'basic-creature'),
                        StateBuilder.withHand(0, [{ templateId: 'count-active-energy', type: 'supporter' }]),
                        StateBuilder.withEnergy('basic-creature-0', { fire: 2, water: 1 }),
                        StateBuilder.withEnergy('basic-creature-1', { fire: 2 }),
                        StateBuilder.withDamage('basic-creature-0', 30),
                    ),
                });

                // Should count only active's 3 energy (not bench's 2)
                expect(state.field.creatures[0][0].damageTaken).to.equal(27, 'Should heal 3 (energy on active only)');
            });
        });

        describe('Damage Count', () => {
            it('should count damage on active creature', () => {
                const testRepository = new MockCardRepository({
                    supporters: new Map<string, SupporterData>([
                        [ 'count-damage', {
                            templateId: 'count-damage',
                            name: 'Count Damage',
                            effects: [{
                                type: 'draw',
                                amount: {
                                    type: 'count',
                                    countType: 'damage',
                                    fieldCriteria: { player: 'self', position: 'active' },
                                },
                            }],
                        }],
                    ]),
                });

                const { state } = runTestGame({
                    actions: [ new PlayCardResponseMessage('count-damage', 'supporter') ],
                    customRepository: testRepository,
                    stateCustomizer: StateBuilder.combine(
                        StateBuilder.withCreatures(0, 'basic-creature'),
                        StateBuilder.withHand(0, [{ templateId: 'count-damage', type: 'supporter' }]),
                        StateBuilder.withDamage('basic-creature-0', 50),
                        StateBuilder.withDeck(0, Array(10).fill({ templateId: 'basic-creature', type: 'creature' })),
                    ),
                });

                // Should draw 50 cards (but limited by deck size of 10)
                expect(state.hand[0].length).to.equal(10, 'Should draw based on damage (limited by deck)');
            });
        });
    });
});
