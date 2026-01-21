import { GenericControllerProvider, GlobalController } from '@cards-ts/core';
import { GameCard } from './card-types.js';
import { FieldCard } from './field-controller.js';

type DiscardState = {
    discardPiles: GameCard[][];
};

// Dependencies for this controller
type DiscardDependencies = {
    // No dependencies needed for basic discard operations
};

export class DiscardControllerProvider implements GenericControllerProvider<DiscardState, DiscardDependencies, DiscardController> {
    controller(state: DiscardState, controllers: DiscardDependencies): DiscardController {
        return new DiscardController(state, controllers);
    }
    
    initialState(controllers: DiscardDependencies): DiscardState {
        // Note: Player count is not available in initialState for controllers without player dependency
        // The initialize() method will properly populate discardPiles when the game starts
        return {
            discardPiles: []
        };
    }
    
    dependencies() {
        return {} as const;
    }
}

/**
 * Controller for managing the discard pile.
 * Tracks all cards that have been discarded from hand or knocked out from field.
 * This is a GlobalController as all players can see what has been discarded.
 */
export class DiscardController extends GlobalController<DiscardState, DiscardDependencies> {
    validate(): void {
        if (!Array.isArray(this.state.discardPiles)) {
            throw new Error('Discard piles must be an array');
        }
    }
    
    initialize(playerCount: number): void {
        // Initialize empty discard pile for each player
        this.state.discardPiles = new Array(playerCount).fill(undefined).map(() => []);
    }
    
    /**
     * Add a card to the discard pile.
     * 
     * @param playerId The player whose discard pile to add to
     * @param card The card to discard
     */
    discardCard(playerId: number, card: GameCard): void {
        if (playerId < 0 || playerId >= this.state.discardPiles.length) {
            throw new Error(`Invalid player ID: ${playerId}`);
        }
        
        this.state.discardPiles[playerId].push(card);
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
        if (playerId < 0 || playerId >= this.state.discardPiles.length) {
            throw new Error(`Invalid player ID: ${playerId}`);
        }
        
        // Convert FieldCard to GameCard
        const gameCard: GameCard = {
            instanceId: fieldCard.instanceId,
            templateId: fieldCard.templateId,
            type: 'creature'
        };
        
        this.state.discardPiles[playerId].push(gameCard);
    }
    
    /**
     * Get a player's discard pile.
     * 
     * @param playerId The player whose discard pile to retrieve
     * @returns Array of discarded cards
     */
    getDiscardPile(playerId: number): GameCard[] {
        if (playerId < 0 || playerId >= this.state.discardPiles.length) {
            throw new Error(`Invalid player ID: ${playerId}`);
        }
        
        return this.state.discardPiles[playerId];
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
}
