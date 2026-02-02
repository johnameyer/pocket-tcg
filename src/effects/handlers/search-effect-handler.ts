import { Controllers } from '../../controllers/controllers.js';
import { SearchEffect } from '../../repository/effect-types.js';
import { CardCriteria } from '../../repository/target-types.js';
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
        // For deck searches, check if deck has cards
        const deckSize = handlerData.deck;
        
        // Only block items when deck is empty, supporters can still be played
        if (deckSize === 0 && context.type === 'trainer' && context.cardType === 'item') {
            return false;
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
        
        // Default destination is hand
        const destination = effect.destination || 'hand';
        
        // Currently only deck search is supported
        this.handleDeckSearch(controllers, effect, context, searchAmount, destination);
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
        if (deck.length === 0) {
            controllers.players.messageAll({
                type: 'status',
                components: [ `${context.effectName} has no cards to search for!` ],
            });
            return;
        }
        
        // Filter the deck based on the search criteria
        let filteredDeck = [ ...deck ];
        
        // Apply criteria filter if specified
        if (effect.criteria) {
            filteredDeck = this.filterDeckBySearchCriteria(controllers, filteredDeck, effect.criteria);
        }
            
        // If there are no matching cards, inform the player
        if (filteredDeck.length === 0) {
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
     * @param criteria The card criteria to filter by
     * @returns Filtered deck
     */
    private filterDeckBySearchCriteria(controllers: Controllers, deck: GameCard[], criteria: CardCriteria): GameCard[] {
        let filteredDeck = [ ...deck ];
        
        // Filter by card type using discriminated union
        switch (criteria.cardType) {
            case 'creature':
                filteredDeck = filteredDeck.filter(card => {
                    if (card.type !== 'creature') {
                        return false;
                    }
                    
                    try {
                        const creatureData = controllers.cardRepository.getCreature(card.templateId);
                        
                        // Check stage if specified
                        if (criteria.stage !== undefined) {
                            const cardStage = creatureData.previousStageName ? (creatureData.stage || 1) : 0;
                            if (cardStage !== criteria.stage) {
                                return false;
                            }
                        }
                        
                        // Check energy type if specified
                        if (criteria.energyType && creatureData.type !== criteria.energyType) {
                            return false;
                        }
                        
                        // Check HP constraints
                        if (criteria.hpGreaterThan !== undefined && creatureData.maxHp <= criteria.hpGreaterThan) {
                            return false;
                        }
                        if (criteria.hpLessThan !== undefined && creatureData.maxHp >= criteria.hpLessThan) {
                            return false;
                        }
                        
                        return true;
                    } catch (error) {
                        return false;
                    }
                });
                break;
                
            case 'tool':
                filteredDeck = filteredDeck.filter(card => card.type === 'tool');
                break;
                
            case 'supporter':
                filteredDeck = filteredDeck.filter(card => card.type === 'supporter');
                break;
                
            case 'item':
                filteredDeck = filteredDeck.filter(card => card.type === 'item');
                break;
                
            case 'trainer':
                // Trainer cards include both items and supporters
                filteredDeck = filteredDeck.filter(card => card.type === 'item' || card.type === 'supporter');
                break;
        }
        
        // Filter by specific names if provided
        if (criteria.names && criteria.names.length > 0) {
            filteredDeck = filteredDeck.filter(card => {
                try {
                    if (card.type === 'creature') {
                        const data = controllers.cardRepository.getCreature(card.templateId);
                        return criteria.names?.includes(data.name);
                    } else if (card.type === 'supporter') {
                        const data = controllers.cardRepository.getSupporter(card.templateId);
                        return criteria.names?.includes(data.name);
                    } else if (card.type === 'item') {
                        const data = controllers.cardRepository.getItem(card.templateId);
                        return criteria.names?.includes(data.name);
                    } else if (card.type === 'tool') {
                        const data = controllers.cardRepository.getTool(card.templateId);
                        return criteria.names?.includes(data.name);
                    }
                } catch (error) {
                    return false;
                }
                return false;
            });
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
        for (const card of cardsToMove) {
            const cardIndex = deck.findIndex(c => c.instanceId === card.instanceId);
            if (cardIndex !== -1) {
                deck.splice(cardIndex, 1);
            }
        }
        
        // Add the cards to the destination
        switch (destination) {
            case 'hand':
                for (const card of cardsToMove) {
                    controllers.hand.getHand(context.sourcePlayer).push(card);
                }
                break;
                
            default:
                console.warn(`[SearchEffectHandler] Unsupported destination: ${destination}`);
                // If destination is not supported, put the cards back in the deck
                for (const card of cardsToMove) {
                    deck.push(card);
                }
                break;
        }
    }
}

export const searchEffectHandler = new SearchEffectHandler();
