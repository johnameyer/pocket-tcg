import { Effect } from './effect-types.js';
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
    | { type: 'on-evolution' }
    | { type: 'start-of-turn', ownTurnOnly?: boolean }
    | { type: 'on-play', filterEvolution?: boolean }
    | { type: 'before-knockout' }
    | { type: 'on-checkup', ownTurnOnly?: boolean }
    | { type: 'on-retreat' };

/**
 * Maps each trigger type to the contextual `reference` values that are valid in
 * effects attached to that trigger.
 *
 * This type is the single source of truth for compile-time enforcement:
 *  - `CreatureAbility` and `ToolData` use it to constrain their `effects` arrays.
 *  - `ContextualFieldTarget<TRef>` rejects any `TRef` not in this map for that trigger.
 *
 * To add a new contextual reference, extend the relevant trigger entry here.
 */
export type TriggerContextualRefs = {
    manual: never;
    'end-of-turn': never;
    damaged: 'attacker';
    passive: never;
    'energy-attachment': 'trigger-target';
    'on-evolution': never;
    'start-of-turn': never;
    'on-play': never;
    'before-knockout': 'attacker';
    'on-checkup': never;
    'on-retreat': never;
};

// ---------------------------------------------------------------------------
// Helper: pair a single Trigger variant T with its correctly-typed effects
// ---------------------------------------------------------------------------
type _CreatureAbilityForTrigger<T extends Trigger> = {
    name: string;
    description?: string;
    trigger: T;
    effects: Effect<TriggerContextualRefs[T['type']]>[];
};

/**
 * Represents an ability that a creature can have.
 *
 * `CreatureAbility` is a discriminated union: the `trigger.type` discriminant
 * determines which contextual `reference` values are valid inside `effects`.
 * This is enforced at compile time via `TriggerContextualRefs`.
 */
export type CreatureAbility = {
    [K in Trigger['type']]: _CreatureAbilityForTrigger<Extract<Trigger, { type: K }>>
}[Trigger['type']];

// ---------------------------------------------------------------------------
// Tool data — discriminated union on trigger presence/type
// ---------------------------------------------------------------------------
type _ToolDataBase = {
    templateId: string;
    name: string;
    description?: string;
};

type _ToolDataNoTrigger = _ToolDataBase & {
    /** Passive modifier effects — no contextual refs available */
    effects: Effect<never>[];
    trigger?: undefined;
};

type _ToolDataWithTrigger<T extends Trigger> = _ToolDataBase & {
    effects: Effect<TriggerContextualRefs[T['type']]>[];
    trigger: T;
};

/**
 * Represents a creature attack.
 */
export type CreatureAttack = {
    name: string;
    description?: string;
    damage: number | EffectValue;
    energyRequirements: EnergyRequirement[];
    /**
     * Attack effects may reference the `'defender'` contextual target
     * (the opposing active creature that is being attacked).
     */
    effects?: Effect<'defender'>[];
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
    previousStageName?: string;
    attributes?: {
        ex?: boolean;
        mega?: boolean;
        ultraBeast?: boolean;
    };
};

/**
 * Represents a supporter card.
 * Supporter effects have no execution context, so contextual refs are disallowed.
 */
export type SupporterData = {
    templateId: string;
    name: string;
    description?: string;
    effects: Effect<never>[];
};

/**
 * Represents an item card.
 * Item effects have no execution context, so contextual refs are disallowed.
 */
export type ItemData = {
    templateId: string;
    name: string;
    description?: string;
    effects: Effect<never>[];
};

/**
 * Represents a tool card.
 *
 * `ToolData` is a discriminated union on `trigger`:
 *  - when `trigger` is absent the `effects` are passive modifier effects (`Effect<never>`).
 *  - when `trigger` is present the `effects` are trigger effects whose allowed contextual
 *    refs are derived from `TriggerContextualRefs[trigger.type]`.
 */
export type ToolData =
    | _ToolDataNoTrigger
    | { [K in Trigger['type']]: _ToolDataWithTrigger<Extract<Trigger, { type: K }>> }[Trigger['type']];

/**
 * Represents a stadium card.
 * Stadium effects have no execution context, so contextual refs are disallowed.
 */
export type StadiumData = {
    templateId: string;
    name: string;
    description?: string;
    effects: Effect<never>[];
};

/**
 * Union type for all card data types.
 */
export type CardData = CreatureData | SupporterData | ItemData | ToolData | StadiumData;

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
