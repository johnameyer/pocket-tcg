import { GameHandler, HandlerData } from '../game-handler.js';
import { SelectActiveCardResponseMessage, ActionResponseMessage } from '../messages/response/index.js';
import { ResponseMessage } from '../messages/response-message.js';
import { HandlerResponsesQueue } from '@cards-ts/core';
import { CardRepository } from '../card-repository.js';

export class DefaultBotHandler extends GameHandler {
    private cardRepository: CardRepository;
    
    constructor(cardRepository?: CardRepository) {
        super();
        this.cardRepository = cardRepository || new CardRepository();
    }
    handleAction(handlerData: HandlerData, responsesQueue: HandlerResponsesQueue<ResponseMessage>): void {
        const currentPlayer = handlerData.turn;
        
        // Get the player's hand
        const hand = handlerData.hand;
        
        // First try to play a field card to the bench if possible
        const fieldCards = hand.filter(card => card.type === 'creature');
        const benchSize = handlerData.field.benchedCards[currentPlayer].length;
        
        if (fieldCards.length > 0 && benchSize < 3) {
            // Find the first field card
            const cardIndex = hand.findIndex(card => card.type === 'creature');
            
            // Play the field card
            responsesQueue.push(new ActionResponseMessage({
                type: 'play',
                cardIndex: cardIndex
            }));
            return;
        }
        
        // If no field card can be played, try to use a supporter card if none has been played this turn
        if (!handlerData.turnState.supporterPlayedThisTurn) {
            const supporterCards = hand.filter(card => card.type === 'supporter');
            
            if (supporterCards.length > 0) {
                // Find the first supporter card
                const cardIndex = hand.findIndex(card => card.type === 'supporter');
                
                // Play the supporter card
                responsesQueue.push(new ActionResponseMessage({
                    type: 'play',
                    cardIndex: cardIndex
                }));
                return;
            }
        }
        
        // If no supporter can be played, try to use an item card
        const itemCards = hand.filter(card => card.type === 'item');
        
        if (itemCards.length > 0) {
            // Find the first item card
            const cardIndex = hand.findIndex(card => card.type === 'item');
            
            // Play the item card on self
            responsesQueue.push(new ActionResponseMessage({
                type: 'play',
                cardIndex: cardIndex,
                targetPlayerId: currentPlayer
            }));
            return;
        }
        
        // If no cards can be played, attack
        responsesQueue.push(new ActionResponseMessage({
            type: 'attack',
            attackIndex: 0 // Always use the first attack
        }));
    }
    
    handleSelectActiveCard(handlerData: HandlerData, responsesQueue: HandlerResponsesQueue<ResponseMessage>): void {
        // Bot always selects the first benched card
        responsesQueue.push(new SelectActiveCardResponseMessage(0));
    }
}
