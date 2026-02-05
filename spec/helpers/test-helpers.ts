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

export function createTestPlayers(actionHandler: ActionHandler, messageHandler?: MessageHandler) {
    const gameHandler: () => GameHandler = () => ({
        handleAction: actionHandler,
        handleSelectActivecreature: actionHandler,
        handleSelectActiveCard: actionHandler,
        handleSelectTarget: actionHandler,
        handleSelectEnergy: actionHandler,
        handleSelectCard: actionHandler,
        handleSelectChoice: actionHandler,
        handleSetup: actionHandler,
        handleMessage: messageHandler || (() => {}),
    });

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

export function createActionTracker(actions: ResponseMessage[], playerActions?: Map<number, ResponseMessage[]>) {
    let actionIndex = 0;
    
    return {
        handler: (handlerData: HandlerData, responses: HandlerResponsesQueue<ResponseMessage>) => {
            // If player-specific actions are provided, use those based on current turn
            if (playerActions) {
                const currentPlayer = handlerData.turn;
                const playerActionList = playerActions.get(currentPlayer);
                if (playerActionList && playerActionList.length > 0) {
                    responses.push(playerActionList.shift()!);
                }
            } else if (actionIndex < actions.length) {
                // Fallback to sequential actions for backward compatibility
                responses.push(actions[actionIndex++]);
            }
        },
        getRemainingActions: () => {
            if (playerActions) {
                let total = 0;
                for (const actions of playerActions.values()) {
                    total += actions.length;
                }
                return total;
            }
            return actions.length - actionIndex;
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
                                effect: {
                                    ...modifierEffect,
                                    // For while-in-play effects, populate the instanceId
                                    duration: modifierEffect.duration.type === 'while-in-play'
                                        ? { type: 'while-in-play' as const, instanceId: currentForm.instanceId }
                                        : modifierEffect.duration,
                                },
                                duration: modifierEffect.duration.type === 'while-in-play'
                                    ? { type: 'while-in-play' as const, instanceId: currentForm.instanceId }
                                    : modifierEffect.duration,
                                createdTurn: state.turnCounter.turnNumber,
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
                            effect: {
                                ...modifierEffect,
                                // For while-attached effects, populate the IDs
                                duration: modifierEffect.duration.type === 'while-attached'
                                    ? { type: 'while-attached' as const, toolInstanceId: tool.instanceId, cardInstanceId: creatureInstanceId }
                                    : modifierEffect.duration,
                            },
                            duration: modifierEffect.duration.type === 'while-attached'
                                ? { type: 'while-attached' as const, toolInstanceId: tool.instanceId, cardInstanceId: creatureInstanceId }
                                : modifierEffect.duration,
                            createdTurn: state.turnCounter.turnNumber,
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
}

export interface TestGameConfig {
    actions: ResponseMessage[];
    stateCustomizer?: (state: ControllerState<Controllers>) => void;
    resumeFrom?: ControllerState<Controllers>;
    maxSteps?: number;
    customRepository?: MockCardRepository;
}

export function runTestGame(config: TestGameConfig) {
    /*
     * TODO: State resumption has issues where the game gets stuck in waiting states
     * and the action tracker handler is never called to provide new actions.
     * The game remains in ACTIONLOOP_noop waiting for responses that never come.
     * For same-turn effects, use single runTestGame with multiple actions instead.
     */
    
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
    
    // Initialize passive effects for any abilities and tools in the pre-configured state
    initializePassiveEffectsForTestState(preConfiguredState, repository);
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Framework driver requires state to be untyped for private API
    const driver = gameFactory(repository).getGameDriver(players, params, [ 'TestPlayer', 'OpponentPlayer' ], preConfiguredState as any);
    
    driver.resume();
    const maxSteps = config.maxSteps !== undefined ? config.maxSteps : 5;
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
        driver.resume();
        
        // Check if we're in a waiting state with remaining actions
        const currentState = driver.getState();
        if (!currentState.completed && currentState.waiting && tracker.getRemainingActions() > 0) {
            const waitingPositions = currentState.waiting.waiting;
            if (waitingPositions) {
                const positions = Array.isArray(waitingPositions) ? waitingPositions : [waitingPositions];
                if (positions.length > 0) {
                    // If there are actions left but we're waiting for a player, throw an error
                    throw new Error(
                        `Test has ${tracker.getRemainingActions()} actions remaining but game is waiting for player(s) ${positions.join(', ')}. ` +
                        `Actions may be for the wrong player or turn order.`
                    );
                }
            }
        }
    }

    const state = driver.getState() as ControllerState<Controllers>;
    
    return {
        driver,
        getExecutedCount: () => validatedCount,
        state,
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
        // @ts-expect-error Accessing private handlerProxy API for test framework
        for (const [ position, message ] of driver.handlerProxy.receiveSyncResponses()) {
            if (message) {
                let payload, data;
                if (Array.isArray(message)) {
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
