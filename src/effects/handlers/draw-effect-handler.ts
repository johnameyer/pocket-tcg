import { Controllers } from '../../controllers/controllers.js';
import { DrawEffect } from '../../repository/effect-types.js';
import { EffectContext } from '../effect-context.js';
import { AbstractEffectHandler, ResolutionRequirement } from '../interfaces/effect-handler-interface.js';
import { getEffectValue } from '../effect-utils.js';
import { HandlerData } from '../../game-handler.js';
import { DrawnCardsMessage } from '../../messages/status/drawn-cards-message.js';
import { getCardNames } from '../../utils/card-name-utils.js';

/**
 * Handler for draw effects that allow players to draw cards.
 */
export class DrawEffectHandler extends AbstractEffectHandler<DrawEffect> {
    /**
     * Optional validation method to check if a draw effect can be applied.
     * Checks if the deck has enough cards to draw.
     * 
     * @param handlerData Handler data view
     * @param effect The draw effect to validate
     * @param context Effect context
     * @returns undefined if valid, rejection reason if invalid
     */
    canApply(handlerData: HandlerData, effect: DrawEffect, context: EffectContext): string | undefined {
        const playerId = context.sourcePlayer;
        
        // Get the deck size from handler data
        const deckSize = handlerData.deck;
        
        /*
         * If the deck is completely empty, don't allow playing draw effects that require drawing
         * TODO probably we should print a message to the user somehow
         */
        return deckSize !== 0 ? undefined : 'No cards in deck to draw';
    }

    // TODO make this optional in the interface and remove for all it would be [] for?
    /**
     * Draw effects don't have targets to resolve.
     * 
     * @param effect The draw effect
     * @returns Empty array as draw effects don't have targets
     */
    getResolutionRequirements(effect: DrawEffect): ResolutionRequirement[] {
        return [];
    }
    
    /**
     * Apply a draw effect.
     * 
     * @param controllers Game controllers
     * @param effect The draw effect to apply
     * @param context Effect context
     */
    apply(controllers: Controllers, effect: DrawEffect, context: EffectContext): void {
        // Get the amount of cards to draw
        const amount = getEffectValue(effect.amount, controllers, context);
        
        /*
         * TODO Shouldn't we be handling conditions in the proper component?
         * Check if there's a condition for the draw effect
         * Note: DrawEffect interface doesn't have condition property - this code is disabled
         * if (effect.condition) {
         *     // Handle condition using a switch statement for better readability
         *     switch (effect.condition) {
         *         case 'active-spot':
         *             // Check if this is a trigger effect
         *             if (context.type === 'trigger') {
         *                 const activecreature = controllers.field.getCardByPosition(context.sourcePlayer, 0);
         *                 // Check if the creature with the ability is in the active spot
         *                 if (!activecreature || activecreature.instanceId !== context.creatureInstanceId) {
         *                     controllers.players.messageAll({
         *                         type: 'status',
         *                         components: [`${context.effectName} requires the creature to be active!`]
         *                     });
         *                     return;
         *                 }
         *             }
         *             break;
         *             
         *         default:
         *             // For unknown conditions, log a warning
         *             console.warn(`[DrawEffectHandler] Unknown condition: ${effect.condition}`);
         *             break;
         *     }
         * }
         */
        
        // Get the current deck size
        const deckSize = controllers.deck.getDeckSize(context.sourcePlayer);
        
        // If the deck is empty, show a message and return
        if (deckSize === 0) {
            controllers.players.messageAll({
                type: 'status',
                components: [ `${context.effectName} couldn't draw any cards because the deck is empty!` ],
            });
            return;
        }
        
        // Calculate the actual number of cards to draw (limited by deck size)
        const actualAmount = Math.min(amount, deckSize);
        
        // Draw the cards and collect their names
        const drawnCards = [];
        for (let i = 0; i < actualAmount; i++) {
            const card = controllers.hand.drawCard(context.sourcePlayer);
            if (card) {
                drawnCards.push(card);
            }
        }
        
        // Send a message about the cards drawn (generic reason)
        controllers.players.messageAll({
            type: 'status',
            components: [ `${context.effectName} drew ${actualAmount} card${actualAmount !== 1 ? 's' : ''}!` ],
        });
        
        // Message the player about the specific cards drawn
        if (drawnCards.length > 0) {
            const cardNames = getCardNames(drawnCards, controllers.cardRepository);
            controllers.players.message(context.sourcePlayer, new DrawnCardsMessage(cardNames));
        }
        
        // If we couldn't draw all the requested cards, show a message
        if (actualAmount < amount) {
            controllers.players.messageAll({
                type: 'status',
                components: [ `${context.effectName} couldn't draw all ${amount} cards because the deck only had ${deckSize} cards!` ],
            });
        }
    }
}

export const drawEffectHandler = new DrawEffectHandler();
