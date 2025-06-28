import { AbstractController, GenericControllerProvider, IndexedControllers } from '@cards-ts/core';
import { Card, CreatureCard, SupporterCard, ItemCard, GameCard } from './card-types.js';
import { DeckController } from './deck-controller.js';

type HandDependencies = {
    deck: DeckController;
};

export class HandControllerProvider implements GenericControllerProvider<GameCard[][], HandDependencies, HandController> {
    controller(state: GameCard[][], controllers: HandDependencies): HandController {
        return new HandController(state, controllers);
    }
    
    initialState(controllers: HandDependencies): GameCard[][] {
        return new Array(controllers.deck.getPlayerCount()).fill(undefined)
            .map(() => []);
    }
    
    dependencies() {
        return { deck: true } as const;
    }
}

export class HandController extends AbstractController<GameCard[][], HandDependencies, GameCard[]> {
    initialize(playerCount: number): void {
        this.state = new Array(playerCount).fill(undefined)
            .map(() => []);
    }
    
    // Draw a card from deck to hand
    drawCard(playerId: number): GameCard | undefined {
        const card = this.controllers.deck.drawCard(playerId);
        if (card) {
            this.state[playerId].push(card);
        }
        return card;
    }
    
    // Draw initial hand (5 cards)
    drawInitialHand(playerId: number): void {
        for (let i = 0; i < 5; i++) {
            this.drawCard(playerId);
        }
    }
    
    // Play a card from hand
    playCard(playerId: number, cardIndex: number): GameCard | undefined {
        if (cardIndex < 0 || cardIndex >= this.state[playerId].length) {
            return undefined;
        }
        
        // Remove the card from hand
        const card = this.state[playerId].splice(cardIndex, 1)[0];
        return card;
    }
    
    // Get a player's hand
    getHand(playerId: number): GameCard[] {
        return this.state[playerId];
    }
    
    // Get hand size
    getHandSize(playerId: number): number {
        return this.state[playerId].length;
    }
    
    // Required by AbstractController
    getFor(position: number): GameCard[] {
        return this.getHand(position);
    }
    
    // Required by AbstractController
    validate(): void {
        // Validation logic if needed
    }
}