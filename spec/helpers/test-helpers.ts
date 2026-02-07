import { HandlerChain, ControllerState, HandlerResponsesQueue } from '@cards-ts/core';
import { GameHandler, HandlerData } from '../../src/game-handler.js';
import { ResponseMessage } from '../../src/messages/response-message.js';
import { gameFactory } from '../../src/game-factory.js';
import { GameSetup } from '../../src/game-setup.js';
import { Controllers } from '../../src/controllers/controllers.js';
import { mockRepository, MockCardRepository } from '../mock-repository.js';
import { CardRepository } from '../../src/repository/card-repository.js';
import { ModifierEffect } from '../../src/repository/effect-types.js';
import { StateBuilder } from './state-builder.js';

type ActionHandler = (handlerData: HandlerData, responses: HandlerResponsesQueue<ResponseMessage>) => void;
type MessageHandler = (handlerData: HandlerData, message: ResponseMessage) => void;

export const handlerCallLog: Array<{ player: number; handler: string }> = [];

export function createTestPlayers(actionHandler: ActionHandler, messageHandler?: MessageHandler) {
    const gameHandler: () => GameHandler = () => {
        const handlers: GameHandler = {
            handleAction: (data: HandlerData, queue: HandlerResponsesQueue<ResponseMessage>) => {
                return actionHandler(data, queue);
            },
            handleSelectActiveCard: (data: HandlerData, queue: HandlerResponsesQueue<ResponseMessage>) => {
                return actionHandler(data, queue);
            },
            handleSelectTarget: (data: HandlerData, queue: HandlerResponsesQueue<ResponseMessage>) => {
                return actionHandler(data, queue);
            },
            handleSelectEnergy: (data: HandlerData, queue: HandlerResponsesQueue<ResponseMessage>) => {
                return actionHandler(data, queue);
            },
            handleSelectCard: (data: HandlerData, queue: HandlerResponsesQueue<ResponseMessage>) => {
                return actionHandler(data, queue);
            },
            handleSelectChoice: (data: HandlerData, queue: HandlerResponsesQueue<ResponseMessage>) => {
                return actionHandler(data, queue);
            },
            handleSetup: (data: HandlerData, queue: HandlerResponsesQueue<ResponseMessage>) => {
                return actionHandler(data, queue);
            },
        };
        return handlers;
    };

    // @ts-expect-error - HandlerChain constructor typing
    return Array.from({ length: 2 }, () => new HandlerChain([ gameHandler() ]));
}

export function createTestPlayersWithDifferentHandlers(
    player0Handler: ActionHandler,
    player1Handler: ActionHandler,
    messageHandler?: MessageHandler,
) {
    const createGameHandler = (handler: ActionHandler): () => GameHandler => () => ({
        handleAction: handler,
        handleSelectActivecreature: handler,
        handleSelectActiveCard: handler,
        handleSelectTarget: handler,
        handleSelectEnergy: handler,
        handleSelectCard: handler,
        handleSelectChoice: handler,
        handleSetup: handler,
        handleMessage: messageHandler || (() => {}),
    });

    return [
        // @ts-expect-error
        new HandlerChain([ createGameHandler(player0Handler)() ]),
        // @ts-expect-error
        new HandlerChain([ createGameHandler(player1Handler)() ]),
    ];
}

export function createActionTracker(actions: ResponseMessage[], playerPosition?: number) {
    return {
        handler: (handlerData: HandlerData, responses: HandlerResponsesQueue<ResponseMessage>) => {
            /*
             * If playerPosition is specified, only handle actions for that player
             * If not specified, handle actions for any player
             */
            if (playerPosition !== undefined && handlerData.turn !== playerPosition) {
                return;
            }
            // Shift the next action off the list
            if (actions.length > 0) {
                const action = actions.shift()!;
                responses.push(action);
            }
        },
    };
}

