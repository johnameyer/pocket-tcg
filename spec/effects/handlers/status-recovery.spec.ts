import { expect } from 'chai';
import { runTestGame } from '../../helpers/test-helpers.js';
import { StateBuilder } from '../../helpers/state-builder.js';
import { MockCardRepository } from '../../mock-repository.js';
import { PlayCardResponseMessage } from '../../../src/messages/response/play-card-response-message.js';
import { HandlerDataBuilder } from '../../helpers/handler-data-builder.js';
import { StatusRecoveryEffectHandler } from '../../../src/effects/handlers/status-recovery-effect-handler.js';
import { EffectContextFactory } from '../../../src/effects/effect-context.js';
import { StatusRecoveryEffect } from '../../../src/repository/effect-types.js';

describe('Status Recovery Effect', () => {
    describe('canApply', () => {
        const handler = new StatusRecoveryEffectHandler();
        const mockRepository = new MockCardRepository();

        it('should return true when there is a valid target', () => {
            const handlerData = HandlerDataBuilder.default(
                HandlerDataBuilder.withCreatures(0, 'basic-creature', []),
                HandlerDataBuilder.withCreatures(1, 'basic-creature', []),
            );

            const effect: StatusRecoveryEffect = {
                type: 'status-recovery',
                target: { type: 'fixed', player: 'self', position: 'active' },
            };

            const context = EffectContextFactory.createCardContext(0, 'Test Status Recovery', 'item');
            const result = handler.canApply(handlerData, effect, context, mockRepository);
            
            expect(result).to.be.true;
        });

        it('should return false when there is no creature at target position', () => {
            const handlerData = HandlerDataBuilder.default(
                HandlerDataBuilder.withCreatures(0, 'basic-creature', []),
            );

            const effect: StatusRecoveryEffect = {
                type: 'status-recovery',
                target: { type: 'fixed', player: 'opponent', position: 'active' },
            };

            const context = EffectContextFactory.createCardContext(0, 'Test Status Recovery', 'item');
            const result = handler.canApply(handlerData, effect, context, mockRepository);
            
            expect(result).to.be.false;
        });
    });

    it('should remove all status conditions', () => {
        const testRepository = new MockCardRepository({
            items: new Map([
                [ 'full-heal-item', {
                    templateId: 'full-heal-item',
                    name: 'Full Heal',
                    effects: [{
                        type: 'status-recovery',
                        target: { type: 'fixed', player: 'self', position: 'active' },
                    }],
                }],
            ]),
        });

        const { state } = runTestGame({
            actions: [ new PlayCardResponseMessage('full-heal-item', 'item') ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature'),
                StateBuilder.withCreatures(1, 'basic-creature'),
                StateBuilder.withHand(0, [{ templateId: 'full-heal-item', type: 'item' }]),
                StateBuilder.withStatusEffect(0, 'poison'),
                StateBuilder.withStatusEffect(0, 'burn'),
            ),
        });

        // Check that all status conditions are removed
        const effects = state.statusEffects.activeStatusEffects[0];
        expect(effects).to.have.length(0);
    });

    it('should remove specific status conditions (poison only)', () => {
        const testRepository = new MockCardRepository({
            items: new Map([
                [ 'antidote-item', {
                    templateId: 'antidote-item',
                    name: 'Antidote',
                    effects: [{
                        type: 'status-recovery',
                        target: { type: 'fixed', player: 'self', position: 'active' },
                        conditions: ['poison'],
                    }],
                }],
            ]),
        });

        const { state } = runTestGame({
            actions: [ new PlayCardResponseMessage('full-heal-item', 'item') ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature'),
                StateBuilder.withCreatures(1, 'basic-creature'),
                StateBuilder.withHand(0, [{ templateId: 'antidote-item', type: 'item' }]),
                StateBuilder.withStatusEffect(0, 'poison'),
                StateBuilder.withStatusEffect(0, 'burn'),
            ),
        });

        // Check that poison is removed but burn remains
        const effects = state.statusEffects.activeStatusEffects[0];
        expect(effects).to.have.length(1);
        expect(String(effects[0].type)).to.equal('burn');
    });

    it('should remove multiple specific status conditions', () => {
        const testRepository = new MockCardRepository({
            items: new Map([
                [ 'dual-cure-item', {
                    templateId: 'dual-cure-item',
                    name: 'Dual Cure',
                    effects: [{
                        type: 'status-recovery',
                        target: { type: 'fixed', player: 'self', position: 'active' },
                        conditions: ['poison', 'burn'],
                    }],
                }],
            ]),
        });

        const { state } = runTestGame({
            actions: [ new PlayCardResponseMessage('full-heal-item', 'item') ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature'),
                StateBuilder.withCreatures(1, 'basic-creature'),
                StateBuilder.withHand(0, [{ templateId: 'dual-cure-item', type: 'item' }]),
                StateBuilder.withStatusEffect(0, 'poison'),
                StateBuilder.withStatusEffect(0, 'burn'),
                StateBuilder.withStatusEffect(0, 'paralysis'),
            ),
        });

        // Check that poison and burn are removed but paralysis remains
        const effects = state.statusEffects.activeStatusEffects[0];
        expect(effects).to.have.length(1);
        expect(String(effects[0].type)).to.equal('paralysis');
    });

    it('should cure opponent active creature', () => {
        const testRepository = new MockCardRepository({
            items: new Map([
                [ 'benevolent-heal-item', {
                    templateId: 'benevolent-heal-item',
                    name: 'Benevolent Heal',
                    effects: [{
                        type: 'status-recovery',
                        target: { type: 'fixed', player: 'opponent', position: 'active' },
                    }],
                }],
            ]),
        });

        const { state } = runTestGame({
            actions: [ new PlayCardResponseMessage('full-heal-item', 'item') ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature'),
                StateBuilder.withCreatures(1, 'basic-creature'),
                StateBuilder.withHand(0, [{ templateId: 'benevolent-heal-item', type: 'item' }]),
                StateBuilder.withStatusEffect(1, 'poison'),
            ),
        });

        // Check that opponent's status condition is removed
        const effects = state.statusEffects.activeStatusEffects[1];
        expect(effects).to.have.length(0);
    });
});
