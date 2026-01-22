import { expect } from 'chai';
import { MockCardRepository } from './mock-repository.js';
import { CreatureData } from '../src/repository/card-types.js';
import { runBotGame } from './helpers/test-helpers.js';
import { Controllers } from '../src/controllers/controllers.js';
import { ControllerState } from '@cards-ts/core';
import { getCurrentInstanceId } from '../src/utils/field-card-utils.js';

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
     * Collect all card instance IDs for a player
     */
    function collectPlayerCardInstanceIds(state: ControllerState<Controllers>, playerId: number): Set<string> {
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
            // For InstancedFieldCard, all cards from evolution stack
            if (card.evolutionStack) {
                // Evolution stack contains both pre-evolution forms and evolution cards used
                for (const stackCard of card.evolutionStack) {
                    instanceIds.add(stackCard.instanceId);
                }
            }
        }
        
        // Discard
        const discard = state.discard[playerId] || [];
        for (const card of discard) {
            instanceIds.add(card.instanceId);
        }
        
        return instanceIds;
    }

    /**
     * Count cards for a player using state inspection
     */
    function countPlayerCards(state: ControllerState<Controllers>, playerId: number): number {
        return collectPlayerCardInstanceIds(state, playerId).size;
    }

    /**
     * Count total energy for a player by type
     */
    function countPlayerEnergyByType(state: ControllerState<Controllers>, playerId: number): { [type: string]: number } {
        const energyByType: { [type: string]: number } = {};
        
        // Current energy
        const currentEnergy = state.energy.currentEnergy[playerId];
        if (currentEnergy) {
            energyByType[currentEnergy] = (energyByType[currentEnergy] || 0) + 1;
        }
        
        // Attached energy
        const fieldCards = state.field?.creatures[playerId] || [];
        for (const card of fieldCards) {
            if (!card) continue;
            // Use fieldInstanceId to access attached energy
            const attached = state.energy.attachedEnergyByInstance[card.fieldInstanceId] || {};
            for (const [type, count] of Object.entries(attached)) {
                energyByType[type] = (energyByType[type] || 0) + (count as number);
            }
        }
        
        // Discarded energy
        const discarded = state.energy.discardedEnergy[playerId] || {};
        for (const [type, count] of Object.entries(discarded)) {
            energyByType[type] = (energyByType[type] || 0) + (count as number);
        }
        
        return energyByType;
    }

    /**
     * Count total energy for a player
     */
    function countPlayerEnergy(state: ControllerState<Controllers>, playerId: number): number {
        const energyByType = countPlayerEnergyByType(state, playerId);
        return Object.values(energyByType).reduce((sum: number, count) => sum + (count as number), 0);
    }

    it('should maintain conservation throughout a complete game', function() {
        // This test may take longer
        this.timeout(30000); // 30 seconds
        
        const player1Deck = createTestDeck();
        const player2Deck = createTestDeck();
        
        let previousPlayer1InstanceIds: Set<string> | null = null;
        let previousPlayer2InstanceIds: Set<string> | null = null;
        let previousPlayer1EnergyByType: { [type: string]: number } = {};
        let previousPlayer2EnergyByType: { [type: string]: number } = {};
        let previousState: ControllerState<Controllers> | null = null;
        
        runBotGame({
            customRepository: gameRepository,
            initialDecks: [player1Deck, player2Deck],
            maxSteps: 500,
            integrityCheck: (currentState, step) => {
                // Check card conservation using instance ID sets
                const currentPlayer1InstanceIds = collectPlayerCardInstanceIds(currentState, 0);
                const currentPlayer2InstanceIds = collectPlayerCardInstanceIds(currentState, 1);
                
                expect(currentPlayer1InstanceIds.size).to.equal(20, 
                    `Player 1 card count violated at step ${step}: expected 20, got ${currentPlayer1InstanceIds.size}`);
                expect(currentPlayer2InstanceIds.size).to.equal(20, 
                    `Player 2 card count violated at step ${step}: expected 20, got ${currentPlayer2InstanceIds.size}`);
                
                // Verify no duplicate instance IDs (each card is unique)
                if (previousPlayer1InstanceIds) {
                    // Cards can move between zones but the set of instance IDs should remain the same
                    const player1Diff = [...currentPlayer1InstanceIds].filter(id => !previousPlayer1InstanceIds!.has(id));
                    const player1Missing = [...previousPlayer1InstanceIds].filter(id => !currentPlayer1InstanceIds.has(id));
                    if (player1Diff.length > 0 || player1Missing.length > 0) {
                        expect.fail(`Player 1 instance IDs changed at step ${step}: added ${player1Diff}, removed ${player1Missing}`);
                    }
                }
                
                if (previousPlayer2InstanceIds) {
                    const player2Diff = [...currentPlayer2InstanceIds].filter(id => !previousPlayer2InstanceIds!.has(id));
                    const player2Missing = [...previousPlayer2InstanceIds].filter(id => !currentPlayer2InstanceIds.has(id));
                    if (player2Diff.length > 0 || player2Missing.length > 0) {
                        expect.fail(`Player 2 instance IDs changed at step ${step}: added ${player2Diff}, removed ${player2Missing}`);
                    }
                }
                
                // Check energy conservation by type (energy can only increase or stay same, never decrease unexpectedly)
                const currentPlayer1EnergyByType = countPlayerEnergyByType(currentState, 0);
                const currentPlayer2EnergyByType = countPlayerEnergyByType(currentState, 1);
                
                // Energy should never decrease unexpectedly for any type
                if (previousState) {
                    for (const type of Object.keys(previousPlayer1EnergyByType)) {
                        const currentCount = currentPlayer1EnergyByType[type] || 0;
                        const previousCount = previousPlayer1EnergyByType[type] || 0;
                        if (currentCount < previousCount) {
                            // This is acceptable if there was a knockout
                            const hasDiscard = (currentState.discard[0]?.length || 0) > (previousState.discard[0]?.length || 0);
                            if (!hasDiscard) {
                                expect.fail(`Player 1 ${type} energy decreased without discard at step ${step}: ${previousCount} -> ${currentCount}`);
                            }
                        }
                    }
                    
                    for (const type of Object.keys(previousPlayer2EnergyByType)) {
                        const currentCount = currentPlayer2EnergyByType[type] || 0;
                        const previousCount = previousPlayer2EnergyByType[type] || 0;
                        if (currentCount < previousCount) {
                            const hasDiscard = (currentState.discard[1]?.length || 0) > (previousState.discard[1]?.length || 0);
                            if (!hasDiscard) {
                                expect.fail(`Player 2 ${type} energy decreased without discard at step ${step}: ${previousCount} -> ${currentCount}`);
                            }
                        }
                    }
                }
                
                previousPlayer1InstanceIds = currentPlayer1InstanceIds;
                previousPlayer2InstanceIds = currentPlayer2InstanceIds;
                previousPlayer1EnergyByType = currentPlayer1EnergyByType;
                previousPlayer2EnergyByType = currentPlayer2EnergyByType;
                previousState = currentState;
            }
        });
        
        // Verification is done in the integrity check after each step
        // No need for additional final verification
    });
});
