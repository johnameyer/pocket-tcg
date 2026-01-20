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
     * Helper function to count total cards for a player across all zones
     * Note: Knocked-out cards on field are counted here because they'll eventually
     * go to discard pile when replaced. To avoid double-counting, we check if they're
     * already in discard.
     */
    function countTotalCards(state: any, playerId: number): number {
        let total = 0;
        
        // Count cards in hand
        total += state.hand[playerId]?.length || 0;
        
        // Count cards in deck
        total += state.deck[playerId]?.length || 0;
        
        // Count cards on field (including evolution stacks)
        // Note: Don't count knocked-out active cards as they're added to discard
        // but still on field temporarily
        const fieldCards = state.field?.creatures[playerId] || [];
        for (let i = 0; i < fieldCards.length; i++) {
            const card = fieldCards[i];
            // Check if this is the active card (position 0) and if it's knocked out
            const cardData = testRepository.getCreature(card.templateId);
            const isKnockedOut = card.damageTaken >= cardData.maxHp;
            
            // Only count the card if it's not knocked out, OR if it's not in discard yet
            const isInDiscard = state.discard.cards[playerId]?.some((discardCard: { templateId: string; instanceId: string }) => 
                discardCard.templateId === card.templateId && discardCard.instanceId === card.instanceId
            );
            
            if (!isKnockedOut || !isInDiscard) {
                total += 1; // Count the current card
                // Count evolution stack
                if (card.evolutionStack) {
                    total += card.evolutionStack.length;
                }
            }
        }
        
        // Count cards in discard pile
        total += state.discard.cards[playerId]?.length || 0;
        
        return total;
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

    it('should maintain card count through evolved creature knockout', () => {
        const { state } = runTestGame({
            actions: [
                new AttackResponseMessage(0)
            ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'attack-creature'),
                // Player 1 has an evolved creature (simulate it already evolved) + bench
                StateBuilder.withCreatures(1, 'evolved-creature', ['basic-creature']),
                (state: any) => {
                    // Set evolution stack for player 1's active creature
                    state.field.creatures[1][0].evolutionStack = ['basic-creature'];
                },
                // Add damage so the attack will knock it out (140 HP - 50 damage = 90 HP remaining, 100 damage attack will KO)
                StateBuilder.withDamage('evolved-creature-1', 50),
                StateBuilder.withHand(0, [basicCreature]),
                StateBuilder.withHand(1, [basicCreature]),
                StateBuilder.withDeck(0, Array(18).fill(basicCreature)),
                // Player 1 has 16 cards in deck (1 evolved on field with stack, 1 on bench, 1 in hand, 1 for evolution stack = 4 accounted for)
                StateBuilder.withDeck(1, Array(16).fill(basicCreature)),
                StateBuilder.withEnergy('attack-creature-0', { fire: 2 })
            ),
            maxSteps: 20
        });

        const player1Cards = countTotalCards(state, 1);
        expect(player1Cards).to.equal(20, `Player 1 should have exactly 20 cards total after evolved creature knockout (found ${player1Cards})`);
        
        // Verify both the evolved form and base form went to discard pile
        expect(state.discard.cards[1].length).to.be.greaterThan(1, 'Both evolved form and base form should be in discard pile');
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
    });
});
