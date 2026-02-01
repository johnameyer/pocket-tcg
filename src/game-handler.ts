import { ControllerHandlerState, Handler, HandlerResponsesQueue } from '@cards-ts/core';
import { Controllers } from './controllers/controllers.js';
import { GameHandlerParams } from './game-handler-params.js';
import { ResponseMessage } from './messages/response-message.js';

export type HandlerData = ControllerHandlerState<Controllers>;

export abstract class GameHandler implements Handler<GameHandlerParams, HandlerData, ResponseMessage> {
    abstract handleAction(handlerData: HandlerData, responsesQueue: HandlerResponsesQueue<ResponseMessage>): void | Promise<void>;
        
    // Method to handle selecting a new active card when the current one is knocked out
    abstract handleSelectActiveCard(handlerData: HandlerData, responsesQueue: HandlerResponsesQueue<ResponseMessage>): void | Promise<void>;
    
    // Method to handle setup phase
    abstract handleSetup(handlerData: HandlerData, responsesQueue: HandlerResponsesQueue<ResponseMessage>): void | Promise<void>;
}
