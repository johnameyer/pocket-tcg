import { HandlerData } from '../../src/game-handler.js';
import { GameCard } from '../../src/controllers/card-types.js';
import { EnergyDictionary, AttachableEnergyType } from '../../src/controllers/energy-controller.js';
import { createInstancedFieldCard } from '../../src/utils/field-card-utils.js';

// Partial energy dictionary for test convenience
type PartialEnergyDict = Partial<Record<AttachableEnergyType, number>>;

// Helper function to create empty energy dictionary
const createEmptyEnergyDict = (): EnergyDictionary => ({
    grass: 0, fire: 0, water: 0, lightning: 0,
    psychic: 0, fighting: 0, darkness: 0, metal: 0
});

/**
 * Builder utility for creating HandlerData objects in tests.
 * Analogous to StateBuilder but focused on HandlerData for unit tests.
 * 
 * Usage:
 * ```typescript
 * const handlerData = HandlerDataBuilder.create()
 *     .withDeck(10)
 *     .withCreatures(0, 'basic-creature', ['basic-creature'])
 *     .withHand([{ templateId: 'item-card', type: 'item' }])
 *     .build();
 * ```
 */
export class HandlerDataBuilder {
    private data: Partial<HandlerData>;
    private playerPosition: number;

    private constructor(playerPosition: number = 0) {
        this.playerPosition = playerPosition;
        // Initialize with minimal defaults
        this.data = {
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
                evolutionFlexibility: []
            },
            energy: { 
                currentEnergy: [null, null], 
                isAbsoluteFirstTurn: false,
                nextEnergy: [null, null],
                attachedEnergyByInstance: {},
                availableTypes: [[], []],
                discardedEnergy: [createEmptyEnergyDict(), createEmptyEnergyDict()]
            },
            statusEffects: {
                activeStatusEffects: [[], []]
            }
        };
    }

    /**
     * Create a new HandlerDataBuilder for a specific player position.
     * @param playerPosition The player position (0 or 1) - defaults to 0
     */
    static create(playerPosition: number = 0): HandlerDataBuilder {
        return new HandlerDataBuilder(playerPosition);
    }

    /**
     * Set the deck size for the current player.
     * @param size Number of cards in deck
     */
    withDeck(size: number): this {
        this.data.deck = size;
        return this;
    }

    /**
     * Set the hand for the current player.
     * @param cards Array of cards in hand
     */
    withHand(cards: Array<{templateId: string, type?: GameCard['type']}>): this {
        this.data.hand = cards.map((card, index) => ({
            instanceId: `${card.templateId}-hand-${index}`,
            templateId: card.templateId,
            type: card.type || 'creature'
        }));
        return this;
    }

    /**
     * Set creatures on the field for a player.
     * @param player Player ID (0 or 1)
     * @param active Template ID of active creature
     * @param bench Array of template IDs for benched creatures
     */
    withCreatures(player: number, active: string, bench: string[] = []): this {
        if (!this.data.field) {
            this.data.field = { creatures: [[], []] };
        }
        
        const activeInstanceId = `${active}-${player}`;
        this.data.field.creatures[player] = [
            createInstancedFieldCard(activeInstanceId, active, 1),
            ...bench.map((templateId, index) => {
                const benchInstanceId = `${templateId}-${player}-bench-${index}`;
                return createInstancedFieldCard(benchInstanceId, templateId, 1);
            })
        ];
        return this;
    }

    /**
     * Set damage on a specific creature.
     * @param player Player ID (0 or 1)
     * @param fieldIndex Field position (0 = active, 1+ = bench)
     * @param damage Amount of damage
     */
    withDamage(player: number, fieldIndex: number, damage: number): this {
        if (!this.data.field) {
            this.data.field = { creatures: [[], []] };
        }
        
        if (this.data.field.creatures[player][fieldIndex]) {
            this.data.field.creatures[player][fieldIndex].damageTaken = damage;
        }
        return this;
    }

    /**
     * Set energy state.
     * @param currentEnergy Current energy for each player (null = not yet generated)
     * @param isAbsoluteFirstTurn Whether it's the absolute first turn
     */
    withEnergy(currentEnergy: [AttachableEnergyType | null, AttachableEnergyType | null], isAbsoluteFirstTurn: boolean = false): this {
        if (this.data.energy) {
            this.data.energy.currentEnergy = currentEnergy;
            this.data.energy.isAbsoluteFirstTurn = isAbsoluteFirstTurn;
        }
        return this;
    }

    /**
     * Set the turn number.
     * @param turnNumber The current turn number
     */
    withTurnNumber(turnNumber: number): this {
        if (!this.data.turnCounter) {
            this.data.turnCounter = { turnNumber: 1 };
        }
        this.data.turnCounter.turnNumber = turnNumber;
        return this;
    }

    /**
     * Set whether a supporter has been played this turn.
     * @param played Whether a supporter has been played
     */
    withSupporterPlayed(played: boolean): this {
        if (this.data.turnState) {
            this.data.turnState.supporterPlayedThisTurn = played;
        }
        return this;
    }

    /**
     * Set status effects for a player.
     * @param player Player ID (0 or 1)
     * @param effects Array of status effect types
     */
    withStatusEffects(player: number, effects: string[]): this {
        if (!this.data.statusEffects) {
            this.data.statusEffects = { activeStatusEffects: [[], []] };
        }
        this.data.statusEffects.activeStatusEffects[player] = effects.map(type => ({ type })) as any;
        return this;
    }

    /**
     * Build and return the HandlerData object.
     * @returns Complete HandlerData object
     */
    build(): HandlerData {
        return this.data as HandlerData;
    }
}
