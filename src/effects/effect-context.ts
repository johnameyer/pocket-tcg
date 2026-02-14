import { TriggerType } from '../repository/effect-types.js';

// Base context shared by all effect call sites
type BaseEffectContext = {
    sourcePlayer: number;
    effectName: string;
    targetPlayerId?: number;
    targetCreatureIndex?: number;
};

// Attack effect context - has attacker info
export type AttackEffectContext = BaseEffectContext & {
    type: 'attack';
    attackerInstanceId: string;
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

// Trigger effect context - for automatic triggers
export type TriggerEffectContext = BaseEffectContext & {
    type: 'trigger';
    triggerType: TriggerType;
    creatureInstanceId: string;
    triggerData?: {
        damage?: number;
        energyType?: string;
        attackerPlayerId?: number;
    };
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
        resolvedDamage?: number,
    ): AttackEffectContext {
        return {
            type: 'attack',
            sourcePlayer,
            effectName,
            attackerInstanceId,
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
        triggerData?: {
            damage?: number;
            energyType?: string;
            attackerPlayerId?: number;
        },
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
