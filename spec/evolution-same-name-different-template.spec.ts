import { expect } from 'chai';
import { EvolveResponseMessage } from '../src/messages/response/evolve-response-message.js';
import { StateBuilder } from './helpers/state-builder.js';
import { runTestGame } from './helpers/test-helpers.js';
import { MockCardRepository } from './mock-repository.js';
import { CreatureData } from '../src/repository/card-types.js';
import { getCurrentTemplateId } from '../src/utils/field-card-utils.js';

describe('Evolution with Same Name, Different Template ID', () => {
    /**
     * This test verifies that evolution is based on creature name, not templateId.
     * A player can have up to two creatures with the same name but different templateIds in their deck.
     */
    
    const testRepository = new MockCardRepository({
        creatures: new Map<string, CreatureData>([
            // Two different versions of "Electric Creature" - different templateIds, same name
            ['electric-creature-v1', {
                templateId: 'electric-creature-v1',
                name: 'Electric Creature',
                maxHp: 60,
                type: 'lightning',
                weakness: 'fighting',
                retreatCost: 1,
                attacks: [{ name: 'Shock', damage: 20, energyRequirements: [{ type: 'lightning', amount: 1 }] }]
            }],
            ['electric-creature-v2', {
                templateId: 'electric-creature-v2',
                name: 'Electric Creature',  // Same name as electric-creature-v1
                maxHp: 70,         // Different stats
                type: 'lightning',
                weakness: 'fighting',
                retreatCost: 1,
                attacks: [{ name: 'Quick Strike', damage: 30, energyRequirements: [{ type: 'lightning', amount: 2 }] }]
            }],
            // Electric Evolution evolves from "Electric Creature" (the name, not the templateId)
            ['electric-evolution-v1', {
                templateId: 'electric-evolution-v1',
                name: 'Electric Evolution',
                maxHp: 120,
                type: 'lightning',
                weakness: 'fighting',
                retreatCost: 2,
                evolvesFrom: 'Electric Creature',  // Name-based evolution
                attacks: [{ name: 'Thunderbolt', damage: 60, energyRequirements: [{ type: 'lightning', amount: 3 }] }]
            }]
        ])
    });

    it('should allow electric-creature-v1 to evolve based on name', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [new EvolveResponseMessage('electric-evolution-v1', 0)],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'electric-creature-v1'),
                StateBuilder.withHand(0, [{templateId: 'electric-evolution-v1', type: 'creature'}]),
                StateBuilder.withCanEvolve(0, 0)
            )
        });

        expect(getExecutedCount()).to.equal(1, 'Should have executed evolution action');
        expect(getCurrentTemplateId(state.field.creatures[0][0])).to.equal('electric-evolution-v1', 'Should have evolved to Electric Evolution');
    });

    it('should allow electric-creature-v2 to evolve based on name', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [new EvolveResponseMessage('electric-evolution-v1', 0)],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'electric-creature-v2'),  // Different templateId
                StateBuilder.withHand(0, [{templateId: 'electric-evolution-v1', type: 'creature'}]),
                StateBuilder.withCanEvolve(0, 0)
            )
        });

        expect(getExecutedCount()).to.equal(1, 'Should have executed evolution action');
        expect(getCurrentTemplateId(state.field.creatures[0][0])).to.equal('electric-evolution-v1', 'Should have evolved to Electric Evolution');
    });

    it('should preserve evolution stack showing original templateId when evolving electric-creature-v1', () => {
        const { state } = runTestGame({
            actions: [new EvolveResponseMessage('electric-evolution-v1', 0)],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'electric-creature-v1'),
                StateBuilder.withHand(0, [{templateId: 'electric-evolution-v1', type: 'creature'}]),
                StateBuilder.withCanEvolve(0, 0)
            ),
            maxSteps: 5
        });

        const activeCard = state.field.creatures[0][0];
        expect(activeCard.evolutionStack.length).to.equal(2, 'Evolution stack should have 2 cards');
        expect(activeCard.evolutionStack[0].templateId).to.equal('electric-creature-v1', 'Base form should be electric-creature-v1');
        expect(activeCard.evolutionStack[1].templateId).to.equal('electric-evolution-v1', 'Evolved form should be electric-evolution-v1');
    });

    it('should preserve evolution stack showing original templateId when evolving electric-creature-v2', () => {
        const { state } = runTestGame({
            actions: [new EvolveResponseMessage('electric-evolution-v1', 0)],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'electric-creature-v2'),
                StateBuilder.withHand(0, [{templateId: 'electric-evolution-v1', type: 'creature'}]),
                StateBuilder.withCanEvolve(0, 0)
            ),
            maxSteps: 5
        });

        const activeCard = state.field.creatures[0][0];
        expect(activeCard.evolutionStack.length).to.equal(2, 'Evolution stack should have 2 cards');
        expect(activeCard.evolutionStack[0].templateId).to.equal('electric-creature-v2', 'Base form should be electric-creature-v2');
        expect(activeCard.evolutionStack[1].templateId).to.equal('electric-evolution-v1', 'Evolved form should be electric-evolution-v1');
    });

    it('should allow both variants to be on field simultaneously', () => {
        const { state } = runTestGame({
            actions: [],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'electric-creature-v1', ['electric-creature-v2'])
            )
        });

        expect(state.field.creatures[0].length).to.equal(2, 'Should have 2 creatures on field');
        expect(getCurrentTemplateId(state.field.creatures[0][0])).to.equal('electric-creature-v1', 'Active should be electric-creature-v1');
        expect(getCurrentTemplateId(state.field.creatures[0][1])).to.equal('electric-creature-v2', 'Bench should be electric-creature-v2');
        
        // Both have the same name
        const card1Data = testRepository.getCreature('electric-creature-v1');
        const card2Data = testRepository.getCreature('electric-creature-v2');
        expect(card1Data.name).to.equal(card2Data.name, 'Both should have name "Electric Creature"');
    });

    it('should allow evolving both variants in same game', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [
                new EvolveResponseMessage('electric-evolution-v1', 0),  // Evolve active electric-creature-v1
                new EvolveResponseMessage('electric-evolution-v1', 1)   // Evolve benched electric-creature-v2
            ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'electric-creature-v1', ['electric-creature-v2']),
                StateBuilder.withHand(0, [
                    {templateId: 'electric-evolution-v1', type: 'creature'},
                    {templateId: 'electric-evolution-v1', type: 'creature'}
                ]),
                StateBuilder.withCanEvolve(0, 0),
                // Make bench creature also eligible for evolution
                (state) => {
                    const benchedCard = state.field.creatures[0][1];
                    if (benchedCard) {
                        benchedCard.turnLastPlayed = 0;
                    }
                }
            ),
            maxSteps: 10
        });

        expect(getExecutedCount()).to.equal(2, 'Should have executed both evolution actions');
        expect(getCurrentTemplateId(state.field.creatures[0][0])).to.equal('electric-evolution-v1', 'Active should have evolved');
        expect(getCurrentTemplateId(state.field.creatures[0][1])).to.equal('electric-evolution-v1', 'Bench should have evolved');
        
        // Verify evolution stacks track the original cards
        expect(state.field.creatures[0][0].evolutionStack[0].templateId).to.equal('electric-creature-v1');
        expect(state.field.creatures[0][1].evolutionStack[0].templateId).to.equal('electric-creature-v2');
    });
});
