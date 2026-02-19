import { AbstractController, GenericControllerProvider, ParamsController } from '@cards-ts/core';
import { GameParams } from '../game-params.js';
import { GameCard } from './card-types.js';
import { DeckController } from './deck-controller.js';
import { DiscardController } from './discard-controller.js';
import { CardRepositoryController } from './card-repository-controller.js';

type HandDependencies = {
    deck: DeckController;
    params: ParamsController<GameParams>;
    discard: DiscardController;
    cardRepository: CardRepositoryController;
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
        return { deck: true, params: true, discard: true, cardRepository: true } as const;
    }
}

export class HandController extends AbstractController<GameCard[][], HandDependencies, GameCard[]> {
    initialize(playerCount: number): void {
        this.state = new Array(playerCount).fill(undefined)
            .map(() => []);
    }
    
    /**
     * Draw a card from deck to hand.
     * Returns undefined if:
     * - The hand is already at maximum size (enforces hand size limit)
     * - The deck is empty (no card to draw)
     * 
     * This method is used for both turn-start draws and effect-based draws,
     * ensuring the hand size limit is consistently enforced.
     * 
     * @param playerId The player drawing the card
     * @returns The drawn card, or undefined if unable to draw
     */
    drawCard(playerId: number): GameCard | undefined {
        const params = this.controllers.params.get();
        const maxHandSize = params.maxHandSize;
        
        // Check if hand is already at max size
        if (this.state[playerId].length >= maxHandSize) {
            return undefined;
        }
        
        const card = this.controllers.deck.drawCard(playerId);
        if (card) {
            this.state[playerId].push(card);
        }
        return card;
    }
    
    // Draw initial hand (5 cards) ensuring at least one basic creature
    drawInitialHand(playerId: number): void {
        const hand = this.state[playerId];
        const deck = this.controllers.deck.getDeck(playerId);
        
        // Helper function to check if a creature is basic
        const isBasicCreature = (card: GameCard): boolean => {
            const cardResult = this.controllers.cardRepository.getCard(card.templateId);
            if (cardResult.type !== 'creature') {
                return false;
            }
            const creatureData = cardResult.data;
            // A creature is basic if it has no previousStageName (doesn't evolve from another form)
            return !creatureData.previousStageName;
        };
        
        // Shuffle the deck
        this.controllers.deck.shuffleDeck(playerId);
        
        // Try up to 4 times - slice deck into 4 groups of 5, one must be valid
        for (let attempt = 0; attempt < 4; attempt++) {
            // Draw 5 cards for this attempt
            const cardsDrawn: GameCard[] = [];
            for (let i = 0; i < 5; i++) {
                const card = this.controllers.deck.drawCard(playerId);
                if (card) {
                    cardsDrawn.push(card);
                    hand.push(card);
                }
            }
            
            // Check if this hand has at least one basic creature
            if (hand.some(isBasicCreature)) {
                return;
            }
            
            /*
             * If no basic creature found, put cards back in deck and try again
             * Cards were drawn from the end (pop), so we put them back at the FRONT (unshift)
             * This rotates the deck so the next attempt gets different cards
             */
            for (let i = 0; i < cardsDrawn.length; i++) {
                deck.unshift(cardsDrawn[i]);
            }
            // Also remove them from hand
            hand.splice(-cardsDrawn.length, cardsDrawn.length);
        }
        
        throw new Error(`Unable to draw initial hand with basic creature for player ${playerId} after 4 attempts. Deck must contain at least one basic creature.`);
    }
    
    // Play a card from hand
    playCard(playerId: number, cardIndex: number): GameCard | undefined {
        if (cardIndex < 0 || cardIndex >= this.state[playerId].length) {
            return undefined;
        }
        
        // Remove the card from hand (but don't discard it - it's being played)
        const card = this.state[playerId].splice(cardIndex, 1)[0];
        return card;
    }
    
    // Play a card from hand and discard it (for supporters/items)
    playCardAndDiscard(playerId: number, cardIndex: number): GameCard | undefined {
        const card = this.playCard(playerId, cardIndex);
        if (card) {
            this.controllers.discard.discardCard(playerId, card);
        }
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
    
    // Remove specific cards from hand and discard them
    removeCards(playerId: number, cardsToRemove: GameCard[]): void {
        for (const cardToRemove of cardsToRemove) {
            const index = this.state[playerId].findIndex(card => card.templateId === cardToRemove.templateId && card.type === cardToRemove.type,
            );
            if (index !== -1) {
                const removedCard = this.state[playerId].splice(index, 1)[0];
                // Automatically discard the removed card
                this.controllers.discard.discardCard(playerId, removedCard);
            }
        }
    }
    
    // Check if player has specific card
    hasCard(cardToCheck: GameCard, playerId: number): boolean {
        return this.state[playerId].some(card => card.templateId === cardToCheck.templateId && card.type === cardToCheck.type,
        );
    }
    
    // Required by AbstractController
    validate(): void {
        // Validate that all cards exist in the repository
        for (let player = 0; player < this.state.length; player++) {
            for (const card of this.state[player]) {
                try {
                    this.controllers.cardRepository.getCard(card.templateId);
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    throw new Error(`Invalid card templateId "${card.templateId}" in player ${player} hand: ${errorMessage}`);
                }
            }
        }
    }
}
