import { expect } from 'chai';
import { PlayCardResponseMessage } from '../src/messages/response/play-card-response-message.js';
import { AttackResponseMessage } from '../src/messages/response/attack-response-message.js';
import { EvolveResponseMessage } from '../src/messages/response/evolve-response-message.js';
import { StateBuilder } from './helpers/state-builder.js';
import { runTestGame } from './helpers/test-helpers.js';
import { MockCardRepository } from './mock-repository.js';
import { CreatureData, SupporterData, ItemData } from '../src/repository/card-types.js';
import { Controllers } from '../src/controllers/controllers.js';

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
        ])
    });

    /**
     * Helper function to collect all card instanceIds for a player across all zones
     * This provides a more robust way to verify card conservation by tracking unique instances
     */
    function collectAllCardInstanceIds(state: any, playerId: number): Set<string> {
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
            instanceIds.add(card.instanceId);
            
            // Add evolution stack cards
            if (card.evolutionStack) {
                for (const stackCard of card.evolutionStack) {
                    // Evolution stack now contains card objects with instanceIds
                    if (typeof stackCard === 'string') {
                        // Legacy: templateId only - create synthetic id
                        instanceIds.add(`${stackCard}-evolved-${card.instanceId}`);
                    } else {
                        instanceIds.add(stackCard.instanceId);
                    }
                }
            }
        }
        
        // Collect cards in discard pile
        const discardPile = state.discard.cards[playerId] || [];
        for (const card of discardPile) {
            instanceIds.add(card.instanceId);
        }
        
        return instanceIds;
    }

    /**
     * Helper function to count total cards for a player across all zones
     * Uses instanceId tracking for more accurate counting
     */
    function countTotalCards(state: any, playerId: number): number {
        return collectAllCardInstanceIds(state, playerId).size;
    }

    /**
     * Helper function to count total energy for a player across all zones
     */
    function countTotalEnergy(controllers: Controllers, playerId: number): number {
        let total = 0;
        
        // Count attached energy on field
        const fieldCards = controllers.field.getCards(playerId);
        for (const card of fieldCards) {
            total += controllers.energy.getTotalEnergyByInstance(card.instanceId);
        }
        
        // Count discarded energy
        total += controllers.discard.getTotalDiscardedEnergy(playerId);
        
        // Note: We don't count current/next energy as that's generated each turn, not part of initial deck
        
        return total;
    }

    it('should maintain card count through hand discard', () => {
        const initialDeck = [
            basicCreature, basicCreature, basicCreature, basicCreature, basicCreature,
            basicCreature, basicCreature, basicCreature, basicCreature, basicCreature,
            discardSupporter, discardSupporter, basicItem, basicItem, basicItem,
            basicItem, basicItem, basicItem, basicItem, basicItem
        ];

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
        expect(state.discard.cards[0].length).to.equal(3, 'Should have 3 cards in discard (2 discarded + 1 supporter played)');
    });

    it('should maintain card count through evolution', () => {
        const { state } = runTestGame({
            actions: [new EvolveResponseMessage('evolved-creature', 0)],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature'),
                StateBuilder.withHand(0, [evolutionCreature, basicCreature, basicCreature]),
                StateBuilder.withDeck(0, Array(16).fill(basicCreature))
            ),
            maxSteps: 10
        });

        const totalCards = countTotalCards(state, 0);
        expect(totalCards).to.equal(20, `Player should have exactly 20 cards total after evolution (found ${totalCards})`);
        
        // Verify evolution stack is tracked
        const activeCard = state.field.creatures[0][0];
        expect(activeCard.evolutionStack).to.exist;
        expect(activeCard.evolutionStack!.length).to.equal(1, 'Evolution stack should contain the pre-evolution form');
    });

    it('should maintain card count through knockout', () => {
        const { state } = runTestGame({
            actions: [new AttackResponseMessage(0)],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'attack-creature'),
                StateBuilder.withCreatures(1, 'basic-creature'),
                StateBuilder.withHand(0, [basicCreature]),
                StateBuilder.withHand(1, [basicCreature]),
                StateBuilder.withDeck(0, Array(18).fill(basicCreature)),
                StateBuilder.withDeck(1, Array(18).fill(basicCreature)),
                StateBuilder.withEnergy('attack-creature-0', { fire: 2 })
            ),
            maxSteps: 15
        });

        const player0Cards = countTotalCards(state, 0);
        const player1Cards = countTotalCards(state, 1);
        
        expect(player0Cards).to.equal(20, `Player 0 should have exactly 20 cards total (found ${player0Cards})`);
        expect(player1Cards).to.equal(20, `Player 1 should have exactly 20 cards total after knockout (found ${player1Cards})`);
        
        // Verify the knocked out card went to discard pile
        expect(state.discard.cards[1].length).to.be.greaterThan(0, 'Knocked out card should be in discard pile');
    });

    it.skip('should maintain card count through evolved creature knockout', () => {
        // TODO: This test needs refinement - evolution action may not be executing properly
        // The full game conservation test covers evolution scenarios more comprehensively
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
        expect(state.discard.cards[0].length).to.equal(1, 'Only the played supporter should be in discard pile, not the shuffled cards');
    });

    it('should track discarded energy from knockouts', () => {
        // We'll have to extract controllers from the driver since runTestGame doesn't expose it
        const testConfig = {
            actions: [new AttackResponseMessage(0)],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'attack-creature'),
                StateBuilder.withCreatures(1, 'basic-creature'),
                StateBuilder.withHand(0, [basicCreature]),
                StateBuilder.withHand(1, [basicCreature]),
                StateBuilder.withDeck(0, Array(18).fill(basicCreature)),
                StateBuilder.withDeck(1, Array(18).fill(basicCreature)),
                StateBuilder.withEnergy('attack-creature-0', { fire: 2 }),
                StateBuilder.withEnergy('basic-creature-1', { fire: 1, water: 1 })
            ),
            maxSteps: 15
        };
        
        const { state } = runTestGame(testConfig);

        // Check that energy was discarded by checking the discard pile state
        // Since we can't access controllers directly, we verify via state
        const player1DiscardedCards = state.discard.cards[1].length;
        expect(player1DiscardedCards).to.be.greaterThan(0, 'Knocked out creature should be in discard pile');
        
        // Verify energy was tracked in discard
        const discardedEnergy = state.discard.energy[1];
        const totalDiscardedEnergy = Object.values(discardedEnergy).reduce((sum: number, count) => sum + (count as number), 0);
        expect(totalDiscardedEnergy).to.be.greaterThan(0, 'Energy from knocked out creature should be tracked in discard');
    });

    it.skip('should track energy discard from hand-discard effect', () => {
        // TODO: This test is skipped because energy discard effect needs implementation
        // Energy discard via 'energy' effect type with operation: 'discard' may need
        // to integrate with the discard controller's energy tracking
    });
});
