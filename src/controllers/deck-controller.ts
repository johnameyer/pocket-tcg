import { AbstractController, GenericControllerProvider } from '@cards-ts/core';
import { GameCard } from './card-types.js';
import { CardRepositoryController } from './card-repository-controller.js';

// Dependencies for this controller
type DeckDependencies = {
    cardRepository: CardRepositoryController
};

export class DeckControllerProvider implements GenericControllerProvider<GameCard[][], DeckDependencies, DeckController> {
    controller(state: GameCard[][], controllers: DeckDependencies): DeckController {
        return new DeckController(state, controllers);
    }
    
    initialState(): GameCard[][] {
        return [];
    }
    
    dependencies() {
        return { cardRepository: true } as const;
    }
}

export class DeckController extends AbstractController<GameCard[][], DeckDependencies, GameCard[]> {
    private playerCount: number = 0;
    
    initialize(playerCount: number, initialDecks?: GameCard[][] | string[][]): void {
        this.playerCount = playerCount;
        this.state = [];
        
        // If initial decks are provided, use them
        if (initialDecks && initialDecks.length >= playerCount) {
            for (let i = 0; i < playerCount; i++) {
                // Check if we have string IDs or GameCard objects
                if (initialDecks[i].length > 0 && typeof initialDecks[i][0] === 'string') {
                    // Convert string IDs to GameCard objects
                    const stringDecks = initialDecks as string[][];
                    this.state[i] = stringDecks[i].map(cardId => {
                        const card = this.controllers.cardRepository.getCard(cardId);
                        return {
                            id: cardId,
                            type: card.type,
                            cardId: card.data.id
                        } as GameCard;
                    });
                } else {
                    // Use GameCard objects directly
                    this.state[i] = [...(initialDecks as GameCard[][])[i]];
                }
                
                // Shuffle the deck
                this.shuffleDeck(i);
            }
            return;
        }
        
        // Otherwise, create empty decks
        for (let i = 0; i < playerCount; i++) {
            this.state[i] = [];
        }
    }
    
    // Get player count
    getPlayerCount(): number {
        return this.playerCount;
    }
    
    // Shuffle a player's deck
    shuffleDeck(playerId: number): void {
        const deck = this.state[playerId];
        for (let i = deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [deck[i], deck[j]] = [deck[j], deck[i]];
        }
    }
    
    // Draw a card from the deck
    drawCard(playerId: number): GameCard | undefined {
        if (this.state[playerId].length === 0) {
            return undefined; // Deck is empty
        }
        
        return this.state[playerId].pop();
    }
    
    // Get a player's deck
    getDeck(playerId: number): GameCard[] {
        return this.state[playerId];
    }
    
    // Get deck size
    getDeckSize(playerId: number): number {
        return this.state[playerId].length;
    }
    
    // Required by AbstractController
    getFor(position: number): GameCard[] {
        return this.getDeck(position);
    }
    
    // Required by AbstractController
    validate(): void {
        // Validation logic if needed
    }
}
