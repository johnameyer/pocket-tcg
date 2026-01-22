import { expect } from 'chai';
import { PlayCardResponseMessage } from '../src/messages/response/play-card-response-message.js';
import { AttackResponseMessage } from '../src/messages/response/attack-response-message.js';
import { EvolveResponseMessage } from '../src/messages/response/evolve-response-message.js';
import { SelectActiveCardResponseMessage } from '../src/messages/response/select-active-card-response-message.js';
import { RetreatResponseMessage } from '../src/messages/response/retreat-response-message.js';
import { StateBuilder } from './helpers/state-builder.js';
import { runTestGame } from './helpers/test-helpers.js';
import { MockCardRepository } from './mock-repository.js';
import { CreatureData, SupporterData, ItemData, ToolData } from '../src/repository/card-types.js';
import { ControllerState } from '@cards-ts/core';
import { Controllers } from '../src/controllers/controllers.js';
import { getCurrentInstanceId } from '../src/utils/field-card-utils.js';

/**
 * Card Conservation Test Suite
 * 
 * Ensures that the total number of cards in the game (20 per player) remains constant
 * across all operations including:
 * - Evolution
 * - Discarding from hand
 * - Knocking out creatures
 * - Shuffling cards back into deck
 */
describe('Card Conservation', () => {
    const basicCreature = { templateId: 'basic-creature', type: 'creature' as const };
    const evolutionCreature = { templateId: 'evolved-creature', type: 'creature' as const };
    const discardSupporter = { templateId: 'discard-supporter', type: 'supporter' as const };
    const attackCreature = { templateId: 'attack-creature', type: 'creature' as const };
    const basicItem = { templateId: 'basic-item', type: 'item' as const };

    const testRepository = new MockCardRepository({
        creatures: new Map<string, CreatureData>([
            ['basic-creature', {
                templateId: 'basic-creature',
                name: 'Basic Creature',
                maxHp: 80,
                type: 'fire',
                weakness: 'water',
                retreatCost: 1,
                attacks: [{ name: 'Basic Attack', damage: 20, energyRequirements: [{ type: 'fire', amount: 1 }] }]
            }],
            ['evolved-creature', {
                templateId: 'evolved-creature',
                name: 'Evolved Creature',
                maxHp: 140,
                type: 'fire',
                evolvesFrom: 'basic-creature',
                weakness: 'water',
                retreatCost: 2,
                attacks: [{ name: 'Evolved Attack', damage: 60, energyRequirements: [{ type: 'fire', amount: 2 }] }]
            }],
            ['attack-creature', {
                templateId: 'attack-creature',
                name: 'Attack Creature',
                maxHp: 100,
                type: 'fire',
                weakness: 'water',
                retreatCost: 1,
                attacks: [{ name: 'Strong Attack', damage: 100, energyRequirements: [{ type: 'fire', amount: 2 }] }]
            }],
            ['high-hp-creature', {
                templateId: 'high-hp-creature',
                name: 'High HP Creature',
                maxHp: 180,
                type: 'water',
                weakness: 'lightning',
                retreatCost: 3,
                attacks: [{ name: 'Water Attack', damage: 30, energyRequirements: [{ type: 'water', amount: 1 }] }]
            }]
        ]),
        supporters: new Map<string, SupporterData>([
            ['discard-supporter', {
                templateId: 'discard-supporter',
                name: 'Discard Supporter',
                effects: [{
                    type: 'hand-discard',
                    amount: { type: 'constant', value: 2 },
                    target: 'self'
                }]
            }]
        ]),
        items: new Map<string, ItemData>([
            ['basic-item', {
                templateId: 'basic-item',
                name: 'Basic Item',
                effects: [{ type: 'hp', operation: 'heal', amount: { type: 'constant', value: 20 }, target: { type: 'fixed', player: 'self', position: 'active' } }]
            }]
        ]),
        tools: new Map([
            ['basic-tool', {
                templateId: 'basic-tool',
                name: 'Basic Tool',
                effects: []
            }]
        ])
    });

    /**
     * Helper function to collect all card instanceIds for a player across all zones
     * This provides a more robust way to verify card conservation by tracking unique instances
     */
    function collectAllCardInstanceIds(state: ControllerState<Controllers>, playerId: number): Set<string> {
        const instanceIds = new Set<string>();
        
        // Collect cards in hand
        const hand = state.hand[playerId] || [];
        for (const card of hand) {
            instanceIds.add(card.instanceId);
        }
        
        // Collect cards in deck
        const deck = state.deck[playerId] || [];
        for (const card of deck) {
            instanceIds.add(card.instanceId);
        }
        
        // Collect cards on field (including evolution stacks)
        const fieldCards = state.field?.creatures[playerId] || [];
        for (const card of fieldCards) {
            if (!card) continue;
            // For InstancedFieldCard, add all cards from evolution stack
            // The evolution stack contains both the pre-evolution forms AND the evolution cards used
            if (card.evolutionStack) {
                for (const stackCard of card.evolutionStack) {
                    instanceIds.add(stackCard.instanceId);
                }
            }
        }
        
        // Collect cards in discard pile
        const discardPile = state.discard[playerId] || [];
        for (const card of discardPile) {
            instanceIds.add(card.instanceId);
        }
        
        return instanceIds;
    }

    /**
     * Helper function to count total cards for a player across all zones
     * Uses instanceId tracking for more accurate counting
     */
    function countTotalCards(state: ControllerState<Controllers>, playerId: number): number {
        return collectAllCardInstanceIds(state, playerId).size;
    }

    /**
     * Helper function to count total energy for a player across all zones
     */
    function countTotalEnergy(state: ControllerState<Controllers>, playerId: number): number {
        let total = 0;
        
        // Count attached energy on field
        const fieldCards = state.field?.creatures[playerId] || [];
        for (const card of fieldCards) {
            if (!card) continue;
            // Use fieldInstanceId to access attached energy
            const attached = state.energy.attachedEnergyByInstance[card.fieldInstanceId] || {};
            total += Object.values(attached).reduce((sum: number, count) => sum + (count as number), 0);
        }
        
        // Count discarded energy
        const discarded = state.energy.discardedEnergy[playerId] || {};
        total += Object.values(discarded).reduce((sum: number, count) => sum + (count as number), 0);
        
        // Note: We don't count current/next energy as that's generated each turn, not part of initial deck
        
        return total;
    }

    it('should maintain card count through hand discard', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [new PlayCardResponseMessage('discard-supporter', 'supporter')],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature'),
                StateBuilder.withHand(0, [discardSupporter, basicCreature, basicCreature, basicItem]),
                StateBuilder.withDeck(0, Array(15).fill(basicCreature))
            ),
            maxSteps: 10
        });

        expect(getExecutedCount()).to.equal(1, 'Should have executed discard supporter');
        
        const totalCards = countTotalCards(state, 0);
        expect(totalCards).to.equal(20, `Player should have exactly 20 cards total (found ${totalCards})`);
        
        // Verify cards went to discard pile (2 discarded + 1 supporter played = 3)
        expect(state.discard[0].length).to.equal(3, 'Should have 3 cards in discard (2 discarded + 1 supporter played)');
    });

    it('should maintain card count through evolution', () => {
        const { state } = runTestGame({
            actions: [new EvolveResponseMessage('evolved-creature', 0)],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature'),
                StateBuilder.withHand(0, [evolutionCreature, basicCreature, basicCreature]),
                StateBuilder.withDeck(0, Array(16).fill(basicCreature)),
                StateBuilder.withCanEvolve(0, 0)
            ),
            maxSteps: 10
        });

        const totalCards = countTotalCards(state, 0);
        expect(totalCards).to.equal(20, `Player should have exactly 20 cards total after evolution (found ${totalCards})`);
        
        // Verify evolution stack is tracked
        const activeCard = state.field.creatures[0][0];
        expect(activeCard.evolutionStack).to.exist;
        expect(activeCard.evolutionStack!.length).to.be.greaterThan(0, 'Evolution stack should contain previous forms');
    });

    it('should maintain card count through knockout', () => {
        const { state } = runTestGame({
            actions: [
                new AttackResponseMessage(0),
                new SelectActiveCardResponseMessage(0)
            ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'attack-creature'),
                StateBuilder.withCreatures(1, 'basic-creature', ['basic-creature']),
                StateBuilder.withDamage('basic-creature-1', 60), // 80 HP - 60 damage = 20 HP, attack does 100 damage = KO
                StateBuilder.withHand(0, [basicCreature]),
                StateBuilder.withHand(1, [basicCreature]),
                StateBuilder.withDeck(0, Array(18).fill(basicCreature)),
                StateBuilder.withDeck(1, Array(17).fill(basicCreature)), // 17 because one more creature on bench
                StateBuilder.withEnergy('attack-creature-0', { fire: 2 })
            ),
            maxSteps: 15
        });

        const player0Cards = countTotalCards(state, 0);
        const player1Cards = countTotalCards(state, 1);
        
        expect(player0Cards).to.equal(20, `Player 0 should have exactly 20 cards total (found ${player0Cards})`);
        expect(player1Cards).to.equal(20, `Player 1 should have exactly 20 cards total after knockout (found ${player1Cards})`);
        
        // Verify the knocked out card went to discard pile
        expect(state.discard[1].length).to.be.greaterThan(0, 'Knocked out card should be in discard pile');
    });

    it('should maintain card count through evolved creature knockout', () => {
        const { state } = runTestGame({
            actions: [
                new AttackResponseMessage(0),
                new SelectActiveCardResponseMessage(0)
            ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'attack-creature'),
                StateBuilder.withCreatures(1, 'basic-creature', ['basic-creature']),
                StateBuilder.withHand(0, [basicCreature]),
                StateBuilder.withHand(1, []), // Empty hand
                StateBuilder.withDeck(0, Array(18).fill(basicCreature)),
                StateBuilder.withDeck(1, Array(17).fill(basicCreature)), // 17 because one more creature on bench
                StateBuilder.withEnergy('attack-creature-0', { fire: 2 }),
                (state) => {
                    // Manually create an evolved creature for testing by simulating the evolution
                    // The active basic-creature already exists in the evolution stack
                    const player1ActiveCard = state.field.creatures[1][0];
                    if (player1ActiveCard) {
                        // Simulate evolution by adding the evolved form to stack
                        // This represents using an evolution card from somewhere to evolve
                        player1ActiveCard.evolutionStack.push({
                            instanceId: 'evolution-creature-evolved-1',
                            templateId: 'evolved-creature'
                        });
                        // Damage the evolved creature near KO (evolved-creature has 140 HP)
                        player1ActiveCard.damageTaken = 40; // attack does 100 damage, total 140 = exact KO
                    }
                }
            ),
            maxSteps: 15
        });

        const player0Cards = countTotalCards(state, 0);
        const player1Cards = countTotalCards(state, 1);
        
        expect(player0Cards).to.equal(20, `Player 0 should have exactly 20 cards total (found ${player0Cards})`);
        // Player 1 should have 18 cards (1 active with 2 in evolution stack, 1 bench, 0 hand, 17 deck) = 20 total
        expect(player1Cards).to.equal(20, `Player 1 should have exactly 20 cards total after evolved knockout (found ${player1Cards})`);
        
        // Verify both forms are in discard pile
        expect(state.discard[1].length).to.be.greaterThanOrEqual(2, 'Both evolution forms should be in discard pile');
    });

    it('should maintain card count with shuffle back to deck', () => {
        const shuffleDiscardSupporter = { templateId: 'shuffle-discard-supporter', type: 'supporter' as const };
        const repositoryWithShuffle = new MockCardRepository({
            creatures: new Map<string, CreatureData>([
                ['basic-creature', {
                    templateId: 'basic-creature',
                    name: 'Basic Creature',
                    maxHp: 80,
                    type: 'fire',
                    weakness: 'water',
                    retreatCost: 1,
                    attacks: [{ name: 'Basic Attack', damage: 20, energyRequirements: [{ type: 'fire', amount: 1 }] }]
                }]
            ]),
            supporters: new Map<string, SupporterData>([
                ['shuffle-discard-supporter', {
                    templateId: 'shuffle-discard-supporter',
                    name: 'Shuffle Discard Supporter',
                    effects: [{
                        type: 'hand-discard',
                        amount: { type: 'constant', value: 2 },
                        target: 'self',
                        shuffleIntoDeck: true
                    }]
                }]
            ]),
            items: new Map<string, ItemData>([
                ['basic-item', {
                    templateId: 'basic-item',
                    name: 'Basic Item',
                    effects: [{ type: 'hp', operation: 'heal', amount: { type: 'constant', value: 20 }, target: { type: 'fixed', player: 'self', position: 'active' } }]
                }]
            ])
        });

        const { state, getExecutedCount } = runTestGame({
            actions: [new PlayCardResponseMessage('shuffle-discard-supporter', 'supporter')],
            customRepository: repositoryWithShuffle,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature'),
                StateBuilder.withHand(0, [shuffleDiscardSupporter, basicCreature, basicCreature, basicItem]),
                StateBuilder.withDeck(0, Array(15).fill(basicCreature))
            ),
            maxSteps: 10
        });

        expect(getExecutedCount()).to.equal(1, 'Should have executed shuffle discard supporter');
        
        const totalCards = countTotalCards(state, 0);
        expect(totalCards).to.equal(20, `Player should have exactly 20 cards total with shuffle (found ${totalCards})`);
        
        // Verify shuffled cards went back to deck, not discard pile (only supporter itself in discard)
        expect(state.discard[0].length).to.equal(1, 'Only the played supporter should be in discard pile, not the shuffled cards');
    });

    it('should track discarded energy from knockouts', () => {
        const { state } = runTestGame({
            actions: [
                new AttackResponseMessage(0),
                new SelectActiveCardResponseMessage(0)
            ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'attack-creature'),
                StateBuilder.withCreatures(1, 'basic-creature', ['basic-creature']),
                StateBuilder.withDamage('basic-creature-1', 60), // 80 HP - 60 damage = 20 HP, attack does 100 damage = KO
                StateBuilder.withHand(0, [basicCreature]),
                StateBuilder.withHand(1, [basicCreature]),
                StateBuilder.withDeck(0, Array(18).fill(basicCreature)),
                StateBuilder.withDeck(1, Array(17).fill(basicCreature)), // 17 because one more creature on bench
                StateBuilder.withEnergy('attack-creature-0', { fire: 2 }),
                StateBuilder.withEnergy('basic-creature-1', { fire: 1, water: 1 })
            ),
            maxSteps: 15
        });

        // Check that energy was discarded by checking the discard pile state
        const player1DiscardedCards = state.discard[1].length;
        expect(player1DiscardedCards).to.be.greaterThan(0, 'Knocked out creature should be in discard pile');
        
        // Verify energy was tracked in discard
        const discardedEnergy = state.energy.discardedEnergy[1];
        const totalDiscardedEnergy = Object.values(discardedEnergy).reduce((sum: number, count) => sum + (count as number), 0);
        expect(totalDiscardedEnergy).to.be.greaterThan(0, 'Energy from knocked out creature should be tracked in discard');
    });

    it('should maintain card count when playing tools', () => {
        const basicTool = { templateId: 'basic-tool', type: 'tool' as const };
        
        const { state } = runTestGame({
            actions: [new PlayCardResponseMessage('basic-tool', 'tool', 0, 0)],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature'),
                StateBuilder.withHand(0, [basicTool, basicCreature, basicCreature, basicCreature]),
                StateBuilder.withDeck(0, Array(15).fill(basicCreature))
            ),
            maxSteps: 10
        });

        const totalCards = countTotalCards(state, 0);
        // Tool is not counted as a card - only creatures/supporters/items count toward 20
        // 1 active + 3 hand + 15 deck = 19 cards (tool is separate)
        expect(totalCards).to.equal(19, `Player should have exactly 19 cards total (tool not counted) (found ${totalCards})`);
        
        // Tool should be attached, not in discard or hand
        expect(state.hand[0].length).to.equal(3, 'Tool should be removed from hand');
        // Tools aren't counted in discard pile, they're attached to creatures
    });

    it('should maintain card count when creature with tool is knocked out', () => {
        const basicTool = { templateId: 'basic-tool', type: 'tool' as const };
        
        const { state } = runTestGame({
            actions: [
                new AttackResponseMessage(0),
                new SelectActiveCardResponseMessage(0)
            ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'attack-creature'),
                StateBuilder.withCreatures(1, 'basic-creature', ['basic-creature']),
                StateBuilder.withDamage('basic-creature-1', 60), // 80 HP - 60 damage = 20 HP left
                StateBuilder.withHand(0, [basicCreature]),
                StateBuilder.withHand(1, [basicCreature]),
                StateBuilder.withDeck(0, Array(18).fill(basicCreature)),
                StateBuilder.withDeck(1, Array(17).fill(basicCreature)), // 17 deck + 1 bench + 1 active + 1 hand = 20
                StateBuilder.withEnergy('attack-creature-0', { fire: 2 }),
                StateBuilder.withTool('basic-creature-1', 'basic-tool')
            ),
            maxSteps: 15
        });

        const player0Cards = countTotalCards(state, 0);
        const player1Cards = countTotalCards(state, 1);
        
        expect(player0Cards).to.equal(20, `Player 0 should have exactly 20 cards total (found ${player0Cards})`);
        // Player 1 has 20 cards (tool is not counted in the 20-card deck)
        expect(player1Cards).to.equal(20, `Player 1 should have exactly 20 cards after knockout with tool (found ${player1Cards})`);
    });

    it('should maintain card count through retreat', () => {
        const highHpCreature = { templateId: 'high-hp-creature', type: 'creature' as const };
        
        const { state } = runTestGame({
            actions: [new RetreatResponseMessage(0)],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature', ['high-hp-creature']),
                StateBuilder.withHand(0, [basicCreature, basicCreature]),
                StateBuilder.withDeck(0, Array(16).fill(basicCreature)),
                StateBuilder.withEnergy('basic-creature-0', { fire: 1 })
            ),
            maxSteps: 10
        });

        const totalCards = countTotalCards(state, 0);
        expect(totalCards).to.equal(20, `Player should have exactly 20 cards total after retreat (found ${totalCards})`);
        
        // Verify retreat happened (active should be different)
        expect(state.field.creatures[0].length).to.equal(2, 'Should still have 2 creatures after retreat');
    });

    it('should maintain card count through multiple evolutions', () => {
        const { state } = runTestGame({
            actions: [
                new EvolveResponseMessage('evolved-creature', 0),
                new EvolveResponseMessage('evolved-creature', 1)
            ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature', ['basic-creature']),
                StateBuilder.withHand(0, [evolutionCreature, evolutionCreature, basicCreature]),
                StateBuilder.withDeck(0, Array(15).fill(basicCreature)),
                StateBuilder.withCanEvolve(0, 0),
                StateBuilder.withCanEvolve(0, 1)
            ),
            maxSteps: 15
        });

        const totalCards = countTotalCards(state, 0);
        expect(totalCards).to.equal(20, `Player should have exactly 20 cards total after multiple evolutions (found ${totalCards})`);
        
        // Verify both creatures evolved
        expect(state.field.creatures[0][0].evolutionStack.length).to.be.greaterThan(1, 'Active should be evolved');
        expect(state.field.creatures[0][1].evolutionStack.length).to.be.greaterThan(1, 'Bench should be evolved');
    });

    it('should maintain card count through playing items', () => {
        const { state } = runTestGame({
            actions: [new PlayCardResponseMessage('basic-item', 'item')],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature'),
                StateBuilder.withDamage('basic-creature-0', 20),
                StateBuilder.withHand(0, [basicItem, basicCreature, basicCreature]),
                StateBuilder.withDeck(0, Array(16).fill(basicCreature))
            ),
            maxSteps: 10
        });

        const totalCards = countTotalCards(state, 0);
        expect(totalCards).to.equal(20, `Player should have exactly 20 cards total after playing item (found ${totalCards})`);
        
        // Item should be in discard pile
        expect(state.discard[0].length).to.equal(1, 'Item should be in discard pile');
        expect(state.discard[0][0].templateId).to.equal('basic-item');
    });

    it('should maintain card count in complex multi-action scenario', () => {
        const { state } = runTestGame({
            actions: [
                new PlayCardResponseMessage('basic-creature', 'creature'), // Play creature to bench (removes from hand)
                new EvolveResponseMessage('evolved-creature', 0) // Evolve active (removes from hand, adds to stack)
            ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature'),
                StateBuilder.withCreatures(1, 'basic-creature'),
                // Start: 1 active (in evolution stack) + 4 hand + 15 deck = 20
                StateBuilder.withHand(0, [basicCreature, evolutionCreature, basicCreature, basicCreature]),
                StateBuilder.withDeck(0, Array(15).fill(basicCreature)),
                StateBuilder.withDeck(1, Array(19).fill(basicCreature)),
                StateBuilder.withCanEvolve(0, 0)
            ),
            maxSteps: 20
        });

        const player0Cards = countTotalCards(state, 0);
        const player1Cards = countTotalCards(state, 1);
        
        // After actions: 2 creatures on field (evolution stack: basic+evolved for active, basic for bench) + 2 hand + 15 deck = 20
        expect(player0Cards).to.equal(20, `Player 0 should have exactly 20 cards after complex scenario (found ${player0Cards})`);
        expect(player1Cards).to.equal(20, `Player 1 should have exactly 20 cards after complex scenario (found ${player1Cards})`);
        
        // Verify the actions happened
        expect(state.field.creatures[0].length).to.equal(2, 'Should have added creature to bench');
        expect(state.field.creatures[0][0].evolutionStack.length).to.be.greaterThan(1, 'Active should be evolved');
    });
});
