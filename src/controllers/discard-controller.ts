import { AbstractController, GenericControllerProvider, GenericHandlerController, SystemHandlerParams } from '@cards-ts/core';
import { GameCard } from './card-types.js';
import { AttachableEnergyType, EnergyDictionary } from './energy-controller.js';
import { ResponseMessage } from '../messages/response-message.js';
import { GameHandlerParams } from '../game-handler-params.js';
import { emptyEnergyDict } from '../utils/energy-utils.js';

export type DiscardState = {
    cards: GameCard[][];
    energy: EnergyDictionary[];
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
            cards: new Array(controllers.players.count).fill(undefined).map(() => []),
            energy: new Array(controllers.players.count).fill(undefined).map(() => emptyEnergyDict())
        };
    }
    
    dependencies() {
        return { players: true } as const;
    }
}

/**
 * Controller for managing discarded cards and energy.
 * Tracks cards that have been discarded from hand or knocked out from field.
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
    
    // Add energy to the discarded energy pile
    addEnergy(playerId: number, energyType: AttachableEnergyType, amount: number = 1): void {
        if (playerId < 0) {
            throw new Error(`Invalid player ID: ${playerId}`);
        }
        
        // Initialize if needed
        if (!this.state.energy[playerId]) {
            this.state.energy[playerId] = emptyEnergyDict();
        }
        
        this.state.energy[playerId][energyType] += amount;
    }
    
    // Add an energy dictionary to the discarded energy pile
    addEnergyDict(playerId: number, energy: EnergyDictionary): void {
        if (playerId < 0) {
            throw new Error(`Invalid player ID: ${playerId}`);
        }
        
        // Initialize if needed
        if (!this.state.energy[playerId]) {
            this.state.energy[playerId] = emptyEnergyDict();
        }
        
        for (const energyType of Object.keys(energy) as AttachableEnergyType[]) {
            this.state.energy[playerId][energyType] += energy[energyType];
        }
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
    
    // Get discarded energy for a player
    getDiscardedEnergy(playerId: number): EnergyDictionary {
        if (playerId < 0 || playerId >= this.state.energy.length) {
            return emptyEnergyDict();
        }
        return { ...this.state.energy[playerId] };
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
