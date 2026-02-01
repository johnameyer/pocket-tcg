import { ControllerHandlerState, Handler, HandlerResponsesQueue } from '@cards-ts/core';
import { Controllers } from './controllers/controllers.js';
import { GameHandlerParams } from './game-handler-params.js';
import { ResponseMessage } from './messages/response-message.js';
import { SelectTargetResponseMessage, SelectEnergyResponseMessage, SelectCardResponseMessage, SelectChoiceResponseMessage, SelectMultiTargetResponseMessage } from './messages/response/index.js';

export type HandlerData = ControllerHandlerState<Controllers>;

export abstract class GameHandler implements Handler<GameHandlerParams, HandlerData, ResponseMessage> {
    abstract handleAction(handlerData: HandlerData, responsesQueue: HandlerResponsesQueue<ResponseMessage>): void | Promise<void>;
        
    // Method to handle selecting a new active card when the current one is knocked out
    abstract handleSelectActiveCard(handlerData: HandlerData, responsesQueue: HandlerResponsesQueue<ResponseMessage>): void | Promise<void>;
    
    // Method to handle setup phase
    abstract handleSetup(handlerData: HandlerData, responsesQueue: HandlerResponsesQueue<ResponseMessage>): void | Promise<void>;
    
    // Method to handle selecting a target on the field
    abstract handleSelectTarget(handlerData: HandlerData, responsesQueue: HandlerResponsesQueue<SelectTargetResponseMessage>): void | Promise<void>;
    
    // Method to handle selecting energy (e.g., for retreat costs)
    abstract handleSelectEnergy(handlerData: HandlerData, responsesQueue: HandlerResponsesQueue<SelectEnergyResponseMessage>): void | Promise<void>;
    
    // Method to handle selecting cards (e.g., from hand, deck, discard)
    abstract handleSelectCard(handlerData: HandlerData, responsesQueue: HandlerResponsesQueue<SelectCardResponseMessage>): void | Promise<void>;
    
    // Method to handle selecting from named choices
    abstract handleSelectChoice(handlerData: HandlerData, responsesQueue: HandlerResponsesQueue<SelectChoiceResponseMessage>): void | Promise<void>;
    
    // Method to handle selecting multiple targets on the field
    abstract handleSelectMultiTarget(handlerData: HandlerData, responsesQueue: HandlerResponsesQueue<SelectMultiTargetResponseMessage>): void | Promise<void>;
}