/**
 * Initializes passive effects for abilities and tools that are already present in the game state.
 * This ensures test setup matches actual game behavior where passive effects are registered
 * when cards are played or when creatures with abilities enter the field.
 * 
 * @param state The game state to initialize
 * @param repository The card repository to look up card data
 */
export function initializePassiveEffectsForTestState(
    state: ControllerState<Controllers>,
    repository: CardRepository | MockCardRepository,
) {
    // Initialize passive effects for creatures with abilities
    for (let playerId = 0; playerId < state.field.creatures.length; playerId++) {
        const playerCreatures = state.field.creatures[playerId];
        
        for (let fieldIndex = 0; fieldIndex < playerCreatures.length; fieldIndex++) {
            const creature = playerCreatures[fieldIndex];
            if (!creature) {
                continue; 
            }
            
            // Get the current form of the creature (top of evolution stack)
            const currentForm = creature.evolutionStack[creature.evolutionStack.length - 1];
            if (!currentForm) {
                continue; 
            }
            
            try {
                const creatureData = repository.getCreature(currentForm.templateId);
                
                // Check if creature has a passive ability
                if (creatureData.ability && creatureData.ability.trigger.type === 'passive') {
                    // Register passive effects from the ability
                    for (const effect of creatureData.ability.effects) {
                        // Check if this is a modifier effect that should be registered as passive
                        if ('duration' in effect && effect.duration) {
                            const modifierEffect = effect as ModifierEffect;
                            
                            // Create the passive effect entry
                            const passiveEffect = {
                                id: `${state.effects.nextEffectId++}`,
                                sourcePlayer: playerId,
                                effectName: `${creatureData.name}'s ${creatureData.ability.name}`,
                                effect: modifierEffect,
                                duration: modifierEffect.duration,
                                createdTurn: state.turnCounter.turnNumber,
                                cardInstanceId: currentForm.instanceId, // Track which card instance this is tied to
                            };
                            
                            state.effects.activePassiveEffects.push(passiveEffect);
                        }
                    }
                }
            } catch (e) {
                // Creature not found in repository, skip
            }
        }
    }
    
    /*
     * Initialize passive effects for tools
     * Tools are tracked in state.tools.attachedTools as { [creatureInstanceId]: { templateId, instanceId } }
     */
    for (const [ creatureInstanceId, tool ] of Object.entries(state.tools.attachedTools)) {
        if (!tool) {
            continue; 
        }
        
        try {
            const toolData = repository.getTool(tool.templateId);
            
            if (toolData.effects) {
                for (const effect of toolData.effects) {
                    // Check if this is a modifier effect that should be registered as passive
                    if ('duration' in effect && effect.duration) {
                        const modifierEffect = effect as ModifierEffect;
                        
                        // Create the passive effect entry
                        const passiveEffect = {
                            id: `${state.effects.nextEffectId++}`,
                            sourcePlayer: 0, // We need to determine which player owns this creature
                            effectName: `${toolData.name}`,
                            effect: modifierEffect,
                            duration: modifierEffect.duration,
                            createdTurn: state.turnCounter.turnNumber,
                            toolInstanceId: tool.instanceId, // Track which tool instance this is tied to
                            cardInstanceId: creatureInstanceId, // Track which card the tool is attached to
                        };
                        
                        // Determine which player owns this creature
                        let ownerPlayer = 0;
                        for (let playerId = 0; playerId < state.field.creatures.length; playerId++) {
                            const playerCreatures = state.field.creatures[playerId];
                            for (const creature of playerCreatures) {
                                // Check if this creature has the fieldInstanceId that matches the tool attachment
                                if (creature && creature.fieldInstanceId === creatureInstanceId) {
                                    ownerPlayer = playerId;
                                    break;
                                }
                                // Also check evolution stack for backward compatibility
                                if (creature && creature.evolutionStack.some(card => card.instanceId === creatureInstanceId)) {
                                    ownerPlayer = playerId;
                                    break;
                                }
                            }
                        }
                        passiveEffect.sourcePlayer = ownerPlayer;
                        
                        state.effects.activePassiveEffects.push(passiveEffect);
                    }
                }
            }
        } catch (e) {
            // Tool not found in repository, skip
        }
    }
    
    // Initialize passive effects for stadium
    if (state.stadium?.activeStadium) {
        const stadium = state.stadium.activeStadium;
        
        try {
            const stadiumData = repository.getStadium(stadium.templateId);
            
            if (stadiumData.effects) {
                for (const effect of stadiumData.effects) {
                    // Check if this is a modifier effect that should be registered as passive
                    if ('duration' in effect && effect.duration) {
                        const modifierEffect = effect as ModifierEffect;
                        
                        // Create the passive effect entry
                        const passiveEffect = {
                            id: `${state.effects.nextEffectId++}`,
                            sourcePlayer: stadium.owner,
                            effectName: `${stadiumData.name}`,
                            effect: modifierEffect,
                            duration: modifierEffect.duration,
                            createdTurn: state.turnCounter.turnNumber,
                            cardInstanceId: stadium.instanceId, // Track which stadium instance this is tied to
                        };
                        
                        state.effects.activePassiveEffects.push(passiveEffect);
                    }
                }
            }
        } catch (e) {
            // Stadium not found in repository, skip
        }
    }
}

