import { HandlerData } from '../../src/game-handler.js';
import { GameCard } from '../../src/controllers/card-types.js';
import { EnergyDictionary, AttachableEnergyType } from '../../src/controllers/energy-controller.js';
import { createInstancedFieldCard } from '../../src/utils/field-card-utils.js';
import { StatusEffect } from '../../src/controllers/status-effect-controller.js';

// Partial energy dictionary for test convenience
type PartialEnergyDict = Partial<Record<AttachableEnergyType, number>>;

// Helper function to create empty energy dictionary
const createEmptyEnergyDict = (): EnergyDictionary => ({
    grass: 0, fire: 0, water: 0, lightning: 0,
    psychic: 0, fighting: 0, darkness: 0, metal: 0,
});

// Type for customizer function, analogous to StateBuilder
type HandlerDataCustomizer = (data: HandlerData) => void;

/**
 * Builder utility for creating HandlerData objects in tests.
 * Analogous to StateBuilder with combine pattern for composable customizers.
 * 
 * Usage:
 * ```typescript
 * const handlerData = HandlerDataBuilder.default(
 *     HandlerDataBuilder.withDeck(10),
 *     HandlerDataBuilder.withCreatures(0, 'basic-creature', ['basic-creature']),
 *     HandlerDataBuilder.withHand([{ templateId: 'item-card', type: 'item' }])
 * );
 * ```
 */
export class HandlerDataBuilder {
    /**
     * Create default HandlerData with customizers applied.
     * @param customizers Optional functions to modify the default data
     */
    static default(...customizers: HandlerDataCustomizer[]): HandlerData {
        /*
         * Create minimal HandlerData for unit testing
         * This is a partial representation - only includes properties needed for canApply tests
         */
        const data = {
            deck: 0,
            hand: [],
            field: { creatures: [[], []] },
            turnCounter: { turnNumber: 2 },
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
            energy: { 
                currentEnergy: [ null, null ], 
                isAbsoluteFirstTurn: false,
                nextEnergy: [ null, null ],
                attachedEnergyByInstance: {},
                availableTypes: [[], []],
                discardedEnergy: [ createEmptyEnergyDict(), createEmptyEnergyDict() ],
            },
            statusEffects: {
                activeStatusEffects: [[], []],
            },
        };
        
        // Apply customizers
        for (const customizer of customizers) {
            customizer(data as unknown as HandlerData);
        }
        
        return data as unknown as HandlerData;
    }

    /**
     * Combine multiple customizers into one.
     * @param customizers Customizers to combine
     */
    static combine(...customizers: HandlerDataCustomizer[]): HandlerDataCustomizer {
        return (data: HandlerData) => {
            for (const customizer of customizers) {
                customizer(data);
            }
        };
    }

    /**
     * Set the deck size.
     * @param size Number of cards in deck
     */
    static withDeck(size: number): HandlerDataCustomizer {
        return (data: HandlerData) => {
            data.deck = size;
        };
    }

    /**
     * Set the hand.
     * @param cards Array of cards in hand
     */
    static withHand(cards: Array<{ templateId: string, type?: GameCard['type'] }>): HandlerDataCustomizer {
        return (data: HandlerData) => {
            data.hand = cards.map((card, index) => ({
                instanceId: `${card.templateId}-hand-${index}`,
                templateId: card.templateId,
                type: card.type || 'creature',
            }));
        };
    }

    /**
     * Set creatures on the field for a player.
     * @param player Player ID (0 or 1)
     * @param active Template ID of active creature
     * @param bench Array of template IDs for benched creatures
     */
    static withCreatures(player: number, active: string, bench: string[] = []): HandlerDataCustomizer {
        return (data: HandlerData) => {
            const activeInstanceId = `${active}-${player}`;
            data.field.creatures[player] = [
                createInstancedFieldCard(activeInstanceId, active, 1),
                ...bench.map((templateId, index) => {
                    const benchInstanceId = `${templateId}-${player}-bench-${index}`;
                    return createInstancedFieldCard(benchInstanceId, templateId, 1);
                }),
            ];
        };
    }

    /**
     * Set damage on a specific creature.
     * @param player Player ID (0 or 1)
     * @param fieldIndex Field position (0 = active, 1+ = bench)
     * @param damage Amount of damage
     */
    static withDamage(player: number, fieldIndex: number, damage: number): HandlerDataCustomizer {
        return (data: HandlerData) => {
            if (data.field.creatures[player][fieldIndex]) {
                data.field.creatures[player][fieldIndex].damageTaken = damage;
            }
        };
    }

    /**
     * Set energy state.
     * @param currentEnergy Current energy for each player (null = not yet generated)
     * @param isAbsoluteFirstTurn Whether it's the absolute first turn
     */
    static withEnergyState(currentEnergy: [AttachableEnergyType | null, AttachableEnergyType | null], isAbsoluteFirstTurn: boolean = false): HandlerDataCustomizer {
        return (data: HandlerData) => {
            data.energy.currentEnergy = currentEnergy;
            data.energy.isAbsoluteFirstTurn = isAbsoluteFirstTurn;
        };
    }

    /**
     * Set the turn number.
     * @param turnNumber The current turn number
     */
    static withTurnNumber(turnNumber: number): HandlerDataCustomizer {
        return (data: HandlerData) => {
            data.turnCounter.turnNumber = turnNumber;
        };
    }

    /**
     * Set whether a supporter has been played this turn.
     * @param played Whether a supporter has been played
     */
    static withSupporterPlayed(played: boolean): HandlerDataCustomizer {
        return (data: HandlerData) => {
            data.turnState.supporterPlayedThisTurn = played;
        };
    }

    /**
     * Set status effects for a player.
     * @param player Player ID (0 or 1)
     * @param effects Array of status effect types
     */
    static withStatusEffects(player: number, effects: StatusEffect[]): HandlerDataCustomizer {
        return (data: HandlerData) => {
            data.statusEffects.activeStatusEffects[player] = effects;
        };
    }

    /**
     * Set tools attached to creatures.
     * @param attachedTools Map of field card instance ID to tool info
     */
    static withTools(attachedTools: { [fieldCardInstanceId: string]: { templateId: string; instanceId: string } }): HandlerDataCustomizer {
        return (data: HandlerData) => {
            if (!data.tools) {
                data.tools = { attachedTools: {} };
            }
            data.tools.attachedTools = attachedTools;
        };
    }
}
