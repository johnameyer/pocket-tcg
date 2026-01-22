import { AbstractController, GenericControllerProvider, IndexedControllers, ParamsController } from '@cards-ts/core';
import { GameCard } from './card-types.js';
import { AttachableEnergyType } from '../repository/energy-types.js';
import { CardRepositoryController } from './card-repository-controller.js';
import { GameParams } from '../game-params.js';

// Dependencies for this controller
type DeckDependencies = {
    cardRepository: CardRepositoryController;
    params: ParamsController<GameParams>;
};

export class DeckControllerProvider implements GenericControllerProvider<GameCard[][], DeckDependencies, DeckController> {
    controller(state: GameCard[][], controllers: DeckDependencies): DeckController {
        return new DeckController(state, controllers);
    }
    
    initialState(): GameCard[][] {
        return [];
    }
    
    dependencies() {
        return { cardRepository: true, params: true } as const;
    }
}

// TODO: Handler should know what cards are remaining but not in order - need to make this clear to handlers
// This is important for maintaining game integrity while providing necessary information
export class DeckController extends AbstractController<GameCard[][], DeckDependencies, number> {
    private playerCount: number = 0;
    private nextCardInstanceId: number = 1;
    
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
                    this.state[i] = stringDecks[i].map(templateId => {
                        // Use getCard to determine correct type (already validated above)
                        const { type } = this.controllers.cardRepository.getCard(templateId);
                        
                        return {
                            instanceId: `card-${this.nextCardInstanceId++}`,
                            type: type as 'creature' | 'supporter' | 'item' | 'tool',
                            templateId: templateId
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
        
        // Initialize empty decks for each player
        for (let i = 0; i < playerCount; i++) {
            this.state[i] = [];
            
            // Shuffle the deck
            this.shuffleDeck(i);
        }
    }
    
    // Get energy types for a player
    getPlayerEnergyTypes(playerId: number): AttachableEnergyType[] {
        // Check if energy types are provided via game params
        const gameParams = this.controllers.params.get();
        if (gameParams?.playerEnergyTypes && gameParams.playerEnergyTypes[playerId]) {
            return gameParams.playerEnergyTypes[playerId];
        }
        
        // Fallback to hardcoded values
        const playerEnergyTypes: AttachableEnergyType[][] = [
            ['metal'], // Player 1: Metal
            ['lightning'], // Player 2: Lightning
        ];
        return playerEnergyTypes[playerId] || ['fire'];
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
        if (!this.state[playerId]) {
            return 0;
        }
        return this.state[playerId].length;
    }
    
    // Required by AbstractController
    // Return only the deck size, not the full deck data
    getFor(position: number): number {
        return this.getDeckSize(position);
    }
    
    // Required by AbstractController
    validate(): void {
        // Validate that all cards in initial decks exist in repository
        const params = this.controllers.params.get();
        if (params.initialDecks) {
            for (let i = 0; i < params.initialDecks.length; i++) {
                const deck = params.initialDecks[i];
                if (deck.length > 0 && typeof deck[0] === 'string') {
                    for (const templateId of deck as string[]) {
                        try {
                            this.controllers.cardRepository.getCard(templateId);
                        } catch (error: any) {
                            throw new Error(`Invalid card in player ${i} deck: ${error.message}`);
                        }
                    }
                }
            }
        }
    }

    addCard(playerId: number, card: GameCard): void {
        this.state[playerId].push(card);
    }

    shuffle(playerId: number): void {
        this.shuffleDeck(playerId);
    }
}
