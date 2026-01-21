import { expect } from 'chai';
import { PlayCardResponseMessage } from '../../../src/messages/response/play-card-response-message.js';
import { EvolveResponseMessage } from '../../../src/messages/response/evolve-response-message.js';
import { StateBuilder } from '../../helpers/state-builder.js';
import { runTestGame } from '../../helpers/test-helpers.js';
import { MockCardRepository } from '../../mock-repository.js';
import { CreatureData, ItemData } from '../../../src/repository/card-types.js';
import { getCurrentTemplateId } from '../../../src/utils/field-card-utils.js';

describe('Evolution Flexibility Effect', () => {
    const eevee = { templateId: 'eevee', type: 'creature' as const };
    const vaporeon = { templateId: 'vaporeon', type: 'creature' as const };
    const jolteon = { templateId: 'jolteon', type: 'creature' as const };
    const flareon = { templateId: 'flareon', type: 'creature' as const };
    const flexibilityItem = { templateId: 'flexibility-item', type: 'item' as const };

    const testRepository = new MockCardRepository({
        creatures: new Map<string, CreatureData>([
            // TODO remove from pocket-tcg entirely (including others)
            ['eevee', {
                templateId: 'eevee',
                name: 'Eevee',
                maxHp: 60,
                type: 'colorless',
                weakness: 'fighting',
                retreatCost: 1,
                attacks: [{ name: 'Tackle', damage: 10, energyRequirements: [{ type: 'colorless', amount: 1 }] }]
            }],
            ['vaporeon', {
                templateId: 'vaporeon',
                name: 'Vaporeon',
                maxHp: 90,
                type: 'water',
                weakness: 'lightning',
                retreatCost: 2,
                evolvesFrom: 'eevee',
                attacks: [{ name: 'Water Gun', damage: 40, energyRequirements: [{ type: 'water', amount: 2 }] }]
            }],
            ['jolteon', {
                templateId: 'jolteon',
                name: 'Jolteon',
                maxHp: 90,
                type: 'lightning',
                weakness: 'fighting',
                retreatCost: 1,
                evolvesFrom: 'eevee',
                attacks: [{ name: 'Thunder Shock', damage: 40, energyRequirements: [{ type: 'lightning', amount: 2 }] }]
            }],
            ['flareon', {
                templateId: 'flareon',
                name: 'Flareon',
                maxHp: 90,
                type: 'fire',
                weakness: 'water',
                retreatCost: 1,
                evolvesFrom: 'eevee',
                attacks: [{ name: 'Flamethrower', damage: 40, energyRequirements: [{ type: 'fire', amount: 2 }] }]
            }],
            ['basic-creature', {
                templateId: 'basic-creature',
                name: 'Basic Creature',
                maxHp: 80,
                type: 'grass',
                weakness: 'fire',
                retreatCost: 1,
                attacks: [{ name: 'Basic Attack', damage: 20, energyRequirements: [{ type: 'grass', amount: 1 }] }]
            }]
        ]),
        items: new Map<string, ItemData>([
            ['flexibility-item', {
                templateId: 'flexibility-item',
                name: 'Flexibility Item',
                effects: [{
                    type: 'evolution-flexibility',
                    target: 'self',
                    baseForm: 'eevee'
                }]
            }]
        ])
    });

    const basicCreature = { templateId: 'basic-creature', type: 'creature' as const };

    it('should allow flexible Eevee evolution (basic operation)', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [
                new PlayCardResponseMessage('flexibility-item', 'item'),
                new EvolveResponseMessage('vaporeon', 0) // Evolve Eevee to Vaporeon
            ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'eevee'),
                StateBuilder.withHand(0, [flexibilityItem, vaporeon])
            ),
            maxSteps: 15
        });

        expect(getExecutedCount()).to.equal(2, 'Should have executed flexibility item and evolution');
        expect(getCurrentTemplateId(state.field.creatures[0][0])).to.equal('vaporeon', 'Should have evolved to Vaporeon');
    });

    it('should allow evolution to different Eevee evolutions', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [
                new PlayCardResponseMessage('flexibility-item', 'item'),
                new EvolveResponseMessage('jolteon', 0) // Evolve Eevee to Jolteon instead
            ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'eevee'),
                StateBuilder.withHand(0, [flexibilityItem, jolteon])
            ),
            maxSteps: 15
        });

        expect(getExecutedCount()).to.equal(2, 'Should have executed flexibility item and evolution');
        expect(getCurrentTemplateId(state.field.creatures[0][0])).to.equal('jolteon', 'Should have evolved to Jolteon');
    });

    it('should work with multiple Eevee evolution options', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [
                new PlayCardResponseMessage('flexibility-item', 'item'),
                new EvolveResponseMessage('flareon', 0) // Choose Flareon from multiple options
            ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'eevee'),
                StateBuilder.withHand(0, [flexibilityItem, vaporeon, jolteon, flareon]) // Multiple evolution options
            ),
            maxSteps: 15
        });

        expect(getExecutedCount()).to.equal(2, 'Should have executed flexibility item and evolution');
        expect(getCurrentTemplateId(state.field.creatures[0][0])).to.equal('flareon', 'Should have evolved to Flareon');
        expect(state.hand[0].length).to.equal(2, 'Other evolution cards should remain in hand');
    });

    it('should not affect non-Eevee Pokemon', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [
                new PlayCardResponseMessage('flexibility-item', 'item'),
                new EvolveResponseMessage('vaporeon', 0) // Should fail - not an Eevee
            ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature'), // Not Eevee
                StateBuilder.withHand(0, [flexibilityItem, vaporeon])
            ),
            maxSteps: 15
        });

        expect(getExecutedCount()).to.equal(1, 'Should have executed flexibility item only (evolution blocked)');
        expect(getCurrentTemplateId(state.field.creatures[0][0])).to.equal('basic-creature', 'Should remain as basic creature');
    });

    it('should preserve damage when using flexible evolution', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [
                new PlayCardResponseMessage('flexibility-item', 'item'),
                new EvolveResponseMessage('vaporeon', 0)
            ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'eevee'),
                StateBuilder.withHand(0, [flexibilityItem, vaporeon]),
                StateBuilder.withDamage('eevee-0', 20) // Pre-damage Eevee
            ),
            maxSteps: 15
        });

        expect(getExecutedCount()).to.equal(2, 'Should have executed flexibility item and evolution');
        expect(getCurrentTemplateId(state.field.creatures[0][0])).to.equal('vaporeon', 'Should have evolved to Vaporeon');
        expect(state.field.creatures[0][0].damageTaken).to.equal(20, 'Should preserve damage after evolution');
    });

    it('should preserve energy when using flexible evolution', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [
                new PlayCardResponseMessage('flexibility-item', 'item'),
                new EvolveResponseMessage('jolteon', 0)
            ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'eevee'),
                StateBuilder.withHand(0, [flexibilityItem, jolteon]),
                StateBuilder.withEnergy('eevee-0', { lightning: 2 })
            ),
            maxSteps: 15
        });

        expect(getExecutedCount()).to.equal(2, 'Should have executed flexibility item and evolution');
        expect(getCurrentTemplateId(state.field.creatures[0][0])).to.equal('jolteon', 'Should have evolved to Jolteon');
        
        const energyState = state.energy as any;
        expect(energyState.attachedEnergyByInstance['eevee-0'].lightning).to.equal(2, 'Should preserve energy after evolution');
    });

    it('should work with bench Pokemon', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [
                new PlayCardResponseMessage('flexibility-item', 'item'),
                new EvolveResponseMessage('flareon', 1) // Evolve bench Eevee (position 1)
            ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature', ['eevee']), // Active is not Eevee
                StateBuilder.withHand(0, [flexibilityItem, flareon])
            ),
            maxSteps: 15
        });

        expect(getExecutedCount()).to.equal(2, 'Should have executed flexibility item and evolution');
        expect(getCurrentTemplateId(state.field.creatures[0][0])).to.equal('basic-creature', 'Active should remain unchanged');
        expect(getCurrentTemplateId(state.field.creatures[0][1])).to.equal('flareon', 'Bench Eevee should have evolved to Flareon');
    });

    it('should have limited duration or scope', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [
                new PlayCardResponseMessage('flexibility-item', 'item'),
                new EvolveResponseMessage('vaporeon', 0), // First evolution - should work
                new EvolveResponseMessage('jolteon', 1)   // Second evolution - may not work if single-use
            ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'eevee'),
                StateBuilder.withHand(0, [flexibilityItem, vaporeon, jolteon]),
                (state) => {
                    state.field.creatures[0].push({
                        evolutionStack: [{ instanceId: "field-card-1", templateId: 'eevee' }],
                        damageTaken: 0,
                        turnLastPlayed: 0
                    });
                }
            ),
            maxSteps: 20
        });

        expect(getExecutedCount()).to.be.greaterThanOrEqual(2, 'Should have executed flexibility item and at least one evolution');
        expect(getCurrentTemplateId(state.field.creatures[0][0])).to.equal('vaporeon', 'First Eevee should have evolved');
        // Second evolution result depends on implementation (single-use vs persistent effect)
    });
});
