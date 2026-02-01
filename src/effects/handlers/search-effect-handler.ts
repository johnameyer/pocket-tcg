import { Controllers } from '../../controllers/controllers.js';
import { SearchEffect } from '../../repository/effect-types.js';
import { EffectContext } from '../effect-context.js';
import { AbstractEffectHandler, ResolutionRequirement } from '../interfaces/effect-handler-interface.js';
import { getEffectValue } from '../effect-utils.js';
import { CardRepository } from '../../repository/card-repository.js';
import { HandlerData } from '../../game-handler.js';
import { GameCard } from '../../controllers/card-types.js';

/**
 * Handler for search effects that search for cards in a specified location.
 */
export class SearchEffectHandler extends AbstractEffectHandler<SearchEffect> {
    /**
     * Search effects don't have targets to resolve.
     * 
     * @param effect The search effect
     * @returns Empty array as search effects don't have targets
     */
    getResolutionRequirements(effect: SearchEffect): ResolutionRequirement[] {
        return [];
    }
    
    /**
     * Validate if a search effect can be applied.
     * For deck searches, checks if the deck has cards.
     * 
     * @param handlerData Handler data view
     * @param effect The search effect to validate
     * @param context Effect context
     * @returns True if the effect can be applied, false otherwise
     */
    canApply(handlerData: HandlerData, effect: SearchEffect, context: EffectContext, cardRepository?: CardRepository): boolean {
        // Default target is deck
        const target = effect.target || 'deck';
        
        // For deck searches, check if deck has cards
        if(target === 'deck') {
            const deckSize = handlerData.deck;
            
            // Only block items when deck is empty, supporters can still be played
            if(deckSize === 0 && context.type === 'trainer' && context.cardType === 'item') {
                return false;
            }
            
            return true;
        }
        
        return true;
    }
    
    /**
     * Apply a search effect.
     * This searches for cards in a specified location and puts them in a destination.
     * 
     * @param controllers Game controllers
     * @param effect The search effect to apply
     * @param context Effect context
     */
    apply(controllers: Controllers, effect: SearchEffect, context: EffectContext): void {
        // Get the amount of cards to search for
        const searchAmount = getEffectValue(effect.amount, controllers, context);
        
        // Default target is deck
        const target = effect.target || 'deck';
        
        // Default destination is hand
        const destination = effect.destination || 'hand';
        
        // Use a switch statement for better readability and extensibility
        switch (target) {
            case 'deck':
                this.handleDeckSearch(controllers, effect, context, searchAmount, destination);
                break;
                
            default:
                // For unsupported targets, log a warning
                console.warn(`[SearchEffectHandler] Unsupported search target: ${target}`);
                controllers.players.messageAll({
                    type: 'status',
                    components: [ `${context.effectName} cannot search ${target}!` ],
                });
                break;
        }
    }
    
    /**
     * Handle searching the deck for cards.
     * 
     * @param controllers Game controllers
     * @param effect The search effect
     * @param context Effect context
     * @param searchAmount The amount of cards to search for
     * @param destination The destination for found cards
     */
    private handleDeckSearch(
        controllers: Controllers,
        effect: SearchEffect,
        context: EffectContext,
        searchAmount: number,
        destination: string,
    ): void {
        // Get the player's deck
        const deck = controllers.deck.getDeck(context.sourcePlayer);
        
        // If the deck is empty, there's nothing to search
        if(deck.length === 0) {
            controllers.players.messageAll({
                type: 'status',
                components: [ `${context.effectName} has no cards to search for!` ],
            });
            return;
        }
        
        // Filter the deck based on the search criteria
        let filteredDeck = [ ...deck ];
        
        // Use a generic approach to handle search criteria
        if(effect.criteria || effect.cardType) {
            filteredDeck = this.filterDeckBySearchCriteria(controllers, filteredDeck, effect);
        }
            
        // If there are no matching cards, inform the player
        if(filteredDeck.length === 0) {
            controllers.players.messageAll({
                type: 'status',
                components: [ `${context.effectName} found no matching cards!` ],
            });
            return;
        }
        
        // Limit the number of cards to search for
        const actualSearchAmount = Math.min(searchAmount, filteredDeck.length);
        
        /*
         * For now, just take the first matching cards
         * In a real implementation, this would involve player choice
         */
        const cardsToMove = filteredDeck.slice(0, actualSearchAmount);
        
        // Move the cards to the destination
        this.moveCardsToDestination(controllers, deck, cardsToMove, destination, context);
        
        // Send a message about the search
        controllers.players.messageAll({
            type: 'status',
            components: [ `${context.effectName} found ${actualSearchAmount} card${actualSearchAmount !== 1 ? 's' : ''}!` ],
        });
        
        // Shuffle the deck after searching
        controllers.deck.shuffle(context.sourcePlayer);
        
        // Send a message about the shuffle
        controllers.players.messageAll({
            type: 'status',
            components: [ `${context.effectName} shuffles the deck!` ],
        });
    }
    
