import { expect } from 'chai';
import { runTestGame } from '../../helpers/test-helpers.js';
import { StateBuilder } from '../../helpers/state-builder.js';
import { PlayCardResponseMessage } from '../../../src/messages/response/play-card-response-message.js';
import { SelectTargetResponseMessage } from '../../../src/messages/response/select-target-response-message.js';
import { MockCardRepository } from '../../mock-repository.js';
import { ItemData, SupporterData } from '../../../src/repository/card-types.js';

describe('HP Effect', () => {
    it('should heal 20 HP (basic operation)', () => {
        const testRepository = new MockCardRepository({
            items: new Map<string, ItemData>([
                ['heal-item', {
                    templateId: 'heal-item',
                    name: 'Heal Item',
                    effects: [{
                        type: 'hp',
                        amount: { type: 'constant', value: 20 },
                        target: { type: 'single-choice', chooser: 'self', criteria: { player: 'self', location: 'field' } },
                        operation: 'heal'
                    }]
                }]
            ])
        });

        const { state } = runTestGame({
            actions: [
                new PlayCardResponseMessage('heal-item', 'item'),
                new SelectTargetResponseMessage(0, 0)
            ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature'),
                StateBuilder.withHand(0, [{ templateId: 'heal-item', type: 'item' }]),
                StateBuilder.withDamage('basic-creature-0', 30)
            ),
            maxSteps: 15
        });

        expect(state.field.creatures[0][0].damageTaken).to.equal(10, 'Should heal 20 damage');
    });

    it('should deal damage instead of heal', () => {
        const testRepository = new MockCardRepository({
            supporters: new Map<string, SupporterData>([
                ['damage-supporter', {
                    templateId: 'damage-supporter',
                    name: 'Damage Supporter',
                    effects: [{
                        type: 'hp',
                        amount: { type: 'constant', value: 30 },
                        target: { type: 'fixed', player: 'opponent', position: 'active' },
                        operation: 'damage'
                    }]
                }]
            ])
        });

        const { state } = runTestGame({
            actions: [new PlayCardResponseMessage('damage-supporter', 'supporter')],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature'),
                StateBuilder.withCreatures(1, 'basic-creature'),
                StateBuilder.withHand(0, [{ templateId: 'damage-supporter', type: 'supporter' }])
            ),
            maxSteps: 10
        });

        expect(state.field.creatures[1][0].damageTaken).to.equal(30, 'Should deal 30 damage');
    });

    it('should heal variable amounts (60 HP)', () => {
        const testRepository = new MockCardRepository({
            supporters: new Map<string, SupporterData>([
                ['big-heal', {
                    templateId: 'big-heal',
                    name: 'Big Heal',
                    effects: [{
                        type: 'hp',
                        amount: { type: 'constant', value: 60 },
                        target: { type: 'fixed', player: 'self', position: 'active' },
                        operation: 'heal'
                    }]
                }]
            ])
        });

        const { state } = runTestGame({
            actions: [new PlayCardResponseMessage('big-heal', 'supporter')],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature'),
                StateBuilder.withHand(0, [{ templateId: 'big-heal', type: 'supporter' }]),
                StateBuilder.withDamage('basic-creature-0', 50)
            ),
            maxSteps: 10
        });

        expect(state.field.creatures[0][0].damageTaken).to.equal(0, 'Should heal 50 damage completely');
    });

    it('should target all matching creatures', () => {
        const testRepository = new MockCardRepository({
            supporters: new Map<string, SupporterData>([
                ['mass-heal', {
                    templateId: 'mass-heal',
                    name: 'Mass Heal',
                    effects: [{
                        type: 'hp',
                        amount: { type: 'constant', value: 20 },
                        target: {
                            type: 'all-matching',
                            criteria: { player: 'self', location: 'field', condition: { hasDamage: true } }
                        },
                        operation: 'heal'
                    }]
                }]
            ])
        });

        const { state } = runTestGame({
            actions: [new PlayCardResponseMessage('mass-heal', 'supporter')],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature', ['basic-creature']),
                StateBuilder.withHand(0, [{ templateId: 'mass-heal', type: 'supporter' }]),
                StateBuilder.withDamage('basic-creature-0', 30),
                StateBuilder.withDamage('basic-creature-0-0', 25)
            ),
            maxSteps: 10
        });

        expect(state.field.creatures[0][0].damageTaken).to.equal(10, 'Should heal active creature');
        expect(state.field.creatures[0][1].damageTaken).to.equal(5, 'Should heal bench creature');
    });

    it('should cap healing at current damage', () => {
        const testRepository = new MockCardRepository({
            items: new Map<string, ItemData>([
                ['small-heal', {
                    templateId: 'small-heal',
                    name: 'Small Heal',
                    effects: [{
                        type: 'hp',
                        amount: { type: 'constant', value: 20 },
                        target: { type: 'fixed', player: 'self', position: 'active' },
                        operation: 'heal'
                    }]
                }]
            ])
        });

        const { state } = runTestGame({
            actions: [new PlayCardResponseMessage('small-heal', 'item')],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature'),
                StateBuilder.withHand(0, [{ templateId: 'small-heal', type: 'item' }]),
                StateBuilder.withDamage('basic-creature-0', 10)
            ),
            maxSteps: 10
        });

        expect(state.field.creatures[0][0].damageTaken).to.equal(0, 'Should heal only to 0');
    });

    it('should cap damage at remaining HP', () => {
        const testRepository = new MockCardRepository({
            supporters: new Map<string, SupporterData>([
                ['overkill', {
                    templateId: 'overkill',
                    name: 'Overkill',
                    effects: [{
                        type: 'hp',
                        amount: { type: 'constant', value: 100 },
                        target: { type: 'fixed', player: 'opponent', position: 'active' },
                        operation: 'damage'
                    }]
                }]
            ])
        });

        const { state } = runTestGame({
            actions: [new PlayCardResponseMessage('overkill', 'supporter')],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature'),
                StateBuilder.withCreatures(1, 'basic-creature'),
                StateBuilder.withHand(0, [{ templateId: 'overkill', type: 'supporter' }]),
                StateBuilder.withDamage('basic-creature-1', 20)
            ),
            maxSteps: 10
        });

        expect(state.field.creatures[1][0].damageTaken).to.equal(60, 'Should cap at max HP');
    });
});
