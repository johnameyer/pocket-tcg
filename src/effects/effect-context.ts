import { Effect } from '../repository/effect-types.js';

// Base context shared by all effect call sites
type BaseEffectContext = {
    sourcePlayer: number;
    effectName: string; // TODO: consider removing from trigger contexts (name varies per source; two .includes() flag checks in attack-damage-resolver/field-target-resolver need replacing first)
    targetPlayerId?: number;
    targetCreatureIndex?: number;
    /** Optional effects to resume after a wrapped choice/selection chain completes */
    selectionContinuationEffects?: Effect[];
    // sourceInstanceId and sourceToolInstanceId are NOT on the base type — each context type
    // that needs them declares them directly
};

// Shared base for all auto-triggered effect contexts
type BaseTriggerContext = BaseEffectContext & {
    /** Creature field instanceId (for creature/tool triggers) or stadium instanceId (for game triggers) */
    sourceInstanceId: string;
    /** Set when the trigger fires from a tool rather than an ability */
    sourceToolInstanceId?: string;
};

// Attack effect context
export type AttackEffectContext = BaseEffectContext & {
    type: 'attack';
    attackerInstanceId: string;
    defenderInstanceId: string;
    defenderPlayerId: number;
    resolvedDamage?: number;
};

// Ability effect context
export type AbilityEffectContext = BaseEffectContext & {
    type: 'ability';
    creatureInstanceId: string;
    fieldPosition: number; // 0 = active, 1+ = bench
    sourceInstanceId?: string;
};

// Card played effect context - for any card played from hand (supporter, item, tool, stadium)
export type CardPlayedEffectContext = BaseEffectContext & {
    type: 'card-played';
    cardType: 'supporter' | 'item' | 'tool' | 'stadium';
    /** Instance ID of the card (or creature) this effect is registered against, used for passive effect cleanup */
    sourceInstanceId?: string;
    /** Instance ID of the tool specifically, used for tool passive effect cleanup */
    sourceToolInstanceId?: string;
};

// Trigger effect contexts — one per trigger event type

export type DamagedTriggerEffectContext = BaseTriggerContext & {
    type: 'damaged-trigger';
    damage: number;
    attackerInstanceId?: string;
    attackerPlayerId?: number;
};

export type BeforeKnockoutTriggerEffectContext = BaseTriggerContext & {
    type: 'before-knockout-trigger';
    attackerInstanceId?: string;
    attackerPlayerId?: number;
};

export type OnAttackTriggerEffectContext = BaseTriggerContext & {
    type: 'on-attack-trigger';
    defenderInstanceId: string;
    defenderPlayerId: number;
};

export type EnergyAttachmentTriggerEffectContext = BaseTriggerContext & {
    type: 'energy-attachment-trigger';
    energyType: string;
    triggerTargetInstanceId: string;
    triggerTargetPlayerId: number;
};

export type EndOfTurnTriggerEffectContext = BaseTriggerContext & {
    type: 'end-of-turn-trigger';
};

export type StartOfTurnTriggerEffectContext = BaseTriggerContext & {
    type: 'start-of-turn-trigger';
};

export type OnPlayTriggerEffectContext = BaseTriggerContext & {
    type: 'on-play-trigger';
};

export type OnCheckupTriggerEffectContext = BaseTriggerContext & {
    type: 'on-checkup-trigger';
};

export type OnRetreatTriggerEffectContext = BaseTriggerContext & {
    type: 'on-retreat-trigger';
};

export type EffectContext =
    | AttackEffectContext
    | AbilityEffectContext
    | CardPlayedEffectContext
    | DamagedTriggerEffectContext
    | BeforeKnockoutTriggerEffectContext
    | OnAttackTriggerEffectContext
    | EnergyAttachmentTriggerEffectContext
    | EndOfTurnTriggerEffectContext
    | StartOfTurnTriggerEffectContext
    | OnPlayTriggerEffectContext
    | OnCheckupTriggerEffectContext
    | OnRetreatTriggerEffectContext;
