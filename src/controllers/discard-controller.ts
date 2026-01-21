import { AbstractController, GenericControllerProvider, IndexedControllers } from '@cards-ts/core';
import { GameCard } from './card-types.js';
import { FieldCard } from './field-controller.js';

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
 * Controller for managing the discard pile.
 * Tracks all cards that have been discarded from hand or knocked out from field.
 */
export class DiscardController extends AbstractController<GameCard[][], DiscardDependencies, GameCard[]> {
    private playerCount: number = 0;
    
    initialize(playerCount: number): void {
        this.playerCount = playerCount;
        this.state = [];
        
        // Initialize empty discard pile for each player
        for (let i = 0; i < playerCount; i++) {
            this.state[i] = [];
        }
    }
    
    /**
     * Add a card to the discard pile.
     * 
     * @param playerId The player whose discard pile to add to
     * @param card The card to discard
     */
    discardCard(playerId: number, card: GameCard): void {
        if (playerId < 0 || playerId >= this.state.length) {
            throw new Error(`Invalid player ID: ${playerId}`);
        }
        
        this.state[playerId].push(card);
    }
    
    /**
     * Add multiple cards to the discard pile.
     * 
     * @param playerId The player whose discard pile to add to
     * @param cards The cards to discard
     */
    discardCards(playerId: number, cards: GameCard[]): void {
        for (const card of cards) {
            this.discardCard(playerId, card);
        }
    }
    
    /**
     * Add a field card to the discard pile.
     * Converts the FieldCard to a GameCard before discarding.
     * 
     * @param playerId The player whose discard pile to add to
     * @param fieldCard The field card to discard
     */
    discardFieldCard(playerId: number, fieldCard: FieldCard): void {
        if (playerId < 0 || playerId >= this.state.length) {
            throw new Error(`Invalid player ID: ${playerId}`);
        }
        
        // Convert FieldCard to GameCard
        const gameCard: GameCard = {
            instanceId: fieldCard.instanceId,
            templateId: fieldCard.templateId,
            type: 'creature'
        };
        
        this.state[playerId].push(gameCard);
    }
    
    /**
     * Get a player's discard pile.
     * 
     * @param playerId The player whose discard pile to retrieve
     * @returns Array of discarded cards
     */
    getDiscardPile(playerId: number): GameCard[] {
        if (playerId < 0 || playerId >= this.state.length) {
            throw new Error(`Invalid player ID: ${playerId}`);
        }
        
        return this.state[playerId];
    }
    
    /**
     * Get the size of a player's discard pile.
     * 
     * @param playerId The player whose discard pile size to retrieve
     * @returns Number of cards in discard pile
     */
    getDiscardPileSize(playerId: number): number {
        return this.getDiscardPile(playerId).length;
    }
    
    /**
     * Get player count.
     */
    getPlayerCount(): number {
        return this.playerCount;
    }
    
    // Required by AbstractController
    getFor(position: number): GameCard[] {
        return this.getDiscardPile(position);
    }
    
    // Required by AbstractController
    validate(): void {
        // Validation logic if needed
    }
}