export interface TestGameConfig {
    actions: ResponseMessage[];
    stateCustomizer?: (state: ControllerState<Controllers>) => void;
    resumeFrom?: ControllerState<Controllers>;
    customRepository?: MockCardRepository;
    playerPosition?: number;
}

/**
 * Run a game scenario with specified actions.
 * 
 * USAGE PATTERNS:
 * 
 * 1. SINGLE TURN: All actions happen on one player's turn
 *    ```
 *    const { state } = runTestGame({
 *      actions: [action1, action2, new EndTurnResponseMessage()],
 *      stateCustomizer: setup
 *    });
 *    ```
 * 
 * 2. MULTI-TURN (continuous): Multiple players' turns in one game
 *    ```
 *    const { state } = runTestGame({
 *      actions: [
 *        // P0 turn (starts at turn 2 by default)
 *        action1,
 *        new EndTurnResponseMessage(),
 *        // P1 turn (turn 3)
 *        action2,
 *        new EndTurnResponseMessage(),
 *        // P0 turn (turn 4)
 *        action3,
 *      ],
 *      stateCustomizer: setup
 *    });
 *    ```
 *    Turn counter increments after each player's turn (turn 2 → 3 → 4 → 5 → ...).
 * 
 * 3. MULTI-TURN WITH STATE INTROSPECTION: When you need to inspect state between turns
 *    (only use when you need getExecutedCount() or state validation between turns):
 *    ```
 *    let state = runTestGame({actions: [P0_actions], stateCustomizer: setup}).state;
 *    // Inspect state here if needed
 *    state = runTestGame({actions: [P1_actions], resumeFrom: state}).state;
 *    ```
 * 
 * DEBUG TIP: If actions seem to be converted to EndTurnResponseMessage unexpectedly,
 * check getExecutedCount() to verify actions were validated. Failed validations
 * cause the action to be skipped and turn to end.
 */
