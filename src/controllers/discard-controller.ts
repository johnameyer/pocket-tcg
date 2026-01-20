import { AbstractController, GenericControllerProvider, GenericHandlerController, SystemHandlerParams } from '@cards-ts/core';
import { GameCard } from './card-types.js';
import { AttachableEnergyType, EnergyDictionary } from './energy-controller.js';
import { ResponseMessage } from '../messages/response-message.js';
import { GameHandlerParams } from '../game-handler-params.js';
import { emptyEnergyDict } from '../utils/energy-utils.js';

export type DiscardState = {
    cards: GameCard[][];
};

type DiscardDependencies = {
    players: GenericHandlerController<ResponseMessage, GameHandlerParams & SystemHandlerParams>;
};

export class DiscardControllerProvider implements GenericControllerProvider<DiscardState, DiscardDependencies, DiscardController> {
    controller(state: DiscardState, controllers: DiscardDependencies): DiscardController {
        return new DiscardController(state, controllers);
    }
    
    initialState(controllers: DiscardDependencies): DiscardState {
        return {
            cards: new Array(controllers.players.count).fill(undefined).map(() => [])
        };
    }
    
    dependencies() {
        return { players: true } as const;
    }
}

/**
 * Controller for managing discarded cards.
 * Tracks cards that have been discarded from hand or knocked out from field.
 * Energy discard tracking is handled by EnergyController.
 */
export class DiscardController extends AbstractController<DiscardState, DiscardDependencies, GameCard[]> {
    
    // Add cards to the discard pile (varargs)
    addCards(playerId: number, ...cards: GameCard[]): void {
        if (playerId < 0) {
            throw new Error(`Invalid player ID: ${playerId}`);
        }
        
        // Initialize if needed
        if (!this.state.cards[playerId]) {
            this.state.cards[playerId] = [];
        }
        
        this.state.cards[playerId].push(...cards);
    }
    
    // Get a player's discard pile
    getDiscardPile(playerId: number): GameCard[] {
        if (playerId < 0 || playerId >= this.state.cards.length) {
            return [];
        }
        return this.state.cards[playerId];
    }
    
    // Get discard pile size
    getDiscardPileSize(playerId: number): number {
        if (!this.state.cards[playerId]) {
            return 0;
        }
        return this.state.cards[playerId].length;
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
