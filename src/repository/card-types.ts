import { Effect, PendingTargetEffect } from './effect-types.js';
import { EffectValue } from './effect-value-types.js';

/**
 * Type for operation types in effects.
 */
export type OperationType = 'heal' | 'damage' | 'attach' | 'discard';

/**
 * Represents a trigger condition that determines when an effect should activate.
 */
export type Trigger = 
    | { type: 'manual', unlimited: boolean }
    | { type: 'end-of-turn', ownTurnOnly?: boolean, firstTurnOnly?: boolean }
    | { type: 'damaged', position?: string }
    | { type: 'passive' }
    | { type: 'energy-attachment', energyType?: string }
    | { type: 'on-evolution' };

/**
 * Represents a creature attack.
 */
export type CreatureAttack = {
    name: string;
    damage: number | EffectValue;
    energyRequirements: EnergyRequirement[];
    effects?: Effect[];
};

/**
 * Represents an ability that a creature can have.
 */
export type CreatureAbility = {
    name: string;
    trigger: Trigger;
    effects: Effect[];
};

/**
 * Represents energy requirements for attacks or abilities.
 */
export type EnergyRequirement = {
    type: string;
    amount: number;
};

/**
 * Represents a creature card.
 */
export type CreatureData = {
    templateId: string;
    name: string;
    maxHp: number;
    type: string;
    weakness?: string;
    retreatCost: number;
    attacks: CreatureAttack[];
    ability?: CreatureAbility;
    stage?: number;
    evolvesFrom?: string;
    attributes?: {
        ex?: boolean;
        ultraBeast?: boolean;
    };
};

/**
 * Represents a supporter card.
 */
export type SupporterData = {
    templateId: string;
    name: string;
    effects: Effect[];
};

/**
 * Represents an item card.
 */
export type ItemData = {
    templateId: string;
    name: string;
    effects: Effect[];
};

/**
 * Represents a tool card.
 */
export type ToolData = {
    templateId: string;
    name: string;
    effects: Effect[];
    trigger?: Trigger;
};

/**
 * Represents a single form in an evolution chain.
 */
export type EvolutionStackCard = {
    instanceId: string; // Instance ID of this specific form (from hand)
    templateId: string; // Card template ID
};

/**
 * Represents a field card with complete evolution history.
 * This is the internal state representation.
 */
export type InstancedFieldCard = {
    fieldInstanceId: string; // Unique ID that persists through evolution (for energy/tool attachment)
    evolutionStack: EvolutionStackCard[]; // Track all forms in evolution chain
    damageTaken: number;
    turnLastPlayed: number; // Track when a card was last played / added for evolution restrictions
};
