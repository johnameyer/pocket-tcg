import { expect } from 'chai';
import { runTestGame } from '../helpers/test-helpers.js';
import { StateBuilder } from '../helpers/state-builder.js';
import { PlayCardResponseMessage } from '../../src/messages/response/play-card-response-message.js';
import { MockCardRepository } from '../mock-repository.js';
import { CreatureData, SupporterData } from '../../src/repository/card-types.js';
import { AttachableEnergyType } from '../../src/repository/energy-types.js';

// Helper to create damage-triggered creature
const createDamageReactiveCreature = (id: string, name: string, counterDamage: number): CreatureData => ({
    templateId: id,
    name,
    maxHp: 100,
    type: 'colorless',
    retreatCost: 1,
    attacks: [{ name: 'Basic Attack', damage: 20, energyRequirements: [] }],
    ability: {
        name: 'Counter Strike',
        trigger: { type: 'damaged' },
        effects: [{
            type: 'hp',
            amount: { type: 'constant', value: counterDamage },
            target: { type: 'fixed', player: 'opponent', position: 'active' },
            operation: 'damage',
        }],
    },
});

// Helper to create damage supporter
const createDamageSupporter = (id: string, damage: number): SupporterData => ({
    templateId: id,
    name: 'Damage Supporter',
    effects: [{
        type: 'hp',
        amount: { type: 'constant', value: damage },
        target: { type: 'fixed', player: 'opponent', position: 'active' },
        operation: 'damage',
    }],
});

// Helper to create energy supporter
const createEnergySupporter = (id: string, energyType: AttachableEnergyType): SupporterData => ({
    templateId: id,
    name: 'Energy Supporter',
    effects: [{
        type: 'energy-attach',
        energyType,
        amount: { type: 'constant', value: 1 },
        target: { type: 'fixed', player: 'self', position: 'active' },
    }],
});

