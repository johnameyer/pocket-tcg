import { expect } from 'chai';
import { runTestGame } from '../helpers/test-helpers.js';
import { StateBuilder } from '../helpers/state-builder.js';
import { PlayCardResponseMessage } from '../../src/messages/response/play-card-response-message.js';
import { MockCardRepository } from '../mock-repository.js';
import { SupporterData } from '../../src/repository/card-types.js';

describe('Count Effect Value', () => {
    describe('Field Count', () => {
        it('should count all creatures on field', () => {
            const testRepository = new MockCardRepository({
                supporters: new Map<string, SupporterData>([
                    [ 'field-count-heal', {
                        templateId: 'field-count-heal',
                        name: 'Field Count Heal',
                        effects: [{
                            type: 'hp',
                            amount: {
                                type: 'count',
                                countType: 'field',
                                criteria: {}, // Count all creatures
                            },
                            target: { type: 'fixed', player: 'self', position: 'active' },
                            operation: 'heal',
                        }],
                    }],
                ]),
            });

            const { state } = runTestGame({
                actions: [ new PlayCardResponseMessage('field-count-heal', 'supporter') ],
                customRepository: testRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature', [ 'basic-creature', 'basic-creature' ]),
                    StateBuilder.withCreatures(1, 'basic-creature', [ 'basic-creature' ]),
                    StateBuilder.withHand(0, [{ templateId: 'field-count-heal', type: 'supporter' }]),
                    StateBuilder.withDamage('basic-creature-0', 50),
                ),
            });

            // Should heal by count of all field creatures (3 own + 2 opponent = 5)
            expect(state.field.creatures[0][0].damageTaken).to.equal(45, 'Should heal 5 HP (5 total creatures)');
        });

        it('should count own creatures only', () => {
            const testRepository = new MockCardRepository({
                supporters: new Map<string, SupporterData>([
                    [ 'own-field-count', {
                        templateId: 'own-field-count',
                        name: 'Own Field Count',
                        effects: [{
                            type: 'hp',
                            amount: {
                                type: 'count',
                                countType: 'field',
                                criteria: { player: 'self' },
                            },
                            target: { type: 'fixed', player: 'self', position: 'active' },
                            operation: 'heal',
                        }],
                    }],
                ]),
            });

            const { state } = runTestGame({
                actions: [ new PlayCardResponseMessage('own-field-count', 'supporter') ],
                customRepository: testRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature', [ 'basic-creature', 'basic-creature' ]),
                    StateBuilder.withCreatures(1, 'basic-creature', [ 'basic-creature' ]),
                    StateBuilder.withHand(0, [{ templateId: 'own-field-count', type: 'supporter' }]),
                    StateBuilder.withDamage('basic-creature-0', 30),
                ),
            });

            expect(state.field.creatures[0][0].damageTaken).to.equal(27, 'Should heal 3 HP (3 own creatures)');
        });

        it('should count opponent creatures only', () => {
            const testRepository = new MockCardRepository({
                supporters: new Map<string, SupporterData>([
                    [ 'opp-field-count', {
                        templateId: 'opp-field-count',
                        name: 'Opponent Field Count',
                        effects: [{
                            type: 'hp',
                            amount: {
                                type: 'count',
                                countType: 'field',
                                criteria: { player: 'opponent' },
                            },
                            target: { type: 'fixed', player: 'self', position: 'active' },
                            operation: 'heal',
                        }],
                    }],
                ]),
            });

            const { state } = runTestGame({
                actions: [ new PlayCardResponseMessage('opp-field-count', 'supporter') ],
                customRepository: testRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature'),
                    StateBuilder.withCreatures(1, 'basic-creature', [ 'basic-creature' ]),
                    StateBuilder.withHand(0, [{ templateId: 'opp-field-count', type: 'supporter' }]),
                    StateBuilder.withDamage('basic-creature-0', 30),
                ),
            });

            expect(state.field.creatures[0][0].damageTaken).to.equal(28, 'Should heal 2 HP (2 opponent creatures)');
        });

        it('should count only benched creatures', () => {
            const testRepository = new MockCardRepository({
                supporters: new Map<string, SupporterData>([
                    [ 'bench-count', {
                        templateId: 'bench-count',
                        name: 'Bench Count',
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
                actions: [ new PlayCardResponseMessage('bench-count', 'supporter') ],
                customRepository: testRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature', [ 'basic-creature', 'basic-creature' ]),
                    StateBuilder.withCreatures(1, 'basic-creature', [ 'basic-creature' ]),
                    StateBuilder.withHand(0, [{ templateId: 'bench-count', type: 'supporter' }]),
                    StateBuilder.withDamage('basic-creature-0', 30),
                ),
            });

            // Should count benched creatures only (2 own + 1 opponent = 3)
            expect(state.field.creatures[0][0].damageTaken).to.equal(27, 'Should heal 3 HP (3 benched creatures)');
        });

        it('should count only own benched creatures', () => {
            const testRepository = new MockCardRepository({
                supporters: new Map<string, SupporterData>([
                    [ 'own-bench-count', {
                        templateId: 'own-bench-count',
                        name: 'Own Bench Count',
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
                actions: [ new PlayCardResponseMessage('own-bench-count', 'supporter') ],
                customRepository: testRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature', [ 'basic-creature', 'basic-creature' ]),
                    StateBuilder.withCreatures(1, 'basic-creature', [ 'basic-creature' ]),
                    StateBuilder.withHand(0, [{ templateId: 'own-bench-count', type: 'supporter' }]),
                    StateBuilder.withDamage('basic-creature-0', 30),
                ),
            });

            expect(state.field.creatures[0][0].damageTaken).to.equal(28, 'Should heal 2 HP (2 own benched)');
        });

        it('should count only active creatures', () => {
            const testRepository = new MockCardRepository({
                supporters: new Map<string, SupporterData>([
                    [ 'active-count', {
                        templateId: 'active-count',
                        name: 'Active Count',
                        effects: [{
                            type: 'hp',
                            amount: {
                                type: 'count',
                                countType: 'field',
                                criteria: { position: 'active' },
                            },
                            target: { type: 'fixed', player: 'self', position: 'active' },
                            operation: 'heal',
                        }],
                    }],
                ]),
            });

            const { state } = runTestGame({
                actions: [ new PlayCardResponseMessage('active-count', 'supporter') ],
                customRepository: testRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature', [ 'basic-creature' ]),
                    StateBuilder.withCreatures(1, 'basic-creature', [ 'basic-creature' ]),
                    StateBuilder.withHand(0, [{ templateId: 'active-count', type: 'supporter' }]),
                    StateBuilder.withDamage('basic-creature-0', 30),
                ),
            });

            // Should count only active creatures (1 own + 1 opponent = 2)
            expect(state.field.creatures[0][0].damageTaken).to.equal(28, 'Should heal 2 HP (2 active creatures)');
        });
    });

    describe('Energy Count', () => {
        it('should count all energy on own creatures', () => {
            const testRepository = new MockCardRepository({
                supporters: new Map<string, SupporterData>([
                    [ 'energy-count-heal', {
                        templateId: 'energy-count-heal',
                        name: 'Energy Count Heal',
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
                actions: [ new PlayCardResponseMessage('energy-count-heal', 'supporter') ],
                customRepository: testRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature', [ 'basic-creature' ]),
                    StateBuilder.withHand(0, [{ templateId: 'energy-count-heal', type: 'supporter' }]),
                    StateBuilder.withDamage('basic-creature-0', 50),
                    StateBuilder.withEnergy('basic-creature-0', { fire: 2, water: 1 }),
                    StateBuilder.withEnergy('basic-creature-0-0', { grass: 2 }),
                ),
            });

            // Should count all energy on own creatures (2 fire + 1 water + 2 grass = 5)
            expect(state.field.creatures[0][0].damageTaken).to.equal(45, 'Should heal 5 HP (5 total energy)');
        });

        it('should count energy on active creature only', () => {
            const testRepository = new MockCardRepository({
                supporters: new Map<string, SupporterData>([
                    [ 'active-energy-count', {
                        templateId: 'active-energy-count',
                        name: 'Active Energy Count',
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
                actions: [ new PlayCardResponseMessage('active-energy-count', 'supporter') ],
                customRepository: testRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature', [ 'basic-creature' ]),
                    StateBuilder.withHand(0, [{ templateId: 'active-energy-count', type: 'supporter' }]),
                    StateBuilder.withDamage('basic-creature-0', 50),
                    StateBuilder.withEnergy('basic-creature-0', { fire: 2, water: 1 }),
                    StateBuilder.withEnergy('basic-creature-0-0', { grass: 2 }),
                ),
            });

            // Should count only active creature energy (2 fire + 1 water = 3)
            expect(state.field.creatures[0][0].damageTaken).to.equal(47, 'Should heal 3 HP (3 energy on active)');
        });

        it('should count specific energy types only', () => {
            const testRepository = new MockCardRepository({
                supporters: new Map<string, SupporterData>([
                    [ 'fire-energy-count', {
                        templateId: 'fire-energy-count',
                        name: 'Fire Energy Count',
                        effects: [{
                            type: 'hp',
                            amount: {
                                type: 'count',
                                countType: 'energy',
                                fieldCriteria: { player: 'self' },
                                energyCriteria: { energyTypes: [ 'fire' ] },
                            },
                            target: { type: 'fixed', player: 'self', position: 'active' },
                            operation: 'heal',
                        }],
                    }],
                ]),
            });

            const { state } = runTestGame({
                actions: [ new PlayCardResponseMessage('fire-energy-count', 'supporter') ],
                customRepository: testRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature', [ 'basic-creature' ]),
                    StateBuilder.withHand(0, [{ templateId: 'fire-energy-count', type: 'supporter' }]),
                    StateBuilder.withDamage('basic-creature-0', 50),
                    StateBuilder.withEnergy('basic-creature-0', { fire: 2, water: 1 }),
                    StateBuilder.withEnergy('basic-creature-0-0', { fire: 1, grass: 2 }),
                ),
            });

            // Should count only fire energy (2 + 1 = 3)
            expect(state.field.creatures[0][0].damageTaken).to.equal(47, 'Should heal 3 HP (3 fire energy)');
        });
    });

    describe('Card Count', () => {
        it('should count cards in opponent hand', () => {
            const testRepository = new MockCardRepository({
                supporters: new Map<string, SupporterData>([
                    [ 'opp-hand-count', {
                        templateId: 'opp-hand-count',
                        name: 'Opponent Hand Count',
                        effects: [{
                            type: 'hp',
                            amount: {
                                type: 'count',
                                countType: 'card',
                                player: 'opponent',
                                location: 'hand',
                            },
                            target: { type: 'fixed', player: 'opponent', position: 'active' },
                            operation: 'damage',
                        }],
                    }],
                ]),
            });

            const { state } = runTestGame({
                actions: [ new PlayCardResponseMessage('opp-hand-count', 'supporter') ],
                customRepository: testRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature'),
                    StateBuilder.withCreatures(1, 'high-hp-creature'),
                    StateBuilder.withHand(0, [{ templateId: 'opp-hand-count', type: 'supporter' }]),
                    StateBuilder.withHand(1, [
                        { templateId: 'basic-creature', type: 'creature' },
                        { templateId: 'basic-creature', type: 'creature' },
                        { templateId: 'basic-creature', type: 'creature' },
                        { templateId: 'basic-creature', type: 'creature' },
                    ]),
                ),
            });

            expect(state.field.creatures[1][0].damageTaken).to.equal(4, 'Should deal damage equal to opponent hand (4)');
        });

        it('should count cards in own hand', () => {
            const testRepository = new MockCardRepository({
                supporters: new Map<string, SupporterData>([
                    [ 'own-hand-count', {
                        templateId: 'own-hand-count',
                        name: 'Own Hand Count',
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
                actions: [ new PlayCardResponseMessage('own-hand-count', 'supporter') ],
                customRepository: testRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature'),
                    StateBuilder.withHand(0, [
                        { templateId: 'own-hand-count', type: 'supporter' },
                        { templateId: 'basic-creature', type: 'creature' },
                        { templateId: 'basic-creature', type: 'creature' },
                    ]),
                    StateBuilder.withDamage('basic-creature-0', 30),
                ),
            });

            // After playing supporter, hand size is 2, so heal 2
            expect(state.field.creatures[0][0].damageTaken).to.equal(28, 'Should heal 2 HP (2 cards in hand after play)');
        });

        it('should count cards in discard pile', () => {
            const testRepository = new MockCardRepository({
                supporters: new Map<string, SupporterData>([
                    [ 'discard-count', {
                        templateId: 'discard-count',
                        name: 'Discard Count',
                        effects: [{
                            type: 'hp',
                            amount: {
                                type: 'count',
                                countType: 'card',
                                player: 'self',
                                location: 'discard',
                            },
                            target: { type: 'fixed', player: 'self', position: 'active' },
                            operation: 'heal',
                        }],
                    }],
                ]),
            });

            const { state } = runTestGame({
                actions: [ new PlayCardResponseMessage('discard-count', 'supporter') ],
                customRepository: testRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature'),
                    StateBuilder.withHand(0, [{ templateId: 'discard-count', type: 'supporter' }]),
                    StateBuilder.withDamage('basic-creature-0', 30),
                    (state) => {
                        // Add some cards to discard pile
                        state.discard[0] = [
                            { templateId: 'basic-creature', type: 'creature', instanceId: 'discard-1' },
                            { templateId: 'basic-creature', type: 'creature', instanceId: 'discard-2' },
                            { templateId: 'basic-creature', type: 'creature', instanceId: 'discard-3' },
                        ];
                    },
                ),
            });

            // Should count discard pile (3 creatures + 1 supporter played = 4)
            expect(state.field.creatures[0][0].damageTaken).to.equal(26, 'Should heal 4 HP (4 cards in discard)');
        });
    });

    describe('Damage Count', () => {
        it('should count damage on own active creature', () => {
            const testRepository = new MockCardRepository({
                supporters: new Map<string, SupporterData>([
                    [ 'damage-count-heal', {
                        templateId: 'damage-count-heal',
                        name: 'Damage Count Heal',
                        effects: [{
                            type: 'hp',
                            amount: {
                                type: 'count',
                                countType: 'damage',
                                fieldCriteria: { player: 'self', position: 'active' },
                            },
                            target: { type: 'fixed', player: 'opponent', position: 'active' },
                            operation: 'damage',
                        }],
                    }],
                ]),
            });

            const { state } = runTestGame({
                actions: [ new PlayCardResponseMessage('damage-count-heal', 'supporter') ],
                customRepository: testRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature'),
                    StateBuilder.withCreatures(1, 'high-hp-creature'),
                    StateBuilder.withHand(0, [{ templateId: 'damage-count-heal', type: 'supporter' }]),
                    StateBuilder.withDamage('basic-creature-0', 40),
                ),
            });

            expect(state.field.creatures[1][0].damageTaken).to.equal(40, 'Should deal damage equal to own damage (40)');
        });
    });

    describe('Combination with Multiplication', () => {
        it('should multiply count by constant', () => {
            const testRepository = new MockCardRepository({
                supporters: new Map<string, SupporterData>([
                    [ 'multiplied-bench-count', {
                        templateId: 'multiplied-bench-count',
                        name: 'Multiplied Bench Count',
                        effects: [{
                            type: 'hp',
                            amount: {
                                type: 'multiplication',
                                base: {
                                    type: 'count',
                                    countType: 'field',
                                    criteria: { player: 'self', position: 'bench' },
                                },
                                multiplier: { type: 'constant', value: 10 },
                            },
                            target: { type: 'fixed', player: 'self', position: 'active' },
                            operation: 'heal',
                        }],
                    }],
                ]),
            });

            const { state } = runTestGame({
                actions: [ new PlayCardResponseMessage('multiplied-bench-count', 'supporter') ],
                customRepository: testRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature', [ 'basic-creature', 'basic-creature' ]),
                    StateBuilder.withHand(0, [{ templateId: 'multiplied-bench-count', type: 'supporter' }]),
                    StateBuilder.withDamage('basic-creature-0', 50),
                ),
            });

            // Should heal by (2 benched * 10 = 20)
            expect(state.field.creatures[0][0].damageTaken).to.equal(30, 'Should heal 20 HP (2 benched * 10)');
        });
    });

    describe('Combination with Addition', () => {
        it('should add multiple counts together', () => {
            const testRepository = new MockCardRepository({
                supporters: new Map<string, SupporterData>([
                    [ 'combined-count', {
                        templateId: 'combined-count',
                        name: 'Combined Count',
                        effects: [{
                            type: 'hp',
                            amount: {
                                type: 'addition',
                                values: [
                                    {
                                        type: 'count',
                                        countType: 'field',
                                        criteria: { player: 'self', position: 'bench' },
                                    },
                                    {
                                        type: 'count',
                                        countType: 'field',
                                        criteria: { player: 'opponent', position: 'bench' },
                                    },
                                ],
                            },
                            target: { type: 'fixed', player: 'self', position: 'active' },
                            operation: 'heal',
                        }],
                    }],
                ]),
            });

            const { state } = runTestGame({
                actions: [ new PlayCardResponseMessage('combined-count', 'supporter') ],
                customRepository: testRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature', [ 'basic-creature', 'basic-creature' ]),
                    StateBuilder.withCreatures(1, 'basic-creature', [ 'basic-creature' ]),
                    StateBuilder.withHand(0, [{ templateId: 'combined-count', type: 'supporter' }]),
                    StateBuilder.withDamage('basic-creature-0', 30),
                ),
            });

            // Should heal by (2 own benched + 1 opponent benched = 3)
            expect(state.field.creatures[0][0].damageTaken).to.equal(27, 'Should heal 3 HP (2 own + 1 opp benched)');
        });
    });
});
