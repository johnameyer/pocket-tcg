import { HandlerChain, ControllerState, HandlerResponsesQueue } from '@cards-ts/core';
import { GameHandler, HandlerData } from '../../src/game-handler.js';
import { ResponseMessage } from '../../src/messages/response-message.js';
import { gameFactory } from '../../src/game-factory.js';
import { GameSetup } from '../../src/game-setup.js';
import { StateBuilder } from './state-builder.js';
import { Controllers, buildProviders } from '../../src/controllers/controllers.js';
import { mockRepository, MockCardRepository } from '../mock-repository.js';
import { eventHandler } from '../../src/event-handler.js';

export function createTestPlayers(actionHandler: (handlerData: any, responses: any) => void, messageHandler?: (handlerData: any, message: any) => void) {
    const gameHandler: () => GameHandler = () => ({
        handleAction: actionHandler,
        handleSelectActivecreature: actionHandler,
        handleSelectActiveCard: actionHandler,
        handleSelectTarget: actionHandler,
        handleSelectMultiTarget: actionHandler,
        handleSetup: actionHandler,
        handleMessage: messageHandler || (() => {})
    });

    return Array.from({ length: 2 }, () => 
        // @ts-expect-error
        new HandlerChain([gameHandler()])
    );
}

export function createTestPlayersWithDifferentHandlers(
    player0Handler: (handlerData: any, responses: any) => void,
    player1Handler: (handlerData: any, responses: any) => void,
    messageHandler?: (handlerData: any, message: any) => void
) {
    const createGameHandler = (handler: (handlerData: any, responses: any) => void): () => GameHandler => () => ({
        handleAction: handler,
        handleSelectActivecreature: handler,
        handleSelectActiveCard: handler,
        handleSelectTarget: handler,
        handleSelectMultiTarget: handler,
        handleSetup: handler,
        handleMessage: messageHandler || (() => {})
    });

    return [
        // @ts-expect-error
        new HandlerChain([createGameHandler(player0Handler)()]),
        // @ts-expect-error
        new HandlerChain([createGameHandler(player1Handler)()])
    ];
}

export function createActionTracker(actions: ResponseMessage[]) {
    let actionIndex = 0;
    
    return {
        handler: (handlerData: HandlerData, responses: HandlerResponsesQueue<ResponseMessage>) => {
            if (actionIndex < actions.length) {
                responses.push(actions[actionIndex++]);
            }
        },
    };
}

export interface TestGameConfig {
    actions: ResponseMessage[];
    stateCustomizer?: (state: ControllerState<Controllers>) => void;
    resumeFrom?: ControllerState<Controllers>;
    maxSteps?: number;
    customRepository?: MockCardRepository;
}

export function runTestGame(config: TestGameConfig) {
    // TODO: State resumption has issues where the game gets stuck in waiting states
    // and the action tracker handler is never called to provide new actions.
    // The game remains in ACTIONLOOP_noop waiting for responses that never come.
    // For same-turn effects, use single runTestGame with multiple actions instead.
    
    let validatedCount = 0;
    const tracker = createActionTracker(config.actions);
    const players = createTestPlayers(tracker.handler);
    const params = new GameSetup().getDefaultParams();
    
    let preConfiguredState: ControllerState<Controllers>;
    if (config.resumeFrom) {
        preConfiguredState = config.resumeFrom;
        if (config.stateCustomizer) {
            config.stateCustomizer(preConfiguredState);
        }
    } else {
        preConfiguredState = StateBuilder.createActionPhaseState(config.stateCustomizer)!;
    }
    
    const repository = config.customRepository || mockRepository;
    
    const driver = gameFactory(repository).getGameDriver(players, params, ['TestPlayer', 'OpponentPlayer'], preConfiguredState as any);
    
    driver.resume();
    const maxSteps = config.maxSteps !== undefined ? config.maxSteps : 5;
    for (let step = 0; step < maxSteps && !driver.getState().completed; step++) {
        for(const [ position, message ] of (driver as any).handlerProxy.receiveSyncResponses()) {
            if(message) {
                let payload, data;
                if(Array.isArray(message)) {
                    ([ payload, data ] = message);
                } else {
                    payload = message;
                }
                const wasValidated = driver.handleEvent(position, payload, data);
                if (wasValidated) {
                    validatedCount++;
                }
            }
        }
        driver.resume();
    }

    const state = driver.getState() as ControllerState<Controllers>;
    
    return {
        driver,
        getExecutedCount: () => validatedCount,
        state
    };
}

/**
 * Helper function to resume a game driver for a specified number of steps
 * @param driver The game driver to resume
 * @param maxSteps Maximum number of steps to run
 * @returns The final state after running
 */
export function resumeGame(driver: ReturnType<ReturnType<typeof gameFactory>['getGameDriver']>, maxSteps: number) {
    driver.resume();
    for (let step = 0; step < maxSteps && !driver.getState().completed; step++) {
        for(const [ position, message ] of (driver as any).handlerProxy.receiveSyncResponses()) {
            if(message) {
                let payload, data;
                if(Array.isArray(message)) {
                    ([ payload, data ] = message);
                } else {
                    payload = message;
                }
                driver.handleEvent(position, payload, data);
            }
        }
        driver.resume();
    }
    return driver.getState() as ControllerState<Controllers>;
}
