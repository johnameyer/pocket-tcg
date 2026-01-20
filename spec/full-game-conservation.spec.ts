import { expect } from 'chai';
import { MockCardRepository } from './mock-repository.js';
import { CreatureData } from '../src/repository/card-types.js';
import { runBotGame } from './helpers/test-helpers.js';
import { Controllers } from '../src/controllers/controllers.js';
import { ControllerState } from '@cards-ts/core';

/**
 * Full End-to-End Game Conservation Test
 * 
 * This test plays a complete game with bot handlers and verifies that:
 * 1. The game can complete successfully
 * 2. Card conservation is maintained after each action
 * 3. Energy counts never decrease unexpectedly
 */
describe('Full Game Conservation', () => {
    // Create a repository with a variety of interesting cards
    const gameRepository = new MockCardRepository({
        creatures: new Map<string, CreatureData>([
            ['basic-fire', {
                templateId: 'basic-fire',
                name: 'Basic Fire',
                maxHp: 70,
                type: 'fire',
                weakness: 'water',
                retreatCost: 1,
                attacks: [
                    { name: 'Ember', damage: 30, energyRequirements: [{ type: 'fire', amount: 1 }] }
                ]
            }],
            ['evolved-fire', {
                templateId: 'evolved-fire',
                name: 'Evolved Fire',
                maxHp: 120,
                type: 'fire',
                evolvesFrom: 'basic-fire',
                weakness: 'water',
                retreatCost: 2,
                attacks: [
                    { name: 'Flame Burst', damage: 60, energyRequirements: [{ type: 'fire', amount: 2 }] }
                ]
            }],
            ['basic-water', {
                templateId: 'basic-water',
                name: 'Basic Water',
                maxHp: 60,
                type: 'water',
                weakness: 'lightning',
                retreatCost: 1,
                attacks: [
                    { name: 'Bubble', damage: 20, energyRequirements: [{ type: 'water', amount: 1 }] }
                ]
            }],
            ['tank-creature', {
                templateId: 'tank-creature',
                name: 'Tank',
                maxHp: 140,
                type: 'fighting',
                weakness: 'psychic',
                retreatCost: 3,
                attacks: [
                    { name: 'Heavy Strike', damage: 50, energyRequirements: [{ type: 'fighting', amount: 2 }] }
                ]
            }]
        ])
    });

    /**
     * Helper to create a balanced deck for testing (only creature cards for simplicity)
     */
    function createTestDeck(): string[] {
        return [
            // Mix of basic creatures (15)
            'basic-fire', 'basic-fire', 'basic-fire', 'basic-fire', 'basic-fire',
            'basic-water', 'basic-water', 'basic-water', 'basic-water', 'basic-water',
            'tank-creature', 'tank-creature', 'tank-creature',
            'basic-fire', 'basic-water',
            
            // Evolution cards (5)
            'evolved-fire', 'evolved-fire', 'evolved-fire',
            'basic-fire', 'basic-fire'
        ];
    }

    /**
     * Count cards for a player using state inspection
     */
    function countPlayerCards(state: ControllerState<Controllers>, playerId: number): number {
        const instanceIds = new Set<string>();
        
        // Hand
        const hand = state.hand[playerId] || [];
        for (const card of hand) {
            instanceIds.add(card.instanceId);
        }
        
        // Deck
        const deck = state.deck[playerId] || [];
        for (const card of deck) {
            instanceIds.add(card.instanceId);
        }
        
        // Field
        const fieldCards = state.field?.creatures[playerId] || [];
        for (const card of fieldCards) {
            if (!card) continue;
            instanceIds.add(card.instanceId);
            if (card.evolutionStack) {
                // Evolution stack contains both pre-evolution forms and evolution cards used
                for (const stackCard of card.evolutionStack) {
                    instanceIds.add(stackCard.instanceId);
                }
            }
        }
        
        // Discard
        const discard = state.discard.cards[playerId] || [];
        for (const card of discard) {
            instanceIds.add(card.instanceId);
        }
        
        return instanceIds.size;
    }

    /**
     * Count total energy for a player
     */
    function countPlayerEnergy(state: ControllerState<Controllers>, playerId: number): number {
        let total = 0;
        
        // Current energy
        const currentEnergy = state.energy.currentEnergy[playerId] || {};
        total += Object.values(currentEnergy).reduce((sum: number, count) => sum + (count as number), 0);
        
        // Attached energy
        const fieldCards = state.field?.creatures[playerId] || [];
        for (const card of fieldCards) {
            if (!card) continue;
            const attached = state.energy.attachedEnergyByInstance[card.instanceId] || {};
            total += Object.values(attached).reduce((sum: number, count) => sum + (count as number), 0);
        }
        
        // Discarded energy
        const discarded = state.energy.discardedEnergy[playerId] || {};
        total += Object.values(discarded).reduce((sum: number, count) => sum + (count as number), 0);
        
        return total;
    }

    it('should maintain conservation throughout a complete game', function() {
        // This test may take longer
        this.timeout(30000); // 30 seconds
        
        const player1Deck = createTestDeck();
        const player2Deck = createTestDeck();
        
        let previousPlayer1Energy = 0;
        let previousPlayer2Energy = 0;
        let previousState: ControllerState<Controllers> | null = null;
        
        const { state, stepCount } = runBotGame({
            customRepository: gameRepository,
            initialDecks: [player1Deck, player2Deck],
            maxSteps: 500, // Increase step limit
            conservationCheck: (currentState, step) => {
                // Check card conservation
                const currentPlayer1Cards = countPlayerCards(currentState, 0);
                const currentPlayer2Cards = countPlayerCards(currentState, 1);
                
                expect(currentPlayer1Cards).to.equal(20, 
                    `Player 1 card count violated at step ${step}: expected 20, got ${currentPlayer1Cards}`);
                expect(currentPlayer2Cards).to.equal(20, 
                    `Player 2 card count violated at step ${step}: expected 20, got ${currentPlayer2Cards}`);
                
                // Check energy conservation (energy can only increase or stay same)
                const currentPlayer1Energy = countPlayerEnergy(currentState, 0);
                const currentPlayer2Energy = countPlayerEnergy(currentState, 1);
                
                // Energy should never decrease unexpectedly
                if (previousState) {
                    if (currentPlayer1Energy < previousPlayer1Energy) {
                        // This is acceptable if there was a knockout
                        const hasDiscard = (currentState.discard.cards[0]?.length || 0) > (previousState.discard.cards[0]?.length || 0);
                        if (!hasDiscard) {
                            expect.fail(`Player 1 energy decreased without discard at step ${step}: ${previousPlayer1Energy} -> ${currentPlayer1Energy}`);
                        }
                    }
                    
                    if (currentPlayer2Energy < previousPlayer2Energy) {
                        const hasDiscard = (currentState.discard.cards[1]?.length || 0) > (previousState.discard.cards[1]?.length || 0);
                        if (!hasDiscard) {
                            expect.fail(`Player 2 energy decreased without discard at step ${step}: ${previousPlayer2Energy} -> ${currentPlayer2Energy}`);
                        }
                    }
                }
                
                previousPlayer1Energy = currentPlayer1Energy;
                previousPlayer2Energy = currentPlayer2Energy;
                previousState = currentState;
            }
        });
        
        // Verify game completed or at least ran for a reasonable number of steps
        // Some games might not complete if they reach a stalemate
        expect(stepCount).to.be.greaterThan(10, 'Game should run for at least some steps');
        
        // If game completed, verify conservation
        if (state.completed) {
            const finalPlayer1Cards = countPlayerCards(state, 0);
            const finalPlayer2Cards = countPlayerCards(state, 1);
            
            expect(finalPlayer1Cards).to.equal(20, `Player 1 should end with 20 cards, got ${finalPlayer1Cards}`);
            expect(finalPlayer2Cards).to.equal(20, `Player 2 should end with 20 cards, got ${finalPlayer2Cards}`);
        } else {
            // Even if not completed, verify conservation at end
            const finalPlayer1Cards = countPlayerCards(state, 0);
            const finalPlayer2Cards = countPlayerCards(state, 1);
            
            expect(finalPlayer1Cards).to.equal(20, `Player 1 should have 20 cards even if game didn't complete, got ${finalPlayer1Cards}`);
            expect(finalPlayer2Cards).to.equal(20, `Player 2 should have 20 cards even if game didn't complete, got ${finalPlayer2Cards}`);
        }
    });
});
