import { AbstractController, GenericControllerProvider, IndexedControllers } from '@cards-ts/core';
import { Card, CreatureCard, SupporterCard, ItemCard, GameCard } from './card-types.js';
import { DeckController } from './deck-controller.js';
import { CardRepository } from "../repository/card-repository.js";

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
    
    // Draw initial hand (5 cards) ensuring at least one basic creature
    drawInitialHand(playerId: number): void {
        // Draw 5 cards normally first
        for (let i = 0; i < 5; i++) {
            this.drawCard(playerId);
        }
        
        // Check if hand has any basic creature (non-evolution creature)
        const hand = this.state[playerId];
        const hasBasicCreature = hand.some(card => {
            if (card.type === 'creature') {
                // We'll just assume all creatures are basic for now
                return true;
            }
            return false;
        });
        
        // If no basic creature, replace a non-creature card with a basic creature from deck
        if (!hasBasicCreature) {
            const deck = this.controllers.deck.getDeck(playerId);
            const basicCreatureInDeck = deck.find(card => card.type === 'creature');
            
            if (basicCreatureInDeck) {
                // Find a non-creature card to replace
                const nonCreatureIndex = hand.findIndex(card => card.type !== 'creature');
                if (nonCreatureIndex !== -1) {
                    // Put the non-creature card back in deck
                    const replacedCard = hand[nonCreatureIndex];
                    deck.push(replacedCard);
                    
                    // Remove basic creature from deck and add to hand
                    const deckIndex = deck.indexOf(basicCreatureInDeck);
                    deck.splice(deckIndex, 1);
                    hand[nonCreatureIndex] = basicCreatureInDeck;
                    
                    // Shuffle deck
                    this.controllers.deck.shuffleDeck(playerId);
                }
            }
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
    
    // Remove specific cards from hand
    removeCards(playerId: number, cardsToRemove: GameCard[]): void {
        for (const cardToRemove of cardsToRemove) {
            const index = this.state[playerId].findIndex(card => 
                card.cardId === cardToRemove.cardId && card.type === cardToRemove.type
            );
            if (index !== -1) {
                this.state[playerId].splice(index, 1);
            }
        }
    }
    
    // Check if player has specific card
    hasCard(cardToCheck: GameCard, playerId: number): boolean {
        return this.state[playerId].some(card => 
            card.cardId === cardToCheck.cardId && card.type === cardToCheck.type
        );
    }
    
    // Required by AbstractController
    validate(): void {
        // Validation logic if needed
    }
}
