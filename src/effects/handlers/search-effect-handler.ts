import { Controllers } from '../../controllers/controllers.js';
import { SearchEffect } from '../../repository/effect-types.js';
import { EffectContext } from '../effect-context.js';
import { AbstractEffectHandler, ResolutionRequirement } from '../interfaces/effect-handler-interface.js';
import { getEffectValue } from '../effect-utils.js';
import { CardRepository } from '../../repository/card-repository.js';
import { HandlerData } from '../../game-handler.js';
import { CardTargetResolver } from '../target-resolvers/card-target-resolver.js';
import { CardCriteriaFilter } from '../filters/card-criteria-filter.js';
import { GameCard } from '../../controllers/card-types.js';

/**
 * Handler for search effects that search for cards in a specified location.
 */
export class SearchEffectHandler extends AbstractEffectHandler<SearchEffect> {
    /**
     * Search effects may require player choice if multiple cards match.
     * For now, we don't use the target resolution system for search effects.
     * 
     * @param effect The search effect
     * @returns Empty array - search resolves targets internally
     */
    getResolutionRequirements(effect: SearchEffect): ResolutionRequirement[] {
        /*
         * Search effects handle card target resolution in apply()
         * rather than through the generic FieldTarget resolution system
         */
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
        // Extract location from source target
        const location = 'location' in effect.source ? effect.source.location : 'deck';
        
        // For deck searches, check if deck has cards
        if (location === 'deck') {
            const deckSize = handlerData.deck;
            return deckSize > 0;
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
        
        // Resolve card target to get available cards
        const resolution = CardTargetResolver.resolve(effect.source, controllers, context);
        
        if (resolution.type === 'no-valid-targets') {
            controllers.players.messageAll({
                type: 'status',
                components: [ `${context.effectName} found no cards to search!` ],
            });
            return;
        }
        
        // Get available cards (may need filtering or selection)
        let availableCards = resolution.type === 'resolved' ? resolution.cards : resolution.availableCards;
        
        // Filter by criteria if needed
        if (effect.source.type !== 'fixed') {
            const cardRepository = controllers.cardRepository.cardRepository;
            availableCards = CardCriteriaFilter.filter(availableCards, effect.source.criteria, cardRepository);
        }
        
        if (availableCards.length === 0) {
            controllers.players.messageAll({
                type: 'status',
                components: [ `${context.effectName} found no matching cards!` ],
            });
            return;
        }
        
        // Limit the number of cards to search for
        const actualSearchAmount = Math.min(searchAmount, availableCards.length);
        
        /*
         * For now, just take the first matching cards
         * In a real implementation, this would involve player choice
         */
        const cardsToAdd = availableCards.slice(0, actualSearchAmount);
        
        // Move cards to hand
        this.moveCardsToHand(controllers, cardsToAdd, effect, context);
        
        // Send a message about the search
        controllers.players.messageAll({
            type: 'status',
            components: [ `${context.effectName} found ${actualSearchAmount} card${actualSearchAmount !== 1 ? 's' : ''}!` ],
        });
        
        // Shuffle the source location if it was the deck
        const location = 'location' in effect.source ? effect.source.location : 'deck';
        if (location === 'deck') {
            const player = 'player' in effect.source ? (effect.source.player === 'self' ? context.sourcePlayer : 1 - context.sourcePlayer) : context.sourcePlayer;
            controllers.deck.shuffle(player);
            
            controllers.players.messageAll({
                type: 'status',
                components: [ `${context.effectName} shuffles the deck!` ],
            });
        }
    }
    
    /**
     * Move cards to hand after search.
     * 
     * @param controllers Game controllers
     * @param cardsToAdd The cards to add to hand
     * @param effect The search effect
     * @param context Effect context
     */
    private moveCardsToHand(controllers: Controllers, cardsToAdd: GameCard[], effect: SearchEffect, context: EffectContext): void {
        // Determine the source player
        const sourcePlayer = 'player' in effect.source 
            ? (effect.source.player === 'self' ? context.sourcePlayer : 1 - context.sourcePlayer)
            : context.sourcePlayer;
        
        for (const card of cardsToAdd) {
            // Get the source collection based on effect.source.location
            const location = 'location' in effect.source ? effect.source.location : 'deck';
            let sourceCollection: GameCard[] = [];
            
            switch (location) {
                case 'hand':
                    sourceCollection = controllers.hand.getHand(sourcePlayer);
                    break;
                case 'deck':
                    sourceCollection = controllers.deck.getDeck(sourcePlayer);
                    break;
                case 'discard':
                    sourceCollection = controllers.discard.getDiscardPile(sourcePlayer);
                    break;
                default:
                    continue;
            }
            
            // Find and remove the card by instanceId
            const cardIndex = sourceCollection.findIndex(c => c.instanceId === card.instanceId);
            if (cardIndex >= 0) {
                const removedCard = sourceCollection.splice(cardIndex, 1)[0];
                // Add to player's hand (always goes to the effect source player's hand)
                controllers.hand.getHand(context.sourcePlayer).push(removedCard);
            }
        }
    }
}

export const searchEffectHandler = new SearchEffectHandler();