    /**
     * Filter the deck based on search criteria.
     * 
     * @param controllers Game controllers
     * @param deck The deck to filter
     * @param effect The search effect with criteria
     * @returns Filtered deck
     */
    private filterDeckBySearchCriteria(controllers: Controllers, deck: GameCard[], effect: SearchEffect): GameCard[] {
        let filteredDeck = [ ...deck ];
        
        // Handle criteria field
        if(effect.criteria) {
            switch (effect.criteria) {
                case 'basic-creature':
                    filteredDeck = filteredDeck.filter(card => {
                        if(card.type === 'creature') {
                            try {
                                const creatureData = controllers.cardRepository.getCreature(card.templateId);
                                return !creatureData.previousStageName;
                            } catch (error) {
                                return false;
                            }
                        }
                        return false;
                    });
                    break;
                    
                default:
                    console.warn(`[SearchEffectHandler] Unknown search criteria: ${effect.criteria}`);
                    break;
            }
        } else if(effect.cardType) {
            // Handle cardType field
            switch (effect.cardType) {
                case 'basic-creature':
                    filteredDeck = filteredDeck.filter(card => {
                        if(card.type === 'creature') {
                            try {
                                const creatureData = controllers.cardRepository.getCreature(card.templateId);
                                return !creatureData.previousStageName;
                            } catch (error) {
                                return false;
                            }
                        }
                        return false;
                    });
                    break;
                    
                case 'trainer':
                    // Trainer cards include both items and supporters
                    filteredDeck = filteredDeck.filter(card => card.type === 'item' || card.type === 'supporter');
                    break;
                    
                case 'fieldCard':
                    // Field cards are creature/creatures that can be played on the field
                    filteredDeck = filteredDeck.filter(card => card.type === 'creature');
                    break;
                    
                default: {
                    // Map search cardType to GameCard type
                    let gameCardType: 'creature' | 'supporter' | 'item' | 'tool' | undefined;
                    switch (effect.cardType) {
                        case 'basic-creature':
                        case 'fieldCard':
                            gameCardType = 'creature';
                            break;
                        case 'trainer':
                            // Trainer could be supporter or item, so we need to handle both
                            filteredDeck = filteredDeck.filter(card => card.type === 'supporter' || card.type === 'item',
                            );
                            return filteredDeck;
                        default:
                            return filteredDeck; // No filtering if cardType is unknown
                    }
                    
                    if(gameCardType) {
                        filteredDeck = filteredDeck.filter(card => card.type === gameCardType);
                    }
                    break;
                }
            }
        }
        
        return filteredDeck;
    }
    
    /**
     * Move cards from the deck to the destination.
     * 
     * @param controllers Game controllers
     * @param deck The player's deck
     * @param cardsToMove The cards to move
     * @param destination The destination for the cards
     * @param context Effect context
     */
    private moveCardsToDestination(
        controllers: Controllers,
        deck: GameCard[],
        cardsToMove: GameCard[],
        destination: string,
        context: EffectContext,
    ): void {
        // Remove the cards from the deck
        for(const card of cardsToMove) {
            const cardIndex = deck.findIndex(c => c.instanceId === card.instanceId);
            if(cardIndex !== -1) {
                deck.splice(cardIndex, 1);
            }
        }
        
        // Add the cards to the destination
        switch (destination) {
            case 'hand':
                for(const card of cardsToMove) {
                    controllers.hand.getHand(context.sourcePlayer).push(card);
                }
                break;
                
            default:
                console.warn(`[SearchEffectHandler] Unsupported destination: ${destination}`);
                // If destination is not supported, put the cards back in the deck
                for(const card of cardsToMove) {
                    deck.push(card);
                }
                break;
        }
    }
}

export const searchEffectHandler = new SearchEffectHandler();
