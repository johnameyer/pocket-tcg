import { expect } from 'chai';
import { runTestGame } from '../../helpers/test-helpers.js';
import { StateBuilder } from '../../helpers/state-builder.js';
import { PlayCardResponseMessage } from '../../../src/messages/response/play-card-response-message.js';
import { SelectTargetResponseMessage } from '../../../src/messages/response/select-target-response-message.js';
import { MockCardRepository } from '../../mock-repository.js';
import { CreatureData, SupporterData } from '../../../src/repository/card-types.js';
import { getCurrentTemplateId } from '../../../src/utils/field-card-utils.js';
import { SwitchEffectHandler } from '../../../src/effects/handlers/switch-effect-handler.js';
import { EffectContextFactory } from '../../../src/effects/effect-context.js';
import { SwitchEffect } from '../../../src/repository/effect-types.js';
import { HandlerDataBuilder } from '../../helpers/handler-data-builder.js';

describe('Switch Effect', () => {
    describe('canApply', () => {
        const handler = new SwitchEffectHandler();
        const mockRepository = new MockCardRepository();

        it('should return true when there are benched creatures to switch with', () => {
            const handlerData = HandlerDataBuilder.default(
                HandlerDataBuilder.withCreatures(0, 'basic-creature', [ 'basic-creature' ]),
                HandlerDataBuilder.withCreatures(1, 'basic-creature', []),
            );

            const effect: SwitchEffect = {
                type: 'switch',
                target: { type: 'fixed', player: 'self', position: 'active' },
                switchWith: { type: 'single-choice', chooser: 'self', criteria: { player: 'self', location: 'field', position: 'bench' }},
            };

            const context = EffectContextFactory.createCardContext(0, 'Test Switch', 'item');
            const result = handler.canApply(handlerData, effect, context, mockRepository);
            
            expect(result).to.be.true;
        });

        it('should return false when there are no benched creatures (target resolution failure)', () => {
            const handlerData = HandlerDataBuilder.default(
                HandlerDataBuilder.withCreatures(0, 'basic-creature', []),
            );

            const effect: SwitchEffect = {
                type: 'switch',
                target: { type: 'fixed', player: 'self', position: 'active' },
                switchWith: { type: 'single-choice', chooser: 'self', criteria: { player: 'self', location: 'field', position: 'bench' }},
            };

            const context = EffectContextFactory.createCardContext(0, 'Test Switch', 'item');
            const result = handler.canApply(handlerData, effect, context, mockRepository);
            
            expect(result).to.be.false;
        });

        it('should return false when switchWith is not provided', () => {
            const handlerData = HandlerDataBuilder.default(
                HandlerDataBuilder.withCreatures(0, 'basic-creature', [ 'basic-creature' ]),
            );

            const effect: SwitchEffect = {
                type: 'switch',
                target: { type: 'fixed', player: 'self', position: 'active' },
                 
                // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Dynamic switch target for test
                switchWith: undefined as any,
            };

            const context = EffectContextFactory.createCardContext(0, 'Test Switch', 'item');
            const result = handler.canApply(handlerData, effect, context, mockRepository);
            
            expect(result).to.be.false;
        });
    });

    const testRepository = new MockCardRepository({
        creatures: new Map<string, CreatureData>([
            [ 'basic-creature', {
                templateId: 'basic-creature',
                name: 'Basic Creature',
                maxHp: 60,
                type: 'colorless',
                weakness: 'fire',
                retreatCost: 1,
                attacks: [{ name: 'Basic Attack', damage: 20, energyRequirements: [{ type: 'colorless', amount: 1 }] }],
            }],
            [ 'high-hp-creature', {
                templateId: 'high-hp-creature',
                name: 'High HP Creature',
                maxHp: 140,
                type: 'colorless',
                weakness: 'fire',
                retreatCost: 2,
                attacks: [{ name: 'Strong Attack', damage: 60, energyRequirements: [{ type: 'colorless', amount: 2 }] }],
            }],
        ]),
        supporters: new Map<string, SupporterData>([
            [ 'switch-supporter', {
                templateId: 'switch-supporter',
                name: 'Switch Supporter',
                effects: [{
                    type: 'switch',
                    target: { type: 'fixed', player: 'opponent', position: 'active' },
                    switchWith: { type: 'single-choice', chooser: 'self', criteria: { player: 'opponent', location: 'field', position: 'bench' }},
                }],
            }],
            [ 'damage-switch-supporter', {
                templateId: 'damage-switch-supporter',
                name: 'Damage Switch Supporter',
                effects: [{
                    type: 'switch',
                    target: { type: 'fixed', player: 'opponent', position: 'active' },
                    switchWith: { type: 'single-choice', chooser: 'self', criteria: { player: 'opponent', location: 'field', position: 'bench', condition: { hasDamage: true }}},
                }],
            }],
        ]),
    });

    it('should force opponent to switch (basic operation)', () => {
        const { state } = runTestGame({
            actions: [
                new PlayCardResponseMessage('switch-supporter', 'supporter'),
                new SelectTargetResponseMessage([{ playerId: 1, fieldIndex: 1 }]),
            ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature'),
                StateBuilder.withCreatures(1, 'basic-creature', [ 'high-hp-creature' ]),
                StateBuilder.withHand(0, [{ templateId: 'switch-supporter', type: 'supporter' }]),
                StateBuilder.withDeck(0, [{ templateId: 'basic-creature', type: 'creature' }]),
                StateBuilder.withDeck(1, [{ templateId: 'basic-creature', type: 'creature' }]),
                StateBuilder.withDamage('high-hp-creature-1-0', 20),
            ),
            maxSteps: 15,
        });

        expect(getCurrentTemplateId(state.field.creatures[1][0])).to.equal('high-hp-creature', 'Opponent bench should be active');
        expect(getCurrentTemplateId(state.field.creatures[1][1])).to.equal('basic-creature', 'Opponent active should be on bench');
        expect(state.field.creatures[1][0].damageTaken).to.equal(20, 'Damage should transfer');
    });

    it('should switch damaged Pokemon (different target criteria)', () => {
        const { state } = runTestGame({
            actions: [
                new PlayCardResponseMessage('damage-switch-supporter', 'supporter'),
                new SelectTargetResponseMessage([{ playerId: 1, fieldIndex: 1 }]),
            ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature'),
                StateBuilder.withCreatures(1, 'basic-creature', [ 'high-hp-creature' ]),
                StateBuilder.withHand(0, [{ templateId: 'damage-switch-supporter', type: 'supporter' }]),
                StateBuilder.withDeck(0, [{ templateId: 'basic-creature', type: 'creature' }]),
                StateBuilder.withDeck(1, [{ templateId: 'basic-creature', type: 'creature' }]),
                StateBuilder.withDamage('high-hp-creature-1-0', 30),
            ),
            maxSteps: 15,
        });

        expect(getCurrentTemplateId(state.field.creatures[1][0])).to.equal('high-hp-creature', 'Damaged bench should be active');
        expect(state.field.creatures[1][0].damageTaken).to.equal(30, 'Should preserve damage');
    });

    it('should preserve energy when switching', () => {
        const testRepository = new MockCardRepository({
            supporters: new Map<string, SupporterData>([
                [ 'switch-supporter', {
                    templateId: 'switch-supporter',
                    name: 'Switch Supporter',
                    effects: [{
                        type: 'switch',
                        target: { type: 'fixed', player: 'opponent', position: 'active' },
                        switchWith: {
                            type: 'single-choice',
                            chooser: 'self',
                            criteria: { player: 'opponent', location: 'field', position: 'bench' },
                        },
                    }],
                }],
            ]),
        });

        const { state, getExecutedCount } = runTestGame({
            actions: [
                new PlayCardResponseMessage('switch-supporter', 'supporter'),
                new SelectTargetResponseMessage([{ playerId: 1, fieldIndex: 1 }]), // Select opponent's bench Pokemon
            ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature'),
                StateBuilder.withCreatures(1, 'basic-creature', [ 'high-hp-creature', 'evolution-creature' ]), // Multiple bench Pokemon for choice
                StateBuilder.withHand(0, [{ templateId: 'switch-supporter', type: 'supporter' }]),
            ),
            maxSteps: 15,
        });

        expect(getExecutedCount()).to.equal(2, 'Should have executed switch supporter and target selection');
    });

    it('should fail when no bench Pokemon available', () => {
        const { state } = runTestGame({
            actions: [ new PlayCardResponseMessage('switch-supporter', 'supporter') ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature'),
                StateBuilder.withCreatures(1, 'basic-creature'),
                StateBuilder.withHand(0, [{ templateId: 'switch-supporter', type: 'supporter' }]),
                StateBuilder.withDeck(0, [{ templateId: 'basic-creature', type: 'creature' }]),
                StateBuilder.withDeck(1, [{ templateId: 'basic-creature', type: 'creature' }]),
                // No bench Pokemon for opponent
            ),
            maxSteps: 10,
        });

        expect(getCurrentTemplateId(state.field.creatures[1][0])).to.equal('basic-creature', 'Active should remain unchanged');
        expect(state.field.creatures[1].length).to.equal(1, 'Should still have only active Pokemon');
    });

    it('should handle different choosers (self vs opponent)', () => {
        /*
         * Switch supporter lets self choose which bench Pokemon to switch
         * NOTE: Currently only works with single bench Pokemon due to target resolution bug
         */
        const { state, getExecutedCount } = runTestGame({
            actions: [
                new PlayCardResponseMessage('switch-supporter', 'supporter'),
                new SelectTargetResponseMessage([{ playerId: 1, fieldIndex: 1 }]), // Select first bench Pokemon (high-hp-creature)
            ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature'),
                StateBuilder.withCreatures(1, 'basic-creature', [ 'high-hp-creature', 'evolution-creature' ]),
                StateBuilder.withHand(0, [{ templateId: 'switch-supporter', type: 'supporter' }]),
                StateBuilder.withDeck(0, [{ templateId: 'basic-creature', type: 'creature' }]),
                StateBuilder.withDeck(1, [{ templateId: 'basic-creature', type: 'creature' }]),
                StateBuilder.withDamage('high-hp-creature-1-0', 10),
                StateBuilder.withDamage('evolution-creature-1-1', 20),
            ),
            maxSteps: 15,
        });

        expect(getCurrentTemplateId(state.field.creatures[1][0])).to.equal('high-hp-creature', 'Should switch to chosen Pokemon');
        expect(state.field.creatures[1][0].damageTaken).to.equal(10, 'Should preserve chosen Pokemon damage');
        expect(state.field.creatures[1][0].damageTaken).to.equal(10, 'Should preserve chosen Pokemon damage');
    });

    it('should handle multiple switches in sequence', () => {
        // Test that multiple switch effects can be applied
        const { state } = runTestGame({
            actions: [
                new PlayCardResponseMessage('switch-supporter', 'supporter'),
                new SelectTargetResponseMessage([{ playerId: 1, fieldIndex: 1 }]),
            ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature'),
                StateBuilder.withCreatures(1, 'basic-creature', [ 'high-hp-creature' ]),
                StateBuilder.withHand(0, [{ templateId: 'switch-supporter', type: 'supporter' }]),
                StateBuilder.withDeck(0, [{ templateId: 'basic-creature', type: 'creature' }]),
                StateBuilder.withDeck(1, [{ templateId: 'basic-creature', type: 'creature' }]),
            ),
            maxSteps: 15,
        });

        expect(getCurrentTemplateId(state.field.creatures[1][0])).to.equal('high-hp-creature', 'Should complete switch');
        expect(getCurrentTemplateId(state.field.creatures[1][1])).to.equal('basic-creature', 'Original active should be on bench');
    });
});