export function runTestGame(config: TestGameConfig) {
    let validatedCount = 0;
    const actions = config.actions; // Pass by reference - will be mutated by shift()
    const tracker = createActionTracker(actions, config.playerPosition);
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
    
    // Initialize passive effects for any abilities and tools in the pre-configured state
    initializePassiveEffectsForTestState(preConfiguredState, repository);
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Framework driver requires state to be untyped for private API
    const driver = gameFactory(repository).getGameDriver(players, params, [ 'TestPlayer', 'OpponentPlayer' ], preConfiguredState as any);
    
    driver.resume();
    const maxSteps = 5; // prevent infinite loops
    for (let step = 0; step < maxSteps && !driver.getState().completed; step++) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Accessing private handlerProxy API
        for (const [ position, message ] of (driver as any).handlerProxy.receiveSyncResponses()) {
            if (message) {
                let payload, data;
                if (Array.isArray(message)) {
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
        
        // If we're in a waiting state with actions available, handle actions before resume
        const currentState = driver.getState();
        if (!currentState.completed && currentState.waiting && actions.length > 0) {
            const waitingPositions = currentState.waiting.waiting;
            if (waitingPositions) {
                const positions = Array.isArray(waitingPositions) ? waitingPositions : [ waitingPositions ];
                
                /*
                 * If waiting for a player action and this is an action for that player
                 * submit the action manually so the game will then be able to resume.
                 * If playerPosition is configured, only process actions for that player.
                 */
                if (positions.length > 0) {
                    // Get the waiting player
                    const waitingPlayer = positions[0];
                    const targetPlayer = config.playerPosition ?? 0;
                    
                    // Only handle actions for the target player
                    if (waitingPlayer !== targetPlayer) {
                        // TODO nicer contextual error message
                        throw new Error('Action for wrong player');
                    }
                    
                    // Get the next action directly from the array
                    const nextAction = actions.shift();
                    if (nextAction) {
                        const wasValidated = driver.handleEvent(waitingPlayer, nextAction, undefined);
                        if (wasValidated) {
                            validatedCount++;
                        }
                    }
                }
            }
        }
        
        driver.resume();
    }
    
    // Final check: if we still have actions after the loop completes, that's an error
    const finalState = driver.getState();
    if ((finalState.completed || finalState.waiting) && actions.length > 0) {
        const waitingPositions = finalState.waiting.waiting;
        if (waitingPositions) {
            const positions = Array.isArray(waitingPositions) ? waitingPositions : [ waitingPositions ];
            if (positions.length > 0) {
                // If there are actions left but we're still waiting, throw an error
                throw new Error(
                    `Test has ${actions.length} actions remaining but game is waiting for player(s) ${positions.join(', ')}. `
                    + 'Actions may be for the wrong player or turn order.',
                );
            }
        }
    }

    const state = driver.getState() as ControllerState<Controllers>;
    
    return {
        driver,
        /**
         * Number of actions that were successfully validated and executed.
         * Use to debug if actions aren't being validated - if getExecutedCount() < actions.length,
         * some actions failed validation and were skipped (usually converting to EndTurnResponseMessage).
         */
        getExecutedCount: () => validatedCount,
        state,
    };
}

/**
 * Helper function to run a complete bot game with optional integrity checks
 * @param config Configuration for the bot game
 */
export function runBotGame(config: {
    customRepository?: MockCardRepository;
    initialDecks: string[][];
    maxSteps?: number;
    integrityCheck?: (state: ControllerState<Controllers>, step: number) => void;
}) {
    const repository = config.customRepository || mockRepository;
    const factory = gameFactory(repository);
    
    // Create bot handlers
    const handlers = Array.from({ length: 2 }, () => factory.getDefaultBotHandlerChain());
    
    const params = {
        ...factory.getGameSetup().getDefaultParams(),
        initialDecks: config.initialDecks,
    };
    
    const names = [ 'Player1', 'Player2' ];
    const driver = factory.getGameDriver(handlers, params, names);
    
    driver.resume();
    
    const maxSteps = config.maxSteps || 200;
    let stepCount = 0;
    
    while (!driver.getState().completed && stepCount < maxSteps) {
        driver.handleSyncResponses();
        driver.resume();
        stepCount++;
        
        const stateAfter = driver.getState() as ControllerState<Controllers>;
        
        // Call integrity check if provided
        if (config.integrityCheck) {
            config.integrityCheck(stateAfter, stepCount);
        }
        
        if (stateAfter.completed) {
            break;
        }
    }
    
    return driver.getState();
}
