import { TriggerType } from '../repository/effect-types.js';

// Base context shared by all effect call sites
type BaseEffectContext = {
    sourcePlayer: number;
    effectName: string;
    targetPlayerId?: number;
    targetCreatureIndex?: number;
};

// Attack effect context - has attacker and defender info
export type AttackEffectContext = BaseEffectContext & {
    type: 'attack';
    attackerInstanceId: string;
    defenderInstanceId: string;
    defenderPlayerId: number;
    resolvedDamage?: number;
};

// Ability effect context - has creature position info
export type AbilityEffectContext = BaseEffectContext & {
    type: 'ability';
    creatureInstanceId: string;
    fieldPosition: number; // 0 = active, 1+ = bench
};

// Card effect context - for trainer cards
export type CardEffectContext = BaseEffectContext & {
    type: 'trainer';
    cardType: 'supporter' | 'item';
};

/**
 * Contextual data carried by trigger contexts.
 * Which fields are populated depends on the triggerType:
 * - 'damaged' / 'before-knockout': attackerInstanceId + attackerPlayerId
 * - 'energy-attachment': energyType + triggerTargetInstanceId + triggerTargetPlayerId
 * - 'on-attack': defenderInstanceId + defenderPlayerId
 */
export type TriggerContextData = {
    damage?: number;
    energyType?: string;
    /** Instance ID of the creature that caused the damage (for 'damaged'/'before-knockout' triggers) */
    attackerInstanceId?: string;
    /** Player ID of the attacking creature (for 'damaged'/'before-knockout' triggers) */
    attackerPlayerId?: number;
    /** Instance ID of the creature the event acted upon (for 'energy-attachment' triggers) */
    triggerTargetInstanceId?: string;
    /** Player ID of the trigger target creature (for 'energy-attachment' triggers) */
    triggerTargetPlayerId?: number;
    /** Instance ID of the defending creature (for 'on-attack' triggers) */
    defenderInstanceId?: string;
    /** Player ID of the defending creature (for 'on-attack' triggers) */
    defenderPlayerId?: number;
};

// Trigger effect context - for automatic triggers
export type TriggerEffectContext = BaseEffectContext & {
    type: 'trigger';
    triggerType: TriggerType;
    creatureInstanceId: string;
    triggerData?: TriggerContextData;
};

export type EffectContext =
    | AttackEffectContext 
    | AbilityEffectContext 
    | CardEffectContext 
    | TriggerEffectContext;

// Helper to create contexts for different call sites
export class EffectContextFactory {
    static createAttackContext(
        sourcePlayer: number,
        effectName: string,
        attackerInstanceId: string,
        defenderInstanceId: string,
        defenderPlayerId: number,
        resolvedDamage?: number,
    ): AttackEffectContext {
        return {
            type: 'attack',
            sourcePlayer,
            effectName,
            attackerInstanceId,
            defenderInstanceId,
            defenderPlayerId,
            resolvedDamage,
        };
    }

    static createAbilityContext(
        sourcePlayer: number,
        effectName: string,
        creatureInstanceId: string,
        fieldPosition: number,
    ): AbilityEffectContext {
        return {
            type: 'ability',
            sourcePlayer,
            effectName,
            creatureInstanceId,
            fieldPosition,
        };
    }

    static createCardContext(
        sourcePlayer: number,
        effectName: string,
        cardType: 'supporter' | 'item',
    ): CardEffectContext {
        return {
            type: 'trainer',
            sourcePlayer,
            effectName,
            cardType,
        };
    }

    static createTriggerContext(
        sourcePlayer: number,
        effectName: string,
        triggerType: TriggerType,
        creatureInstanceId: string,
        triggerData?: TriggerContextData,
    ): TriggerEffectContext {
        return {
            type: 'trigger',
            sourcePlayer,
            effectName,
            triggerType,
            creatureInstanceId,
            triggerData,
        };
    }
}
