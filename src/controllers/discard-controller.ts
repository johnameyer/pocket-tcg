import { GenericControllerProvider, GlobalController, GenericHandlerController, SystemHandlerParams } from '@cards-ts/core';
import { GameCard } from './card-types.js';
import { FieldCard } from './field-controller.js';
import { ResponseMessage } from '../messages/response-message.js';
import { GameHandlerParams } from '../game-handler-params.js';

// Dependencies for this controller
type DiscardDependencies = {
    players: GenericHandlerController<ResponseMessage, GameHandlerParams & SystemHandlerParams>;
};

export class DiscardControllerProvider implements GenericControllerProvider<GameCard[][], DiscardDependencies, DiscardController> {
    controller(state: GameCard[][], controllers: DiscardDependencies): DiscardController {
        return new DiscardController(state, controllers);
    }
    
    initialState(controllers: DiscardDependencies): GameCard[][] {
        // Initialize empty discard pile for each player
        return new Array(controllers.players.count).fill(undefined).map(() => []);
    }
    
    dependencies() {
        return { players: true } as const;
    }
}

/**
 * Controller for managing the discard pile.
 * Tracks all cards that have been discarded from hand or knocked out from field.
 * This is a GlobalController as all players can see what has been discarded.
 */
export class DiscardController extends GlobalController<GameCard[][], DiscardDependencies> {
    validate(): void {
        if (!Array.isArray(this.state)) {
            throw new Error('Discard piles must be an array');
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
     * Converts the InstancedFieldCard to GameCard(s) before discarding.
     * When the card has an evolution stack, all cards in the stack are discarded.
     * 
     * @param playerId The player whose discard pile to add to
     * @param fieldCard The field card to discard
     */
    discardFieldCard(playerId: number, fieldCard: FieldCard | import('../repository/card-types.js').InstancedFieldCard): void {
        if (playerId < 0 || playerId >= this.state.length) {
            throw new Error(`Invalid player ID: ${playerId}`);
        }
        
        // Check if this is an InstancedFieldCard with an evolution stack
        if ('evolutionStack' in fieldCard) {
            // Discard all cards in the evolution stack
            for (const stackCard of fieldCard.evolutionStack) {
                const gameCard: GameCard = {
                    instanceId: stackCard.instanceId,
                    templateId: stackCard.templateId,
                    type: 'creature'
                };
                this.state[playerId].push(gameCard);
            }
        } else {
            // Regular FieldCard - convert to GameCard
            const gameCard: GameCard = {
                instanceId: fieldCard.instanceId,
                templateId: fieldCard.templateId,
                type: 'creature'
            };
            this.state[playerId].push(gameCard);
        }
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
}
