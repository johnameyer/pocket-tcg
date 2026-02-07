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
});
