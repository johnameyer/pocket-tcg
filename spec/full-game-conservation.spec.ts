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
                evolvesFrom: 'Basic Fire',
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
     * Collect all card instance IDs for a player as an array (to detect duplicates)
     */
    function collectPlayerCardInstanceIds(state: ControllerState<Controllers>, playerId: number): string[] {
        const instanceIds: string[] = [];
        
        // Hand
        const hand = state.hand[playerId] || [];
        for (const card of hand) {
            instanceIds.push(card.instanceId);
        }
        
        // Deck
        const deck = state.deck[playerId] || [];
        for (const card of deck) {
            instanceIds.push(card.instanceId);
        }
        
        // Field
        const fieldCards = state.field?.creatures[playerId] || [];
        for (const card of fieldCards) {
            if (!card) continue;
            // For InstancedFieldCard, all cards from evolution stack
            if (card.evolutionStack) {
                // Evolution stack contains both pre-evolution forms and evolution cards used
                for (const stackCard of card.evolutionStack) {
                    instanceIds.push(stackCard.instanceId);
                }
            }
        }
        
        // Discard
        const discard = state.discard[playerId] || [];
        for (const card of discard) {
            instanceIds.push(card.instanceId);
        }
        
        return instanceIds;
    }

    /**
     * Count cards for a player using state inspection
     */
    function countPlayerCards(state: ControllerState<Controllers>, playerId: number): number {
        return collectPlayerCardInstanceIds(state, playerId).length;
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
        
        // Store initial instance IDs - these should NEVER change during the game
        let initialPlayer1InstanceIds: string[] | null = null;
        let initialPlayer2InstanceIds: string[] | null = null;
        let previousPlayer1EnergyByType: { [type: string]: number } = {};
        let previousPlayer2EnergyByType: { [type: string]: number } = {};
        let previousState: ControllerState<Controllers> | null = null;
        
        /**
         * Helper to check card conservation for a player
         */
        function checkPlayerCardConservation(playerId: number, playerName: string, currentState: ControllerState<Controllers>, step: number) {
            const currentInstanceIds = collectPlayerCardInstanceIds(currentState, playerId);
            const initialInstanceIds = playerId === 0 ? initialPlayer1InstanceIds : initialPlayer2InstanceIds;
            
            // Check for duplicates
            const uniqueIds = new Set(currentInstanceIds);
            if (uniqueIds.size !== currentInstanceIds.length) {
                const duplicates = currentInstanceIds.filter((id, index) => currentInstanceIds.indexOf(id) !== index);
                expect.fail(`${playerName} has duplicate instance IDs at step ${step}: ${duplicates.join(', ')}`);
            }
            
            // Check card count
            expect(currentInstanceIds.length).to.equal(20, 
                `${playerName} card count violated at step ${step}: expected 20, got ${currentInstanceIds.length}`);
            
            // Verify instance IDs never change from the start of the game
            if (initialInstanceIds) {
                const currentSet = new Set(currentInstanceIds);
                const initialSet = new Set(initialInstanceIds);
                
                const added = currentInstanceIds.filter(id => !initialSet.has(id));
                const missing = initialInstanceIds.filter(id => !currentSet.has(id));
                
                if (added.length > 0 || missing.length > 0) {
                    expect.fail(`${playerName} instance IDs changed at step ${step}: added [${added.join(', ')}], missing [${missing.join(', ')}]`);
                }
            }
        }
        
        /**
         * Helper to check energy conservation for a player
         */
        function checkPlayerEnergyConservation(playerId: number, playerName: string, currentState: ControllerState<Controllers>, step: number) {
            if (!previousState) return;
            
            const currentEnergyByType = countPlayerEnergyByType(currentState, playerId);
            const previousEnergyByType = playerId === 0 ? previousPlayer1EnergyByType : previousPlayer2EnergyByType;
            
            // Energy should never decrease unexpectedly for any type
            for (const type of Object.keys(previousEnergyByType)) {
                const currentCount = currentEnergyByType[type] || 0;
                const previousCount = previousEnergyByType[type] || 0;
                if (currentCount < previousCount) {
                    // This is acceptable if there was a knockout
                    const hasDiscard = (currentState.discard[playerId]?.length || 0) > (previousState.discard[playerId]?.length || 0);
                    if (!hasDiscard) {
                        expect.fail(`${playerName} ${type} energy decreased without discard at step ${step}: ${previousCount} -> ${currentCount}`);
                    }
                }
            }
            
            // Update previous energy
            if (playerId === 0) {
                previousPlayer1EnergyByType = currentEnergyByType;
            } else {
                previousPlayer2EnergyByType = currentEnergyByType;
            }
        }
        
        runBotGame({
            customRepository: gameRepository,
            initialDecks: [player1Deck, player2Deck],
            maxSteps: 500,
            integrityCheck: (currentState, step) => {
                // Capture initial instance IDs on first step
                if (!initialPlayer1InstanceIds) {
                    initialPlayer1InstanceIds = collectPlayerCardInstanceIds(currentState, 0);
                    initialPlayer2InstanceIds = collectPlayerCardInstanceIds(currentState, 1);
                }
                
                // Check card conservation for both players
                checkPlayerCardConservation(0, 'Player 1', currentState, step);
                checkPlayerCardConservation(1, 'Player 2', currentState, step);
                
                // Check energy conservation for both players
                checkPlayerEnergyConservation(0, 'Player 1', currentState, step);
                checkPlayerEnergyConservation(1, 'Player 2', currentState, step);
                
                previousState = currentState;
            }
        });
        
        // Verification is done in the integrity check after each step
        // No need for additional final verification
    });
});
