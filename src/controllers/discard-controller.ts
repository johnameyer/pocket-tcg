import { AbstractController, GenericControllerProvider } from '@cards-ts/core';
import { GameCard } from './card-types.js';
import { AttachableEnergyType, EnergyDictionary } from './energy-controller.js';

// Dependencies for this controller
type DiscardDependencies = {
    // No dependencies needed for basic discard operations
};

export class DiscardControllerProvider implements GenericControllerProvider<GameCard[][], DiscardDependencies, DiscardController> {
    controller(state: GameCard[][], controllers: DiscardDependencies): DiscardController {
        return new DiscardController(state, controllers);
    }
    
    initialState(): GameCard[][] {
        return [];
    }
    
    dependencies() {
        return {} as const;
    }
}

/**
 * Controller for managing discarded cards and energy.
 * Tracks cards that have been discarded from hand or knocked out from field.
 */
export class DiscardController extends AbstractController<GameCard[][], DiscardDependencies, GameCard[]> {
    private playerCount: number = 0;
    
    // Track discarded energy separately
    private discardedEnergy: EnergyDictionary[] = [];
    
    initialize(playerCount: number): void {
        this.playerCount = playerCount;
        this.state = [];
        this.discardedEnergy = [];
        
        // Initialize empty discard piles for each player
        for (let i = 0; i < playerCount; i++) {
            this.state[i] = [];
            this.discardedEnergy[i] = this.emptyEnergyDict();
        }
    }
    
    private emptyEnergyDict(): EnergyDictionary {
        return {
            grass: 0, fire: 0, water: 0, lightning: 0,
            psychic: 0, fighting: 0, darkness: 0, metal: 0
        };
    }
    
    // Add a card to the discard pile
    addCard(playerId: number, card: GameCard): void {
        if (playerId < 0) {
            throw new Error(`Invalid player ID: ${playerId}`);
        }
        
        // Initialize if needed
        if (!this.state[playerId]) {
            this.state[playerId] = [];
        }
        
        this.state[playerId].push(card);
    }
    
    // Add multiple cards to the discard pile
    addCards(playerId: number, cards: GameCard[]): void {
        if (playerId < 0) {
            throw new Error(`Invalid player ID: ${playerId}`);
        }
        
        // Initialize if needed
        if (!this.state[playerId]) {
            this.state[playerId] = [];
        }
        
        this.state[playerId].push(...cards);
    }
    
    // Add energy to the discarded energy pile
    addEnergy(playerId: number, energyType: AttachableEnergyType, amount: number = 1): void {
        if (playerId < 0) {
            throw new Error(`Invalid player ID: ${playerId}`);
        }
        
        // Initialize if needed
        if (!this.discardedEnergy[playerId]) {
            this.discardedEnergy[playerId] = this.emptyEnergyDict();
        }
        
        this.discardedEnergy[playerId][energyType] += amount;
    }
    
    // Add an energy dictionary to the discarded energy pile
    addEnergyDict(playerId: number, energy: EnergyDictionary): void {
        if (playerId < 0) {
            throw new Error(`Invalid player ID: ${playerId}`);
        }
        
        // Initialize if needed
        if (!this.discardedEnergy[playerId]) {
            this.discardedEnergy[playerId] = this.emptyEnergyDict();
        }
        
        for (const energyType of Object.keys(energy) as AttachableEnergyType[]) {
            this.discardedEnergy[playerId][energyType] += energy[energyType];
        }
    }
    
    // Get a player's discard pile
    getDiscardPile(playerId: number): GameCard[] {
        if (playerId < 0 || playerId >= this.playerCount) {
            return [];
        }
        return this.state[playerId];
    }
    
    // Get discard pile size
    getDiscardPileSize(playerId: number): number {
        if (!this.state[playerId]) {
            return 0;
        }
        return this.state[playerId].length;
    }
    
    // Get discarded energy for a player
    getDiscardedEnergy(playerId: number): EnergyDictionary {
        if (playerId < 0 || playerId >= this.playerCount) {
            return this.emptyEnergyDict();
        }
        return { ...this.discardedEnergy[playerId] };
    }
    
    // Get total discarded energy count for a player
    getTotalDiscardedEnergy(playerId: number): number {
        const energy = this.getDiscardedEnergy(playerId);
        return Object.values(energy).reduce((sum, count) => sum + count, 0);
    }
    
    // Required by AbstractController
    // Return the discard pile for a specific player
    getFor(position: number): GameCard[] {
        return this.getDiscardPile(position);
    }
    
    // Required by AbstractController
    validate(): void {
        // No validation needed for discard pile - cards can be added freely as they're discarded
    }
}