describe('Effect Queue - Effects Triggering Other Effects', () => {
    describe('Damage Effects Triggering Other Effects', () => {
        it('should trigger damage-triggered ability when damage effect is applied', () => {
            const repo = new MockCardRepository({
                creatures: new Map([
                    [ 'reactive', createDamageReactiveCreature('reactive', 'Reactive', 10) ],
                ]),
                supporters: new Map([[ 'dmg-sup', createDamageSupporter('dmg-sup', 20) ]]),
            });

            const { state } = runTestGame({
                actions: [ new PlayCardResponseMessage('dmg-sup', 'supporter') ],
                customRepository: repo,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature'),
                    StateBuilder.withCreatures(1, 'reactive'),
                    StateBuilder.withHand(0, [{ templateId: 'dmg-sup', type: 'supporter' }]),
                ),
            });

            expect(state.field.creatures[1][0].damageTaken).to.equal(20);
            expect(state.field.creatures[0][0].damageTaken).to.equal(10);
        });

        it('should handle cascading damage effects', () => {
            const repo = new MockCardRepository({
                creatures: new Map([
                    [ 'reactor', createDamageReactiveCreature('reactor', 'Reactor', 5) ],
                ]),
                supporters: new Map([[ 'dmg', createDamageSupporter('dmg', 20) ]]),
            });

            const { state } = runTestGame({
                actions: [ new PlayCardResponseMessage('dmg', 'supporter') ],
                customRepository: repo,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature'),
                    StateBuilder.withCreatures(1, 'reactor'),
                    StateBuilder.withHand(0, [{ templateId: 'dmg', type: 'supporter' }]),
                ),
            });

            expect(state.field.creatures[1][0].damageTaken).to.equal(20);
            expect(state.field.creatures[0][0].damageTaken).to.equal(5);
        });
    });

    describe('Energy Attachment Triggering Effects', () => {
        it('should trigger energy-attachment ability when energy is attached by supporter', () => {
            const energyReactive: CreatureData = {
                templateId: 'energy-react',
                name: 'Energy React',
                maxHp: 100,
                type: 'fire',
                retreatCost: 1,
                attacks: [{ name: 'Basic Attack', damage: 20, energyRequirements: [] }],
                ability: {
                    name: 'Energy Burst',
                    trigger: { type: 'energy-attachment', energyType: 'fire' },
                    effects: [{
                        type: 'hp',
                        amount: { type: 'constant', value: 10 },
                        target: { type: 'fixed', player: 'opponent', position: 'active' },
                        operation: 'damage',
                    }],
                },
            };

            const repo = new MockCardRepository({
                creatures: new Map([[ 'energy-react', energyReactive ]]),
                supporters: new Map([[ 'e-sup', createEnergySupporter('e-sup', 'fire') ]]),
            });

            const { state } = runTestGame({
                actions: [ new PlayCardResponseMessage('e-sup', 'supporter') ],
                customRepository: repo,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'energy-react'),
                    StateBuilder.withCreatures(1, 'basic-creature'),
                    StateBuilder.withHand(0, [{ templateId: 'e-sup', type: 'supporter' }]),
                ),
            });

            expect(state.field.creatures[1][0].damageTaken).to.equal(10);
        });

        it('should trigger energy-attachment for any energy type when not specified', () => {
            const anyEnergyReactive: CreatureData = {
                templateId: 'any-energy',
                name: 'Any Energy',
                maxHp: 100,
                type: 'water',
                retreatCost: 1,
                attacks: [{ name: 'Basic Attack', damage: 20, energyRequirements: [] }],
                ability: {
                    name: 'Energy Reaction',
                    trigger: { type: 'energy-attachment' },
                    effects: [{ type: 'draw', amount: { type: 'constant', value: 1 }}],
                },
            };

            const repo = new MockCardRepository({
                creatures: new Map([[ 'any-energy', anyEnergyReactive ]]),
                supporters: new Map([[ 'w-sup', createEnergySupporter('w-sup', 'water') ]]),
            });

            const { state } = runTestGame({
                actions: [ new PlayCardResponseMessage('w-sup', 'supporter') ],
                customRepository: repo,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'any-energy'),
                    StateBuilder.withCreatures(1, 'basic-creature'),
                    StateBuilder.withHand(0, [{ templateId: 'w-sup', type: 'supporter' }]),
                    StateBuilder.withDeck(0, [{ templateId: 'basic-creature', type: 'creature' }]),
                ),
            });

            expect(state.hand[0].length).to.equal(1);
        });
    });

    describe('Multiple Effects Triggering Simultaneously', () => {
        it('should process all triggered effects in order', () => {
            const multiReactive: CreatureData = {
                templateId: 'multi',
                name: 'Multi Reactive',
                maxHp: 120,
                type: 'colorless',
                retreatCost: 1,
                attacks: [{ name: 'Basic Attack', damage: 20, energyRequirements: [] }],
                ability: {
                    name: 'Multi Counter',
                    trigger: { type: 'damaged' },
                    effects: [
                        { type: 'hp', amount: { type: 'constant', value: 5 }, target: { type: 'fixed', player: 'opponent', position: 'active' }, operation: 'damage' },
                        { type: 'hp', amount: { type: 'constant', value: 5 }, target: { type: 'fixed', player: 'self', position: 'active' }, operation: 'heal' },
                    ],
                },
            };

            const repo = new MockCardRepository({
                creatures: new Map([[ 'multi', multiReactive ]]),
                supporters: new Map([[ 'dmg', createDamageSupporter('dmg', 20) ]]),
            });

            const { state } = runTestGame({
                actions: [ new PlayCardResponseMessage('dmg', 'supporter') ],
                customRepository: repo,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature'),
                    StateBuilder.withCreatures(1, 'multi'),
                    StateBuilder.withHand(0, [{ templateId: 'dmg', type: 'supporter' }]),
                ),
            });

            expect(state.field.creatures[1][0].damageTaken).to.equal(15);
            expect(state.field.creatures[0][0].damageTaken).to.equal(5);
        });
    });
});
