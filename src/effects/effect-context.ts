import { TriggerType } from '../repository/effect-types.js';

// Base context shared by all effect call sites
type BaseEffectContext = {
    sourcePlayer: number;
    effectName: string;
    targetPlayerId?: number;
    targetCreatureIndex?: number;
    /** Optional instance ID of the card that owns this effect, used for passive effect cleanup */
    sourceInstanceId?: string;
    /** Optional instance ID of the tool that owns this effect, used for tool passive effect cleanup */
    sourceToolInstanceId?: string;
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

// Card effect context - for trainer cards (supporter, item) and played cards (tool, stadium)
export type CardEffectContext = BaseEffectContext & {
    type: 'trainer';
    cardType: 'supporter' | 'item' | 'tool' | 'stadium';
};

/**
 * Contextual data for trigger effects, discriminated on `triggerType`.
 * Each variant carries only the data relevant to that trigger type.
 */
export type TriggerContextData =
    | { triggerType: 'damaged'; damage: number; attackerInstanceId?: string; attackerPlayerId?: number }
    | { triggerType: 'before-knockout'; attackerInstanceId?: string; attackerPlayerId?: number }
    | { triggerType: 'on-attack'; defenderInstanceId: string; defenderPlayerId: number }
    | { triggerType: 'energy-attachment'; energyType: string; triggerTargetInstanceId: string; triggerTargetPlayerId: number }
    | { triggerType: Exclude<TriggerType, 'damaged' | 'before-knockout' | 'on-attack' | 'energy-attachment'> };

// Trigger effect context - for automatic triggers
export type TriggerEffectContext = BaseEffectContext & {
    type: 'trigger';
    creatureInstanceId: string;
} & TriggerContextData;

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
        cardType: 'supporter' | 'item' | 'tool' | 'stadium',
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
        creatureInstanceId: string,
        triggerData: TriggerContextData,
    ): TriggerEffectContext {
        return {
            type: 'trigger',
            sourcePlayer,
            effectName,
            creatureInstanceId,
            ...triggerData,
        };
    }
}
