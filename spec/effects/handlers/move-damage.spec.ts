import { expect } from 'chai';
import { UseAbilityResponseMessage } from '../../../src/messages/response/use-ability-response-message.js';
import { StateBuilder } from '../../helpers/state-builder.js';
import { runTestGame } from '../../helpers/test-helpers.js';
import { MockCardRepository } from '../../mock-repository.js';
import { MoveDamageEffectHandler } from '../../../src/effects/handlers/move-damage-effect-handler.js';
import { AbilityEffectContext } from '../../../src/effects/effect-context.js';
import { MoveDamageEffect } from '../../../src/repository/effect-types.js';
import { HandlerDataBuilder } from '../../helpers/handler-data-builder.js';

describe('Move Damage Effect', () => {
    describe('canApply', () => {
        const handler = new MoveDamageEffectHandler();

        const effect: MoveDamageEffect = {
            type: 'move-damage',
            amount: { type: 'constant', value: 30 },
            from: { type: 'fixed', player: 'self', position: 'active' },
            to: { type: 'fixed', player: 'opponent', position: 'active' },
        };

        it('should return true when targets are available', () => {
            const handlerData = HandlerDataBuilder.default(
                HandlerDataBuilder.withCreatures(0, 'basic-creature'),
                HandlerDataBuilder.withCreatures(1, 'basic-creature'),
            );
            const context: AbilityEffectContext = { type: 'ability', sourcePlayer: 0, effectName: 'Test', creatureInstanceId: 'inst-0', fieldPosition: 1 };
            const mockRepository = new MockCardRepository();
            expect(handler.canApply(handlerData, effect, context, mockRepository)).to.be.true;
        });
    });

    const testRepository = new MockCardRepository({
        creatures: {
            'basic-creature': {
                templateId: 'basic-creature',
                name: 'Basic Creature',
                maxHp: 100,
                type: 'colorless',
                weakness: 'fighting',
                retreatCost: 1,
                attacks: [{ name: 'Basic Attack', damage: 20, energyRequirements: [] }],
            },
            'unlimited-damage-mover': {
                templateId: 'unlimited-damage-mover',
                name: 'Unlimited Damage Mover',
                maxHp: 130,
                type: 'psychic',
                weakness: 'darkness',
                retreatCost: 2,
                previousStageName: 'Basic Creature',
                attacks: [{ name: 'Soul Attack', damage: 70, energyRequirements: [] }],
                ability: {
                    name: 'Shadow Void',
                    description: 'As often as you like during your turn, you may choose 1 of your Pokémon that has damage on it, and move all of its damage to this Pokémon.',
                    trigger: { type: 'manual', unlimited: true },
                    effects: [{
                        type: 'move-damage',
                        amount: 'all',
                        from: {
                            type: 'single-choice',
                            chooser: 'self',
                            criteria: { player: 'self', location: 'field', fieldCriteria: { hasDamage: true }},
                        },
                        to: { type: 'fixed', player: 'self', position: 'source' },
                    }],
                },
            },
            'bench-only-damage-mover': {
                templateId: 'bench-only-damage-mover',
                name: 'Bench Only Damage Mover',
                maxHp: 90,
                type: 'psychic',
                weakness: 'darkness',
                retreatCost: 2,
                previousStageName: 'Basic Creature',
                attacks: [{ name: 'Spooky Shot', damage: 60, energyRequirements: [] }],
                ability: {
                    name: 'Accept Pain',
                    description: 'Once during your turn, if this Pokemon is on your Bench, you may move 30 damage from your Active Pokemon to this Pokemon.',
                    trigger: { type: 'manual', unlimited: false },
                    effects: [{
                        type: 'move-damage',
                        amount: { type: 'constant', value: 30 },
                        from: { type: 'fixed', player: 'self', position: 'active' },
                        to: { type: 'fixed', player: 'self', position: 'source' },
                    }],
                },
            },
        },
    });

    describe('moving all damage from a chosen creature', () => {
        it('should move all damage from the active to the benched ability user', () => {
            // unlimited-damage-mover at position 1 (bench), active has damage
            const { state, getExecutedCount } = runTestGame({
                actions: [ new UseAbilityResponseMessage(1) ],
                customRepository: testRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature', [ 'unlimited-damage-mover' ]),
                    StateBuilder.withCreatures(1, 'basic-creature'),
                    StateBuilder.withDamage('basic-creature-0', 40),
                ),
            });

            expect(getExecutedCount()).to.equal(1, 'Ability should have been used');
            expect(state.field.creatures[0][0].damageTaken).to.equal(0, 'Active should have no damage after move');
            expect(state.field.creatures[0][1].damageTaken).to.equal(40, 'Mover should have received the damage');
        });

        it('should be usable multiple times per turn (unlimited)', () => {
            // Two benched creatures each with damage; activate twice, each time moving from a different source
            const { getExecutedCount } = runTestGame({
                actions: [
                    new UseAbilityResponseMessage(2), // unlimited-damage-mover is at position 2
                    new UseAbilityResponseMessage(2),
                ],
                customRepository: testRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature', [ 'basic-creature', 'unlimited-damage-mover' ]),
                    StateBuilder.withCreatures(1, 'basic-creature'),
                    StateBuilder.withDamage('basic-creature-0', 40),
                    StateBuilder.withDamage('basic-creature-1', 20),
                ),
            });

            expect(getExecutedCount()).to.equal(2, 'Ability should be usable twice in the same turn');
        });
    });

    describe('moving a fixed amount from active to benched self', () => {
        it('should move 30 damage from active to the benched ability user', () => {
            const { state, getExecutedCount } = runTestGame({
                actions: [ new UseAbilityResponseMessage(1) ],
                customRepository: testRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature', [ 'bench-only-damage-mover' ]),
                    StateBuilder.withCreatures(1, 'basic-creature'),
                    StateBuilder.withDamage('basic-creature-0', 50),
                ),
            });

            expect(getExecutedCount()).to.equal(1, 'Ability should have been used');
            expect(state.field.creatures[0][0].damageTaken).to.equal(20, 'Active should have 20 damage remaining');
            expect(state.field.creatures[0][1].damageTaken).to.equal(30, 'Benched mover should have received 30 damage');
        });

        it('should be usable only once per turn', () => {
            const { state, getExecutedCount } = runTestGame({
                actions: [
                    new UseAbilityResponseMessage(1),
                    new UseAbilityResponseMessage(1),
                ],
                customRepository: testRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature', [ 'bench-only-damage-mover' ]),
                    StateBuilder.withCreatures(1, 'basic-creature'),
                    StateBuilder.withDamage('basic-creature-0', 80),
                ),
            });

            expect(getExecutedCount()).to.equal(1, 'Ability should only be usable once per turn');
            expect(state.field.creatures[0][0].damageTaken).to.equal(50, 'Only 30 damage should have been moved');
        });

        it('should cap amount moved at the source damage', () => {
            const { state, getExecutedCount } = runTestGame({
                actions: [ new UseAbilityResponseMessage(1) ],
                customRepository: testRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature', [ 'bench-only-damage-mover' ]),
                    StateBuilder.withCreatures(1, 'basic-creature'),
                    StateBuilder.withDamage('basic-creature-0', 10),
                ),
            });

            expect(getExecutedCount()).to.equal(1);
            expect(state.field.creatures[0][0].damageTaken).to.equal(0, 'All source damage removed');
            expect(state.field.creatures[0][1].damageTaken).to.equal(10, 'Only 10 moved (source had only 10)');
        });
    });
});
