import { ControllerHandlerState, Handler, HandlerResponsesQueue } from '@cards-ts/core';
import { Controllers } from './controllers/controllers.js';
import { GameHandlerParams } from './game-handler-params.js';
import { ResponseMessage } from './messages/response-message.js';
import { SelectTargetResponseMessage, SelectEnergyResponseMessage, SelectCardResponseMessage, SelectChoiceResponseMessage } from './messages/response/index.js';

export type HandlerData = ControllerHandlerState<Controllers>;

export abstract class GameHandler implements Handler<GameHandlerParams, HandlerData, ResponseMessage> {
    abstract handleAction(handlerData: HandlerData, responsesQueue: HandlerResponsesQueue<ResponseMessage>): void | Promise<void>;
        
    // Method to handle selecting a new active card when the current one is knocked out
    abstract handleSelectActiveCard(handlerData: HandlerData, responsesQueue: HandlerResponsesQueue<ResponseMessage>): void | Promise<void>;
    
    // Method to handle setup phase
    abstract handleSetup(handlerData: HandlerData, responsesQueue: HandlerResponsesQueue<ResponseMessage>): void | Promise<void>;
    
    // Method to handle selecting target(s) on the field (can return array of targets)
    abstract handleSelectTarget(handlerData: HandlerData, responsesQueue: HandlerResponsesQueue<SelectTargetResponseMessage>): void | Promise<void>;
    
    // Method to handle selecting energy (can return array of energy)
    abstract handleSelectEnergy(handlerData: HandlerData, responsesQueue: HandlerResponsesQueue<SelectEnergyResponseMessage>): void | Promise<void>;
    
    // Method to handle selecting cards (can return array of cards)
    abstract handleSelectCard(handlerData: HandlerData, responsesQueue: HandlerResponsesQueue<SelectCardResponseMessage>): void | Promise<void>;
    
    // Method to handle selecting from named choices (can return array of choices)
    abstract handleSelectChoice(handlerData: HandlerData, responsesQueue: HandlerResponsesQueue<SelectChoiceResponseMessage>): void | Promise<void>;
}
