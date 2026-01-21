import { buildProviders, Controllers } from '../../src/controllers/controllers.js';
import { GameSetup } from '../../src/game-setup.js';
import { EnergyDictionary, AttachableEnergyType } from '../../src/controllers/energy-controller.js';
import { GameCard } from '../../src/controllers/card-types.js';
import { ControllerState } from '@cards-ts/core';

// Partial energy dictionary for test convenience
type PartialEnergyDict = Partial<Record<AttachableEnergyType, number>>;

// Helper function to create empty energy dictionary
const createEmptyEnergyDict = (): EnergyDictionary => ({
    grass: 0, fire: 0, water: 0, lightning: 0,
    psychic: 0, fighting: 0, darkness: 0, metal: 0
});

// Helper function to validate creature instance exists
const validateCreatureInstance = (state: ControllerState<Controllers>, creatureInstanceId: string): boolean => {
    return state.field.creatures[0]?.some(p => p.instanceId === creatureInstanceId) ||
           state.field.creatures[1]?.some(p => p.instanceId === creatureInstanceId);
};

export class StateBuilder {
    // TODO: StateBuilder should use CreatureRepository for validation of creature IDs and stats
    /**
     * Create action phase state with customization closure
     * @param customizer Optional function to modify the default state
     */
    static createActionPhaseState(customizer?: (state: ControllerState<Controllers>) => void) {
        // Create default minimal state structure
        const state = {
            turn: 0,
            completed: false,
            state: 'ACTIONLOOP_ACTION_ACTION' as any,
            waiting: { waiting: [], responded: [] },
            points: [0, 0],
            names: ['Player 1', 'Player 2'],
            players: undefined,
            setup: {
                playersReady: [true, true]
            },
            params: {
                maxHandSize: 10,
                maxTurns: 30
            },
            data: [],
            turnCounter: {
                turnNumber: 2  // Start at turn 2 to avoid first turn restrictions
            },
            turnState: {
                shouldEndTurn: false,
                supporterPlayedThisTurn: false,
                retreatedThisTurn: false,
                evolvedInstancesThisTurn: [],
                usedAbilitiesThisTurn: [],
                pendingTargetSelection: undefined,
                damageBoosts: [],
                damageReductions: [],
                retreatCostReductions: [],
                retreatPreventions: [],
                damagePrevention: [],
                evolutionFlexibility: [],
            },
            statusEffects: {
                activeStatusEffects: [[], []]  // No status effects for either player
            },
            coinFlip: {
                nextFlipGuaranteedHeads: false,
                mockedResults: [],
                mockedResultIndex: 0
            },
            field: {
                creatures: [
                    [{ damageTaken: 0, templateId: 'basic-creature', instanceId: 'basic-creature-1', turnPlayed: 0 }],
                    [{ damageTaken: 0, templateId: 'basic-creature', instanceId: 'basic-creature-2', turnPlayed: 0 }]
                ]
            },
            energy: {
                currentEnergy: [null, null],
                nextEnergy: [null, null],
                availableTypes: [['fire'], ['fire']],
                isAbsoluteFirstTurn: false,
                attachedEnergyByInstance: {} as Record<string, EnergyDictionary>
            },
            tools: {
                attachedTools: {} as Record<string, { templateId: string, instanceId: string }>
            },
            cardRepository: {},
            deck: [[], []], // Array of card arrays for each player
            hand: [[], []],  // Array of card arrays for each player
            discard: [[], []]  // Array of discarded card arrays for each player
        } satisfies ControllerState<Controllers>;
        
        // Apply customization if provided
        if (customizer) {
            customizer(state as unknown as ControllerState<Controllers>);
        }
        
        return state;
    }

    /**
     * Customize the game state (e.g., to set a specific starting state in the state machine)
     * @param stateName The name of the state to start at (e.g., 'generateEnergyAndDrawCard', 'START_GAME', 'checkupPhase')
     * @returns A customizer function that sets the game state
     * 
     * Common state names for unit tests:
     * - 'START_GAME' - Beginning of game before setup
     * - 'generateEnergyAndDrawCard' - Start of turn before actions
     * - 'checkupPhase' - Checkup phase at end of turn
     * - 'ACTIONLOOP_ACTION_ACTION' - Main action phase (default for createActionPhaseState)
     * - 'nextTurn' - Transition between turns
     * 
     * Note: State names may change if the state machine is modified.
     * Run `console.log(Object.keys(flattened.states))` in @cards-ts/state-machine's adapt.js to see all available states.
     */
    static withGameState(stateName: string) {
        return (state: ControllerState<Controllers>) => {
            state.state = stateName as any;
            
            // Adjust setup based on state
            if (stateName === 'START_GAME') {
                state.setup.playersReady = [false, false];
                state.turnCounter.turnNumber = 0;
                state.field.creatures = [[], []];
                state.energy.isAbsoluteFirstTurn = true;
            } else {
                state.setup.playersReady = [true, true];
                if (state.turnCounter.turnNumber === 0) {
                    state.turnCounter.turnNumber = 2;
                }
                // Ensure creatures exist if not in START_GAME
                if (state.field.creatures[0].length === 0) {
                    state.field.creatures = [
                        [{ damageTaken: 0, templateId: 'basic-creature', instanceId: 'basic-creature-1', turnPlayed: 0 }],
                        [{ damageTaken: 0, templateId: 'basic-creature', instanceId: 'basic-creature-2', turnPlayed: 0 }]
                    ];
                }
            }
            
            if (stateName === 'generateEnergyAndDrawCard') {
                state.energy.isAbsoluteFirstTurn = true;
            }
        };
    }

