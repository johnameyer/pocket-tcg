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
            // Two different versions of "Pikachu" - different templateIds, same name
            ['pikachu-v1', {
                templateId: 'pikachu-v1',
                name: 'Pikachu',
                maxHp: 60,
                type: 'lightning',
                weakness: 'fighting',
                retreatCost: 1,
                attacks: [{ name: 'Thunder Shock', damage: 20, energyRequirements: [{ type: 'lightning', amount: 1 }] }]
            }],
            ['pikachu-v2', {
                templateId: 'pikachu-v2',
                name: 'Pikachu',  // Same name as pikachu-v1
                maxHp: 70,         // Different stats
                type: 'lightning',
                weakness: 'fighting',
                retreatCost: 1,
                attacks: [{ name: 'Quick Attack', damage: 30, energyRequirements: [{ type: 'lightning', amount: 2 }] }]
            }],
            // Raichu evolves from "Pikachu" (the name, not the templateId)
            ['raichu-v1', {
                templateId: 'raichu-v1',
                name: 'Raichu',
                maxHp: 120,
                type: 'lightning',
                weakness: 'fighting',
                retreatCost: 2,
                evolvesFrom: 'Pikachu',  // Name-based evolution
                attacks: [{ name: 'Thunder', damage: 60, energyRequirements: [{ type: 'lightning', amount: 3 }] }]
            }]
        ])
    });

    it('should allow pikachu-v1 to evolve into raichu based on name', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [new EvolveResponseMessage('raichu-v1', 0)],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'pikachu-v1'),
                StateBuilder.withHand(0, [{templateId: 'raichu-v1', type: 'creature'}]),
                StateBuilder.withCanEvolve(0, 0)
            )
        });

        expect(getExecutedCount()).to.equal(1, 'Should have executed evolution action');
        expect(getCurrentTemplateId(state.field.creatures[0][0])).to.equal('raichu-v1', 'Should have evolved to Raichu');
    });

    it('should allow pikachu-v2 to evolve into raichu based on name', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [new EvolveResponseMessage('raichu-v1', 0)],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'pikachu-v2'),  // Different templateId
                StateBuilder.withHand(0, [{templateId: 'raichu-v1', type: 'creature'}]),
                StateBuilder.withCanEvolve(0, 0)
            )
        });

        expect(getExecutedCount()).to.equal(1, 'Should have executed evolution action');
        expect(getCurrentTemplateId(state.field.creatures[0][0])).to.equal('raichu-v1', 'Should have evolved to Raichu');
    });

    it('should preserve evolution stack showing original templateId when evolving pikachu-v1', () => {
        const { state } = runTestGame({
            actions: [new EvolveResponseMessage('raichu-v1', 0)],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'pikachu-v1'),
                StateBuilder.withHand(0, [{templateId: 'raichu-v1', type: 'creature'}]),
                StateBuilder.withCanEvolve(0, 0)
            ),
            maxSteps: 5
        });

        const activeCard = state.field.creatures[0][0];
        expect(activeCard.evolutionStack.length).to.equal(2, 'Evolution stack should have 2 cards');
        expect(activeCard.evolutionStack[0].templateId).to.equal('pikachu-v1', 'Base form should be pikachu-v1');
        expect(activeCard.evolutionStack[1].templateId).to.equal('raichu-v1', 'Evolved form should be raichu-v1');
    });

    it('should preserve evolution stack showing original templateId when evolving pikachu-v2', () => {
        const { state } = runTestGame({
            actions: [new EvolveResponseMessage('raichu-v1', 0)],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'pikachu-v2'),
                StateBuilder.withHand(0, [{templateId: 'raichu-v1', type: 'creature'}]),
                StateBuilder.withCanEvolve(0, 0)
            ),
            maxSteps: 5
        });

        const activeCard = state.field.creatures[0][0];
        expect(activeCard.evolutionStack.length).to.equal(2, 'Evolution stack should have 2 cards');
        expect(activeCard.evolutionStack[0].templateId).to.equal('pikachu-v2', 'Base form should be pikachu-v2');
        expect(activeCard.evolutionStack[1].templateId).to.equal('raichu-v1', 'Evolved form should be raichu-v1');
    });

    it('should allow both pikachu variants to be on field simultaneously', () => {
        const { state } = runTestGame({
            actions: [],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'pikachu-v1', ['pikachu-v2'])
            )
        });

        expect(state.field.creatures[0].length).to.equal(2, 'Should have 2 creatures on field');
        expect(getCurrentTemplateId(state.field.creatures[0][0])).to.equal('pikachu-v1', 'Active should be pikachu-v1');
        expect(getCurrentTemplateId(state.field.creatures[0][1])).to.equal('pikachu-v2', 'Bench should be pikachu-v2');
        
        // Both have the same name
        const card1Data = testRepository.getCreature('pikachu-v1');
        const card2Data = testRepository.getCreature('pikachu-v2');
        expect(card1Data.name).to.equal(card2Data.name, 'Both should have name "Pikachu"');
    });

    it('should allow evolving both pikachu variants in same game', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [
                new EvolveResponseMessage('raichu-v1', 0),  // Evolve active pikachu-v1
                new EvolveResponseMessage('raichu-v1', 1)   // Evolve benched pikachu-v2
            ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'pikachu-v1', ['pikachu-v2']),
                StateBuilder.withHand(0, [
                    {templateId: 'raichu-v1', type: 'creature'},
                    {templateId: 'raichu-v1', type: 'creature'}
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
        expect(getCurrentTemplateId(state.field.creatures[0][0])).to.equal('raichu-v1', 'Active should have evolved');
        expect(getCurrentTemplateId(state.field.creatures[0][1])).to.equal('raichu-v1', 'Bench should have evolved');
        
        // Verify evolution stacks track the original cards
        expect(state.field.creatures[0][0].evolutionStack[0].templateId).to.equal('pikachu-v1');
        expect(state.field.creatures[0][1].evolutionStack[0].templateId).to.equal('pikachu-v2');
    });
});
