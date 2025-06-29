import { GameHandler, HandlerData } from '../game-handler.js';
import { SelectActiveCardResponseMessage, SetupCompleteResponseMessage, EvolveResponseMessage, AttackResponseMessage, PlayCardResponseMessage, EndTurnResponseMessage } from '../messages/response/index.js';
import { ResponseMessage } from '../messages/response-message.js';
import { HandlerResponsesQueue } from '@cards-ts/core';
import { CardRepository } from "../repository/card-repository.js";

export class DefaultBotHandler extends GameHandler {
    private cardRepository: CardRepository;
    
    constructor(cardRepository?: CardRepository) {
        super();
        this.cardRepository = cardRepository || new CardRepository();
    }
    
    handleEvolve(handlerData: HandlerData, responsesQueue: HandlerResponsesQueue<ResponseMessage>): void {
        // Bot always evolves the first available creature
        const currentPlayer = handlerData.turn;
        const hand = handlerData.hand;
        
        // Find evolution cards in hand
        const evolutionCards = hand.filter(card => card.type === 'creature');
        
        if (evolutionCards.length > 0) {
            // Get the first evolution card
            const evolutionCard = evolutionCards[0];
            
            // Evolve the active creature by default
            responsesQueue.push(new EvolveResponseMessage(
                evolutionCard.cardId,
                true // isActive
            ));
        }
    }
    
    handleAction(handlerData: HandlerData, responsesQueue: HandlerResponsesQueue<ResponseMessage>): void {
        // Bot always attacks to cause damage and eventually knockouts
        responsesQueue.push(new AttackResponseMessage(0));
    }
    
    handleSelectActiveCard(handlerData: HandlerData, responsesQueue: HandlerResponsesQueue<ResponseMessage>): void {
        // Bot always selects the first benched card
        responsesQueue.push(new SelectActiveCardResponseMessage(0));
    }
    
    handleSetup(handlerData: HandlerData, responsesQueue: HandlerResponsesQueue<ResponseMessage>): void {
        const hand = handlerData.hand;
        
        // Find all creature cards in hand
        const creatureCards = hand.filter(card => card.type === 'creature');
        
        if (creatureCards.length > 0) {
            // Bot selects first creature as active, others for bench (max 3 bench)
            const activeCard = creatureCards[0];
            const benchCards = creatureCards.slice(1, 4);
            
            // Create a setup complete message with the selected cards
            responsesQueue.push(new SetupCompleteResponseMessage(
                activeCard.cardId,
                benchCards.map(card => card.cardId)
            ));
        } else {
            // No creature cards in hand, just complete setup with default
            responsesQueue.push(new SetupCompleteResponseMessage(
                'basic-creature', // Use a default creature ID
                []
            ));
        }
    }
}
