import { expect } from 'chai';
import { AttackResponseMessage } from '../../../src/messages/response/attack-response-message.js';
import { StateBuilder } from '../../helpers/state-builder.js';
import { runTestGame } from '../../helpers/test-helpers.js';
import { MockCardRepository } from '../../mock-repository.js';
import { CreatureData } from '../../../src/repository/card-types.js';
import { DamageReductionEffectHandler } from '../../../src/effects/handlers/damage-reduction-effect-handler.js';
import { EffectContextFactory } from '../../../src/effects/effect-context.js';
import { DamageReductionEffect } from '../../../src/repository/effect-types.js';
import { HandlerDataBuilder } from '../../helpers/handler-data-builder.js';

describe('Damage Reduction Effect', () => {
    describe('canApply', () => {
        const handler = new DamageReductionEffectHandler();
        const mockRepository = new MockCardRepository();

        it('should return true when target exists', () => {
            const handlerData = HandlerDataBuilder.default(
                HandlerDataBuilder.withCreatures(0, 'defensive-creature', []),
                HandlerDataBuilder.withCreatures(1, 'basic-creature', []),
            );

            const effect: DamageReductionEffect = {
                type: 'damage-reduction',
                amount: { type: 'constant', value: 20 },
                target: { type: 'fixed', player: 'self', position: 'active' },
                duration: { type: 'until-end-of-next-turn' },
            };

            const context = EffectContextFactory.createCardContext(0, 'Test Reduction', 'item');
            const result = handler.canApply(handlerData, effect, context, mockRepository);
            
            expect(result).to.be.true;
        });

        it('should return false when target does not exist (target resolution failure)', () => {
            const handlerData = HandlerDataBuilder.default();

            const effect: DamageReductionEffect = {
                type: 'damage-reduction',
                amount: { type: 'constant', value: 20 },
                target: { type: 'fixed', player: 'self', position: 'active' },
                duration: { type: 'until-end-of-next-turn' },
            };

            const context = EffectContextFactory.createCardContext(0, 'Test Reduction', 'item');
            const result = handler.canApply(handlerData, effect, context, mockRepository);
            
            expect(result).to.be.false;
        });

        it('should return false when targeting bench with no bench creatures (target resolution failure)', () => {
            const handlerData = HandlerDataBuilder.default(
                HandlerDataBuilder.withCreatures(0, 'defensive-creature', []),
            );

            const effect: DamageReductionEffect = {
                type: 'damage-reduction',
                amount: { type: 'constant', value: 20 },
                target: { type: 'single-choice', chooser: 'self', criteria: { player: 'self', location: 'field', position: 'bench' }},
                duration: { type: 'until-end-of-next-turn' },
            };

            const context = EffectContextFactory.createCardContext(0, 'Test Reduction', 'item');
            const result = handler.canApply(handlerData, effect, context, mockRepository);
            
            expect(result).to.be.false;
        });
    });

    const testRepository = new MockCardRepository({
        creatures: new Map<string, CreatureData>([
            [ 'defensive-creature', {
                templateId: 'defensive-creature',
                name: 'Defensive Creature',
                maxHp: 100,
                type: 'metal',
                weakness: 'water', // Changed from 'fire' to avoid weakness with fire attacker
                retreatCost: 2,
                attacks: [{ name: 'Steel Strike', damage: 30, energyRequirements: [{ type: 'metal', amount: 2 }] }],
                ability: {
                    name: 'Steel Armor',
                    trigger: { type: 'passive' },
                    effects: [{
                        type: 'damage-reduction',
                        amount: { type: 'constant', value: 20 },
                        target: { type: 'fixed', player: 'self', position: 'active' },
                        duration: { type: 'while-in-play', instanceId: '' },
                    }],
                },
            }],
            [ 'high-hp-defensive-creature', {
                templateId: 'high-hp-defensive-creature',
                name: 'High HP Defensive Creature',
                maxHp: 180,
                type: 'metal',
                weakness: 'water',
                retreatCost: 3,
                attacks: [{ name: 'Heavy Strike', damage: 40, energyRequirements: [{ type: 'metal', amount: 3 }] }],
                ability: {
                    name: 'Reinforced Armor',
                    trigger: { type: 'passive' },
                    effects: [{
                        type: 'damage-reduction',
                        amount: { type: 'constant', value: 20 },
                        target: { type: 'fixed', player: 'self', position: 'active' },
                        duration: { type: 'while-in-play', instanceId: '' },
                    }],
                },
            }],
            [ 'variable-defense-creature', {
                templateId: 'variable-defense-creature',
                name: 'Variable Defense Creature',
                maxHp: 90,
                type: 'fighting',
                weakness: 'psychic',
                retreatCost: 1,
                attacks: [{ name: 'Counter', damage: 20, energyRequirements: [{ type: 'fighting', amount: 1 }] }],
                ability: {
                    name: 'Adaptive Defense',
                    trigger: { type: 'passive' },
                    effects: [{
                        type: 'damage-reduction',
                        amount: { type: 'player-context-resolved', source: 'current-points', playerContext: 'self' },
                        target: { type: 'fixed', player: 'self', position: 'active' },
                        duration: { type: 'while-in-play', instanceId: '' },
                    }],
                },
            }],
            [ 'high-hp-creature', {
                templateId: 'high-hp-creature',
                name: 'High HP Creature',
                maxHp: 140,
                type: 'fighting',
                weakness: 'psychic',
                retreatCost: 3,
                attacks: [
                    {
                        name: 'Body Slam',
                        damage: 60,
                        energyRequirements: [{ type: 'fighting', amount: 2 }],
                    },
                    {
                        name: 'Mega Punch',
                        damage: 150,
                        energyRequirements: [{ type: 'fighting', amount: 4 }],
                    },
                ],
            }],
        ]),
    });

    it('should reduce damage by 20 during opponent turn (basic operation)', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [ new AttackResponseMessage(0) ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                // TODO remove from pocket-tcg entirely
                StateBuilder.withCreatures(0, 'high-hp-creature'), // Strong attacker
                StateBuilder.withCreatures(1, 'defensive-creature'), // Has damage reduction
                StateBuilder.withEnergy('high-hp-creature-0', { fighting: 2 }),
            ),
            maxSteps: 10,
        });

        expect(getExecutedCount()).to.equal(1, 'Should have executed attack');
        expect(state.field.creatures[1][0].damageTaken).to.equal(40, 'Should deal 40 damage (60 base - 20 reduction)');
    });

    it('should reduce different amounts (variable based on points)', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [ new AttackResponseMessage(0) ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature'),
                StateBuilder.withCreatures(1, 'variable-defense-creature'),
                StateBuilder.withEnergy('basic-creature-0', { fire: 1 }),
                (state) => {
                    state.points = [ 0, 2 ]; // Player 1 has 2 points for reduction
                },
            ),
            maxSteps: 10,
        });

        expect(getExecutedCount()).to.equal(1, 'Should have executed attack');
        expect(state.field.creatures[1][0].damageTaken).to.equal(18, 'Should deal 18 damage (20 base - 2 points reduction)');
    });

    it('should cap reduction at damage dealt (no negative damage)', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [ new AttackResponseMessage(0) ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                // TODO remove from pocket-tcg entirely
                StateBuilder.withCreatures(0, 'basic-creature'), // 20 damage attack
                StateBuilder.withCreatures(1, 'defensive-creature'), // 20 damage reduction
                StateBuilder.withEnergy('basic-creature-0', { fire: 1 }),
            ),
            maxSteps: 10,
        });

        expect(getExecutedCount()).to.equal(1, 'Should have executed attack');
        expect(state.field.creatures[1][0].damageTaken).to.equal(0, 'Should deal 0 damage (reduction equals attack)');
    });

    it('should not reduce damage when no reduction effect is present', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [ new AttackResponseMessage(0) ],
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature'),
                StateBuilder.withCreatures(1, 'high-hp-creature'), // No damage reduction
                StateBuilder.withEnergy('basic-creature-0', { fire: 1 }),
            ),
            maxSteps: 10,
        });

        expect(getExecutedCount()).to.equal(1, 'Should have executed attack');
        expect(state.field.creatures[1][0].damageTaken).to.equal(20, 'Should deal full damage (no reduction)');
    });

    it('should work with high damage attacks', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [ new AttackResponseMessage(1) ], // Use stronger attack
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'high-hp-creature'),
                StateBuilder.withCreatures(1, 'high-hp-defensive-creature'),
                StateBuilder.withEnergy('high-hp-creature-0', { fighting: 4 }),
            ),
            maxSteps: 10,
        });

        expect(getExecutedCount()).to.equal(1, 'Should have executed attack');
        expect(state.field.creatures[1][0].damageTaken).to.equal(130, 'Should deal 130 damage (150 base - 20 reduction)');
    });
});
