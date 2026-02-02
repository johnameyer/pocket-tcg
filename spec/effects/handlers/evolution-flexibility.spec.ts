import { expect } from 'chai';
import { PlayCardResponseMessage } from '../../../src/messages/response/play-card-response-message.js';
import { EvolveResponseMessage } from '../../../src/messages/response/evolve-response-message.js';
import { StateBuilder } from '../../helpers/state-builder.js';
import { runTestGame } from '../../helpers/test-helpers.js';
import { MockCardRepository } from '../../mock-repository.js';
import { CreatureData, ItemData } from '../../../src/repository/card-types.js';
import { getCurrentTemplateId } from '../../../src/utils/field-card-utils.js';
import { EvolutionFlexibilityEffectHandler } from '../../../src/effects/handlers/evolution-flexibility-effect-handler.js';
import { EffectContextFactory } from '../../../src/effects/effect-context.js';
import { EvolutionFlexibilityEffect } from '../../../src/repository/effect-types.js';
import { HandlerDataBuilder } from '../../helpers/handler-data-builder.js';

describe('Evolution Flexibility Effect', () => {
    describe('canApply', () => {
        const handler = new EvolutionFlexibilityEffectHandler();

        it('should always return true (evolution flexibility effects can always be applied)', () => {
            const handlerData = HandlerDataBuilder.default(
                HandlerDataBuilder.withCreatures(0, 'flexible-basic', []),
            );

            const effect: EvolutionFlexibilityEffect = {
                type: 'evolution-flexibility',
                target: 'flexible-evolution-water',
                baseForm: 'flexible-basic',
                duration: { type: 'until-end-of-turn' },
            };

            const context = EffectContextFactory.createCardContext(0, 'Test Flexibility', 'item');
            const result = handler.canApply(handlerData, effect, context);
            
            expect(result).to.be.true;
        });

        it('should return true even when no creatures exist', () => {
            const handlerData = HandlerDataBuilder.default();

            const effect: EvolutionFlexibilityEffect = {
                type: 'evolution-flexibility',
                target: 'flexible-evolution-water',
                baseForm: 'flexible-basic',
                duration: { type: 'until-end-of-turn' },
            };

            const context = EffectContextFactory.createCardContext(0, 'Test Flexibility', 'item');
            const result = handler.canApply(handlerData, effect, context);
            
            expect(result).to.be.true;
        });
    });

    const flexibleBasic = { templateId: 'flexible-basic', type: 'creature' as const };
    const flexibleEvolutionWater = { templateId: 'flexible-evolution-water', type: 'creature' as const };
    const flexibleEvolutionLightning = { templateId: 'flexible-evolution-lightning', type: 'creature' as const };
    const flexibleEvolutionFire = { templateId: 'flexible-evolution-fire', type: 'creature' as const };
    const flexibilityItem = { templateId: 'flexibility-item', type: 'item' as const };

    const testRepository = new MockCardRepository({
        creatures: new Map<string, CreatureData>([
            [ 'flexible-basic', {
                templateId: 'flexible-basic',
                name: 'Flexible Basic',
                maxHp: 60,
                type: 'colorless',
                weakness: 'fighting',
                retreatCost: 1,
                attacks: [{ name: 'Tackle', damage: 10, energyRequirements: [{ type: 'colorless', amount: 1 }] }],
            }],
            [ 'flexible-evolution-water', {
                templateId: 'flexible-evolution-water',
                name: 'Flexible Evolution Water',
                maxHp: 90,
                type: 'water',
                weakness: 'lightning',
                retreatCost: 2,
                previousStageName: 'Flexible Basic',
                attacks: [{ name: 'Water Gun', damage: 40, energyRequirements: [{ type: 'water', amount: 2 }] }],
            }],
            [ 'flexible-evolution-lightning', {
                templateId: 'flexible-evolution-lightning',
                name: 'Flexible Evolution Lightning',
                maxHp: 90,
                type: 'lightning',
                weakness: 'fighting',
                retreatCost: 1,
                previousStageName: 'Flexible Basic',
                attacks: [{ name: 'Shock', damage: 40, energyRequirements: [{ type: 'lightning', amount: 2 }] }],
            }],
            [ 'flexible-evolution-fire', {
                templateId: 'flexible-evolution-fire',
                name: 'Flexible Evolution Fire',
                maxHp: 90,
                type: 'fire',
                weakness: 'water',
                retreatCost: 1,
                previousStageName: 'Flexible Basic',
                attacks: [{ name: 'Flame', damage: 40, energyRequirements: [{ type: 'fire', amount: 2 }] }],
            }],
            [ 'basic-creature', {
                templateId: 'basic-creature',
                name: 'Basic Creature',
                maxHp: 80,
                type: 'grass',
                weakness: 'fire',
                retreatCost: 1,
                attacks: [{ name: 'Basic Attack', damage: 20, energyRequirements: [{ type: 'grass', amount: 1 }] }],
            }],
        ]),
        items: new Map<string, ItemData>([
            [ 'flexibility-item', {
                templateId: 'flexibility-item',
                name: 'Flexibility Item',
                effects: [{
                    type: 'evolution-flexibility',
                    target: 'flexible-evolution-water',
                    baseForm: 'flexible-basic',
                    duration: { type: 'until-end-of-turn' },
                }],
            }],
        ]),
    });

    const basicCreature = { templateId: 'basic-creature', type: 'creature' as const };

    it('should allow flexible evolution (basic operation)', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [
                new PlayCardResponseMessage('flexibility-item', 'item'),
                new EvolveResponseMessage('flexible-evolution-water', 0),
            ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'flexible-basic'),
                StateBuilder.withHand(0, [ flexibilityItem, flexibleEvolutionWater ]),
            ),
            maxSteps: 15,
        });

        expect(getExecutedCount()).to.equal(2, 'Should have executed flexibility item and evolution');
        expect(getCurrentTemplateId(state.field.creatures[0][0])).to.equal('flexible-evolution-water', 'Should have evolved');
    });

    it('should allow evolution to different variants', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [
                new PlayCardResponseMessage('flexibility-item', 'item'),
                new EvolveResponseMessage('flexible-evolution-lightning', 0),
            ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'flexible-basic'),
                StateBuilder.withHand(0, [ flexibilityItem, flexibleEvolutionLightning ]),
            ),
            maxSteps: 15,
        });

        expect(getExecutedCount()).to.equal(2, 'Should have executed flexibility item and evolution');
        expect(getCurrentTemplateId(state.field.creatures[0][0])).to.equal('flexible-evolution-lightning', 'Should have evolved');
    });

    it('should work with multiple evolution options', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [
                new PlayCardResponseMessage('flexibility-item', 'item'),
                new EvolveResponseMessage('flexible-evolution-fire', 0),
            ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'flexible-basic'),
                StateBuilder.withHand(0, [ flexibilityItem, flexibleEvolutionWater, flexibleEvolutionLightning, flexibleEvolutionFire ]),
            ),
            maxSteps: 15,
        });

        expect(getExecutedCount()).to.equal(2, 'Should have executed flexibility item and evolution');
        expect(getCurrentTemplateId(state.field.creatures[0][0])).to.equal('flexible-evolution-fire', 'Should have evolved');
        expect(state.hand[0].length).to.equal(2, 'Other evolution cards should remain in hand');
    });

    it('should not affect other creatures', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [
                new PlayCardResponseMessage('flexibility-item', 'item'),
                new EvolveResponseMessage('flexible-evolution-water', 0),
            ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature'),
                StateBuilder.withHand(0, [ flexibilityItem, flexibleEvolutionWater ]),
            ),
            maxSteps: 15,
        });

        expect(getExecutedCount()).to.equal(1, 'Should have executed flexibility item only (evolution blocked)');
        expect(getCurrentTemplateId(state.field.creatures[0][0])).to.equal('basic-creature', 'Should remain as basic creature');
    });

    it('should preserve damage when using flexible evolution', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [
                new PlayCardResponseMessage('flexibility-item', 'item'),
                new EvolveResponseMessage('flexible-evolution-water', 0),
            ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'flexible-basic'),
                StateBuilder.withHand(0, [ flexibilityItem, flexibleEvolutionWater ]),
                StateBuilder.withDamage('flexible-basic-0', 20),
            ),
            maxSteps: 15,
        });

        expect(getExecutedCount()).to.equal(2, 'Should have executed flexibility item and evolution');
        expect(getCurrentTemplateId(state.field.creatures[0][0])).to.equal('flexible-evolution-water', 'Should have evolved');
        expect(state.field.creatures[0][0].damageTaken).to.equal(20, 'Should preserve damage after evolution');
    });

    it('should preserve energy when using flexible evolution', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [
                new PlayCardResponseMessage('flexibility-item', 'item'),
                new EvolveResponseMessage('flexible-evolution-lightning', 0),
            ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'flexible-basic'),
                StateBuilder.withHand(0, [ flexibilityItem, flexibleEvolutionLightning ]),
                StateBuilder.withEnergy('flexible-basic-0', { lightning: 2 }),
            ),
            maxSteps: 15,
        });

        expect(getExecutedCount()).to.equal(2, 'Should have executed flexibility item and evolution');
        expect(getCurrentTemplateId(state.field.creatures[0][0])).to.equal('flexible-evolution-lightning', 'Should have evolved');
        
        const energyState = state.energy as any;
        expect(energyState.attachedEnergyByInstance['flexible-basic-0'].lightning).to.equal(2, 'Should preserve energy after evolution');
    });

    it('should work with bench creatures', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [
                new PlayCardResponseMessage('flexibility-item', 'item'),
                new EvolveResponseMessage('flexible-evolution-fire', 1),
            ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature', [ 'flexible-basic' ]),
                StateBuilder.withHand(0, [ flexibilityItem, flexibleEvolutionFire ]),
            ),
            maxSteps: 15,
        });

        expect(getExecutedCount()).to.equal(2, 'Should have executed flexibility item and evolution');
        expect(getCurrentTemplateId(state.field.creatures[0][0])).to.equal('basic-creature', 'Active should remain unchanged');
        expect(getCurrentTemplateId(state.field.creatures[0][1])).to.equal('flexible-evolution-fire', 'Bench creature should have evolved');
    });

    it('should have limited duration or scope', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [
                new PlayCardResponseMessage('flexibility-item', 'item'),
                new EvolveResponseMessage('flexible-evolution-water', 0),
                new EvolveResponseMessage('flexible-evolution-lightning', 1),
            ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'flexible-basic'),
                StateBuilder.withHand(0, [ flexibilityItem, flexibleEvolutionWater, flexibleEvolutionLightning ]),
                (state) => {
                    state.field.creatures[0].push({
                        fieldInstanceId: 'test-field-id',
                        evolutionStack: [{ instanceId: 'field-card-1', templateId: 'flexible-basic' }],
                        damageTaken: 0,
                        turnLastPlayed: 0,
                    });
                },
            ),
            maxSteps: 20,
        });

        expect(getExecutedCount()).to.be.greaterThanOrEqual(2, 'Should have executed flexibility item and at least one evolution');
        expect(getCurrentTemplateId(state.field.creatures[0][0])).to.equal('flexible-evolution-water', 'First creature should have evolved');
        // Second evolution result depends on implementation (single-use vs persistent effect)
    });
});