    // TODO: StateBuilder should use CreatureRepository to validate creature IDs exist before creating instances
    static withCreatures(player: number, active: string, bench: string[] = []) {
        return (state: ControllerState<Controllers>) => {
            // Create array with active creature at position 0, bench at 1+
            state.field.creatures[player] = [
                { 
                    damageTaken: 0, 
                    templateId: active, 
                    instanceId: `${active}-${player}`, 
                    turnPlayed: 1 
                },
                ...bench.map((templateId, index) => ({
                    damageTaken: 0,
                    templateId,
                    instanceId: `${templateId}-${player}-${index}`,
                    turnPlayed: 1
                }))
            ];
        };
    }

    static withEnergy(creatureInstanceId: string, energyTypes: PartialEnergyDict) {
        return (state: ControllerState<Controllers>) => {
            StateBuilder.validateInstanceIdWithError(state, creatureInstanceId);
            state.energy.attachedEnergyByInstance[creatureInstanceId] = {...createEmptyEnergyDict(), ...energyTypes};
        };
    }

    static withHand(player: number, cards: Array<{templateId: string, type?: GameCard['type']}>) {
        return (state: ControllerState<Controllers>) => {
            state.hand[player] = cards.map((card, index) => ({
                instanceId: `${card.templateId}-hand-${index}`,
                templateId: card.templateId,
                type: card.type || 'creature'
            }));
        };
    }

    private static validateInstanceIdWithError(state: ControllerState<Controllers>, creatureInstanceId: string): void {
        const creatureExists = validateCreatureInstance(state, creatureInstanceId);
        
        if (!creatureExists) {
            const availableInstances = [];
            for (let player = 0; player < 2; player++) {
                for (const creature of state.field.creatures[player]) {
                    availableInstances.push(creature.instanceId);
                }
            }
            throw new Error(`Creature instance '${creatureInstanceId}' not found. Available instances: ${availableInstances.join(', ')}`);
        }
    }

    static withDamage(creatureInstanceId: string, damage: number) {
        return (state: ControllerState<Controllers>) => {
            // Find and update damage for the specified creature instance
            for (let player = 0; player < 2; player++) {
                for (const creature of state.field.creatures[player]) {
                    if (creature.instanceId === creatureInstanceId) {
                        creature.damageTaken = damage;
                        return;
                    }
                }
            }
            
            // If we get here, the creature instance wasn't found
            StateBuilder.validateInstanceIdWithError(state, creatureInstanceId);
        };
    }

    static withStatusEffect(player: number, effect: string) {
        return (state: ControllerState<Controllers>) => {
            // Convert string to StatusEffectType enum
            const statusEffectMap: Record<string, string> = {
                'sleep': 'sleep',
                'burn': 'burn', 
                'confusion': 'confusion',
                'paralysis': 'paralysis',
                'poison': 'poison'
            };
            
            const effectType = statusEffectMap[effect] || effect;
            // Include appliedTurn property with a default value of 1
            state.statusEffects.activeStatusEffects[player] = [{ type: effectType, appliedTurn: 1 }];
        };
    }

    static withTurnNumber(turnNumber: number) {
        return (state: ControllerState<Controllers>) => {
            state.turnCounter.turnNumber = turnNumber;
        };
    }

    static withFirstTurnRestriction(isFirstTurn: boolean = true) {
        return (state: ControllerState<Controllers>) => {
            state.energy.isAbsoluteFirstTurn = isFirstTurn;
        };
    }

    static withCanEvolve(player: number, position: number = 0) {
        return (state: ControllerState<Controllers>) => {
            // TODO Evolution logic is handled by the evolution controller or turn state
        };
    }

    static withTurn(turn: number) {
        return (state: ControllerState<Controllers>) => {
            state.turn = turn;
        };
    }

    static withDeck(player: number, cards: Array<{templateId: string, type?: GameCard['type']}>) {
        return (state: ControllerState<Controllers>) => {
            state.deck[player] = cards.map((card, index) => ({
                instanceId: `${card.templateId}-deck-${index}`,
                templateId: card.templateId,
                type: card.type || 'creature'
            }));
        };
    }

    static withTool(creatureInstanceId: string, toolCardId: string) {
        return (state: ControllerState<Controllers>) => {
            StateBuilder.validateInstanceIdWithError(state, creatureInstanceId);
            state.tools.attachedTools[creatureInstanceId] = { 
                templateId: toolCardId, 
                instanceId: `${toolCardId}-1` 
            };
        };
    }

    static withCurrentEnergy(player: number, energyTypes: PartialEnergyDict) {
        return (state: ControllerState<Controllers>) => {
            // Find the first non-zero energy type and set it as current energy
            const firstEnergyType = Object.entries(energyTypes).find(([_, count]) => count && count > 0);
            if (firstEnergyType) {
                state.energy.currentEnergy[player] = firstEnergyType[0] as AttachableEnergyType;
            } else {
                state.energy.currentEnergy[player] = null;
            }
        };
    }

    static withNoEnergy(player: number) {
        return (state: ControllerState<Controllers>) => {
            // Set current energy to null (no energy available)
            state.energy.currentEnergy[player] = null;
            state.energy.nextEnergy[player] = null;
        };
    }

    static withMockedCoinFlips(results: boolean[]) {
        return (state: ControllerState<Controllers>) => {
            state.coinFlip.mockedResults = results;
            state.coinFlip.mockedResultIndex = 0;
        };
    }

    static combine(...customizers: Array<(state: ControllerState<Controllers>) => void>) {
        return (state: ControllerState<Controllers>) => {
            customizers.forEach(customizer => customizer(state));
        };
    }
}
