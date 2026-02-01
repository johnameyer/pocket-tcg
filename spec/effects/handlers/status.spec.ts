import { expect } from 'chai';
import { runTestGame } from '../../helpers/test-helpers.js';
import { StateBuilder } from '../../helpers/state-builder.js';
import { AttackResponseMessage } from '../../../src/messages/response/attack-response-message.js';
import { EndTurnResponseMessage } from '../../../src/messages/response/end-turn-response-message.js';
import { MockCardRepository } from '../../mock-repository.js';
import { StatusEffectHandler } from '../../../src/effects/handlers/status-effect-handler.js';
import { EffectContextFactory } from '../../../src/effects/effect-context.js';
import { StatusEffect } from '../../../src/repository/effect-types.js';
import { HandlerDataBuilder } from '../../helpers/handler-data-builder.js';

describe('Status Effect', () => {
    describe('canApply', () => {
        const handler = new StatusEffectHandler();
        const mockRepository = new MockCardRepository();

        it('should return true when there is a valid target', () => {
            const handlerData = HandlerDataBuilder.default(
                HandlerDataBuilder.withCreatures(0, 'basic-creature', []),
                HandlerDataBuilder.withCreatures(1, 'basic-creature', []),
            );

            const effect: StatusEffect = {
                type: 'status',
                condition: 'poison',
                target: { type: 'fixed', player: 'opponent', position: 'active' },
            };

            const context = EffectContextFactory.createCardContext(0, 'Test Status', 'item');
            const result = handler.canApply(handlerData, effect, context, mockRepository);
            
            expect(result).to.be.true;
        });

        it('should return false when there is no creature at target position (target resolution failure)', () => {
            const handlerData = HandlerDataBuilder.default(
                HandlerDataBuilder.withCreatures(0, 'basic-creature', []),
            );

            const effect: StatusEffect = {
                type: 'status',
                condition: 'poison',
                target: { type: 'fixed', player: 'opponent', position: 'active' },
            };

            const context = EffectContextFactory.createCardContext(0, 'Test Status', 'item');
            const result = handler.canApply(handlerData, effect, context, mockRepository);
            
            expect(result).to.be.false;
        });

        it('should return false when target is bench but no benched creatures exist (target resolution failure)', () => {
            const handlerData = HandlerDataBuilder.default(
                HandlerDataBuilder.withCreatures(0, 'basic-creature', []),
                HandlerDataBuilder.withCreatures(1, 'basic-creature', []),
            );

            const effect: StatusEffect = {
                type: 'status',
                condition: 'poison',
                target: { type: 'single-choice', chooser: 'self', criteria: { player: 'opponent', location: 'field', position: 'bench' }},
            };

            const context = EffectContextFactory.createCardContext(0, 'Test Status', 'item');
            const result = handler.canApply(handlerData, effect, context, mockRepository);
            
            expect(result).to.be.false;
        });
    });

    it('should apply poison status (basic condition)', () => {
        const testRepository = new MockCardRepository({
            creatures: new Map([
                [ 'poison-creature', {
                    templateId: 'poison-creature',
                    name: 'Poison Creature',
                    maxHp: 80,
                    type: 'grass',
                    weakness: 'fire',
                    retreatCost: 1,
                    attacks: [{
                        name: 'Poison Sting',
                        damage: 20,
                        energyRequirements: [{ type: 'grass', amount: 1 }],
                        effects: [{
                            type: 'status',
                            condition: 'poison',
                            target: { type: 'fixed', player: 'opponent', position: 'active' },
                        }],
                    }],
                }],
            ]),
        });

        const { state } = runTestGame({
            actions: [ new AttackResponseMessage(0) ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'poison-creature'),
                StateBuilder.withCreatures(1, 'basic-creature'),
                StateBuilder.withEnergy('poison-creature-0', { grass: 1 }),
            ),
            maxSteps: 10,
        });

        const effects = state.statusEffects.activeStatusEffects[1] as any[];
        expect(effects).to.have.length(1);
        expect(effects[0].type).to.equal('poison');
    });

    it('should apply different conditions (burn)', () => {
        const testRepository = new MockCardRepository({
            creatures: new Map([
                [ 'burn-creature', {
                    templateId: 'burn-creature',
                    name: 'Burn Creature',
                    maxHp: 90,
                    type: 'fire',
                    weakness: 'water',
                    retreatCost: 1,
                    attacks: [{
                        name: 'Flame Burst',
                        damage: 30,
                        energyRequirements: [{ type: 'fire', amount: 1 }],
                        effects: [{
                            type: 'status',
                            condition: 'burn',
                            target: { type: 'fixed', player: 'opponent', position: 'active' },
                        }],
                    }],
                }],
            ]),
        });

        const { state } = runTestGame({
            actions: [ new AttackResponseMessage(0) ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'burn-creature'),
                StateBuilder.withCreatures(1, 'basic-creature'),
                StateBuilder.withEnergy('burn-creature-0', { fire: 1 }),
            ),
            maxSteps: 10,
        });

        const effects = state.statusEffects.activeStatusEffects[1] as any[];
        expect(effects).to.have.length(1);
        expect(effects[0].type).to.equal('burn');
    });

    it('should target different creature (self-active)', () => {
        const testRepository = new MockCardRepository({
            creatures: new Map([
                [ 'self-status-creature', {
                    templateId: 'self-status-creature',
                    name: 'Self Status Creature',
                    maxHp: 100,
                    type: 'psychic',
                    weakness: 'darkness',
                    retreatCost: 1,
                    attacks: [{
                        name: 'Self Confuse',
                        damage: 50,
                        energyRequirements: [{ type: 'psychic', amount: 1 }],
                        effects: [{
                            type: 'status',
                            condition: 'confusion',
                            target: { type: 'fixed', player: 'self', position: 'active' },
                        }],
                    }],
                }],
            ]),
        });

        const { state } = runTestGame({
            actions: [ new AttackResponseMessage(0) ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'self-status-creature'),
                StateBuilder.withCreatures(1, 'basic-creature'),
                StateBuilder.withEnergy('self-status-creature-0', { psychic: 1 }),
            ),
            maxSteps: 10,
        });

        const effects = state.statusEffects.activeStatusEffects[0] as any[];
        expect(effects).to.have.length(1);
        expect(effects[0].type).to.equal('confusion');
    });

    it('should replace conflicting status effects', () => {
        const testRepository = new MockCardRepository({
            creatures: new Map([
                [ 'multi-status-creature', {
                    templateId: 'multi-status-creature',
                    name: 'Multi Status Creature',
                    maxHp: 100,
                    type: 'psychic',
                    weakness: 'darkness',
                    retreatCost: 1,
                    attacks: [{
                        name: 'Status Overload',
                        damage: 0,
                        energyRequirements: [{ type: 'psychic', amount: 1 }],
                        effects: [
                            {
                                type: 'status',
                                condition: 'sleep',
                                target: { type: 'fixed', player: 'opponent', position: 'active' },
                            },
                            {
                                type: 'status',
                                condition: 'confusion',
                                target: { type: 'fixed', player: 'opponent', position: 'active' },
                            },
                        ],
                    }],
                }],
            ]),
        });

        const { state } = runTestGame({
            actions: [ new AttackResponseMessage(0) ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'multi-status-creature'),
                StateBuilder.withCreatures(1, 'basic-creature'),
                StateBuilder.withEnergy('multi-status-creature-0', { psychic: 1 }),
                StateBuilder.withStatusEffect(1, 'paralysis'),
            ),
            maxSteps: 10,
        });

        const effects = state.statusEffects.activeStatusEffects[1] as any[];
        expect(effects).to.have.length(1);
        expect(effects[0].type).to.equal('confusion', 'Should keep last applied status');
    });

    it('should allow compatible status effects (poison + burn)', () => {
        const testRepository = new MockCardRepository({
            creatures: new Map([
                [ 'toxic-creature', {
                    templateId: 'toxic-creature',
                    name: 'Toxic Creature',
                    maxHp: 110,
                    type: 'grass',
                    weakness: 'fire',
                    retreatCost: 2,
                    attacks: [{
                        name: 'Toxic Burn',
                        damage: 40,
                        energyRequirements: [{ type: 'grass', amount: 2 }],
                        effects: [
                            {
                                type: 'status',
                                condition: 'poison',
                                target: { type: 'fixed', player: 'opponent', position: 'active' },
                            },
                            {
                                type: 'status',
                                condition: 'burn',
                                target: { type: 'fixed', player: 'opponent', position: 'active' },
                            },
                        ],
                    }],
                }],
            ]),
        });

        const { state } = runTestGame({
            actions: [ new AttackResponseMessage(0) ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'toxic-creature'),
                StateBuilder.withCreatures(1, 'basic-creature'),
                StateBuilder.withEnergy('toxic-creature-0', { grass: 2 }),
            ),
            maxSteps: 10,
        });

        const effects = state.statusEffects.activeStatusEffects[1] as any[];
        expect(effects).to.have.length(2);
        const statusTypes = effects.map((e: any) => e.type);
        expect(statusTypes).to.include('poison');
        expect(statusTypes).to.include('burn');
    });

    it('should deal between-turn damage (poison = 10, burn = 20)', () => {
        const testRepository = new MockCardRepository({
            creatures: new Map([
                [ 'toxic-creature', {
                    templateId: 'toxic-creature',
                    name: 'Toxic Creature',
                    maxHp: 110,
                    type: 'grass',
                    weakness: 'fire',
                    retreatCost: 2,
                    attacks: [{
                        name: 'Toxic Burn',
                        damage: 40,
                        energyRequirements: [{ type: 'grass', amount: 2 }],
                        effects: [
                            {
                                type: 'status',
                                condition: 'poison',
                                target: { type: 'fixed', player: 'opponent', position: 'active' },
                            },
                            {
                                type: 'status',
                                condition: 'burn',
                                target: { type: 'fixed', player: 'opponent', position: 'active' },
                            },
                        ],
                    }],
                }],
            ]),
        });

        const { state } = runTestGame({
            actions: [
                new AttackResponseMessage(0),
                new EndTurnResponseMessage(),
            ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'toxic-creature'),
                StateBuilder.withCreatures(1, 'basic-creature'),
                StateBuilder.withEnergy('toxic-creature-0', { grass: 2 }),
            ),
            maxSteps: 15,
        });

        expect(state.field.creatures[1][0].damageTaken).to.equal(60, 'Should take 40 attack + 20 status (capped at 60 HP)');
    });
});
