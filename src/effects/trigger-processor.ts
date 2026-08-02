import { Controllers } from '../controllers/controllers.js';
import { Effect } from '../repository/effect-types.js';
import { Trigger } from '../repository/card-types.js';
import {
    DamagedTriggerEffectContext,
    BeforeKnockoutTriggerEffectContext,
    OnAttackTriggerEffectContext,
    EnergyAttachmentTriggerEffectContext,
    EndOfTurnTriggerEffectContext,
    StartOfTurnTriggerEffectContext,
    OnPlayTriggerEffectContext,
    OnCheckupTriggerEffectContext,
    OnRetreatTriggerEffectContext,
} from './effect-context.js';

type MatchingEffect<T extends Trigger['type']> = {
    effects: Effect[];
    name: string;
    trigger: Extract<Trigger, { type: T }>;
    sourceInstanceId: string;
    sourceToolInstanceId?: string;
};

/**
 * These methods should only be called from the state machine and event handler
 */
export class TriggerProcessor {
    /**
     * Returns tool and ability sources whose trigger type matches, with the trigger
     * narrowed to the specific variant so callers can access type-specific properties
     * (e.g. ownTurnOnly, filterEvolution) without further narrowing.
     */
    private static getMatchingEffects<T extends Trigger['type']>(
        controllers: Controllers,
        creatureInstanceId: string,
        creatureCardId: string,
        triggerType: T,
    ): MatchingEffect<T>[] {
        const matches: MatchingEffect<T>[] = [];

        const tool = controllers.tools.getAttachedTool(creatureInstanceId);
        if (tool) {
            const toolData = controllers.cardRepository.getTool(tool.templateId);
            if (toolData?.effects?.length && toolData.trigger?.type === triggerType) {
                matches.push({
                    trigger: toolData.trigger as Extract<Trigger, { type: T }>,
                    effects: toolData.effects,
                    name: toolData.name,
                    sourceInstanceId: creatureInstanceId,
                    sourceToolInstanceId: tool.instanceId,
                });
            }
        }

        const creatureData = controllers.cardRepository.getCreature(creatureCardId);
        if (creatureData?.ability?.effects?.length && creatureData.ability.trigger?.type === triggerType) {
            matches.push({
                trigger: creatureData.ability.trigger as Extract<Trigger, { type: T }>,
                effects: creatureData.ability.effects,
                name: `${creatureData.name}'s ${creatureData.ability.name}`,
                sourceInstanceId: creatureInstanceId,
            });
        }

        return matches;
    }

    private static getMatchingStadiumEffects<T extends Trigger['type']>(
        controllers: Controllers,
        currentPlayer: number,
        triggerType: T,
    ): MatchingEffect<T>[] {
        const activeStadium = controllers.stadium.getActiveStadium();
        if (!activeStadium) {
            return [];
        }
        const stadiumData = controllers.cardRepository.getStadium(activeStadium.templateId);
        if (!stadiumData?.effects?.length || stadiumData.trigger?.type !== triggerType) {
            return [];
        }
        return [{
            trigger: stadiumData.trigger as Extract<Trigger, { type: T }>,
            effects: stadiumData.effects,
            name: stadiumData.name,
            sourceInstanceId: activeStadium.instanceId,
        }];
    }

    static processWhenDamaged(
        controllers: Controllers,
        playerId: number,
        creatureInstanceId: string,
        creatureCardId: string,
        damageAmount: number,
        attackerInstanceId?: string,
        attackerPlayerId?: number,
    ): void {
        for (const { effects, name, sourceInstanceId, sourceToolInstanceId } of this.getMatchingEffects(controllers, creatureInstanceId, creatureCardId, 'damaged')) {
            const context: DamagedTriggerEffectContext = { type: 'damaged-trigger', sourcePlayer: playerId, effectName: name, sourceInstanceId, sourceToolInstanceId, damage: damageAmount, attackerInstanceId, attackerPlayerId };
            controllers.effects.pushPendingEffect(effects, context);
        }
    }

    static processEnergyAttachment(
        controllers: Controllers,
        triggerTargetPlayerId: number,
        triggerTargetInstanceId: string,
        energyType: string,
    ): void {
        for (let playerId = 0; playerId < controllers.players.count; playerId++) {
            const fieldCards = controllers.field.getCards(playerId);
            for (const card of fieldCards) {
                if (!card) {
                    continue;
                }
                for (const { effects, name, trigger, sourceInstanceId, sourceToolInstanceId } of this.getMatchingEffects(controllers, card.instanceId, card.templateId, 'energy-attachment')) {
                    if (trigger.energyType && trigger.energyType !== energyType) {
                        continue;
                    }
                    const context: EnergyAttachmentTriggerEffectContext = { type: 'energy-attachment-trigger', sourcePlayer: playerId, effectName: name, sourceInstanceId, sourceToolInstanceId, energyType, triggerTargetInstanceId, triggerTargetPlayerId };
                    controllers.effects.pushPendingEffect(effects, context);
                }
            }
        }
    }

    static processEndOfTurn(
        controllers: Controllers,
        playerId: number,
        creatureInstanceId: string,
        creatureCardId: string,
    ): void {
        const currentPlayer = controllers.turn.get();
        for (const { effects, name, trigger, sourceInstanceId, sourceToolInstanceId } of this.getMatchingEffects(controllers, creatureInstanceId, creatureCardId, 'end-of-turn')) {
            if (trigger.ownTurnOnly && playerId !== currentPlayer) {
                continue;
            }
            if (trigger.firstTurnOnly && controllers.turnCounter.getTurnNumber() !== 0) {
                continue;
            }
            const context: EndOfTurnTriggerEffectContext = { type: 'end-of-turn-trigger', sourcePlayer: playerId, effectName: name, sourceInstanceId, sourceToolInstanceId };
            controllers.effects.pushPendingEffect(effects, context);
        }
        for (const { effects, name, sourceInstanceId } of this.getMatchingStadiumEffects(controllers, currentPlayer, 'end-of-turn')) {
            const context: EndOfTurnTriggerEffectContext = { type: 'end-of-turn-trigger', sourcePlayer: currentPlayer, effectName: name, sourceInstanceId };
            controllers.effects.pushPendingEffect(effects, context);
        }
    }

    static processStartOfTurn(
        controllers: Controllers,
        playerId: number,
        creatureInstanceId: string,
        creatureCardId: string,
    ): void {
        const currentPlayer = controllers.turn.get();
        for (const { effects, name, trigger, sourceInstanceId, sourceToolInstanceId } of this.getMatchingEffects(controllers, creatureInstanceId, creatureCardId, 'start-of-turn')) {
            if (trigger.ownTurnOnly && playerId !== currentPlayer) {
                continue;
            }
            const context: StartOfTurnTriggerEffectContext = { type: 'start-of-turn-trigger', sourcePlayer: playerId, effectName: name, sourceInstanceId, sourceToolInstanceId };
            controllers.effects.pushPendingEffect(effects, context);
        }
        for (const { effects, name, sourceInstanceId } of this.getMatchingStadiumEffects(controllers, currentPlayer, 'start-of-turn')) {
            const context: StartOfTurnTriggerEffectContext = { type: 'start-of-turn-trigger', sourcePlayer: currentPlayer, effectName: name, sourceInstanceId };
            controllers.effects.pushPendingEffect(effects, context);
        }
    }

    static processOnPlay(
        controllers: Controllers,
        playerId: number,
        creatureInstanceId: string,
        creatureCardId: string,
        isEvolution: boolean,
    ): void {
        for (const { effects, name, trigger, sourceInstanceId, sourceToolInstanceId } of this.getMatchingEffects(controllers, creatureInstanceId, creatureCardId, 'on-play')) {
            if (trigger.filterEvolution && isEvolution) {
                continue;
            }
            const context: OnPlayTriggerEffectContext = { type: 'on-play-trigger', sourcePlayer: playerId, effectName: name, sourceInstanceId, sourceToolInstanceId };
            controllers.effects.pushPendingEffect(effects, context);
        }
    }

    static processOnAttack(
        controllers: Controllers,
        playerId: number,
        creatureInstanceId: string,
        creatureCardId: string,
        defenderInstanceId: string,
        defenderPlayerId: number,
    ): void {
        for (const { effects, name, sourceInstanceId, sourceToolInstanceId } of this.getMatchingEffects(controllers, creatureInstanceId, creatureCardId, 'on-attack')) {
            const context: OnAttackTriggerEffectContext = { type: 'on-attack-trigger', sourcePlayer: playerId, effectName: name, sourceInstanceId, sourceToolInstanceId, defenderInstanceId, defenderPlayerId };
            controllers.effects.pushPendingEffect(effects, context);
        }
    }

    static processBeforeKnockout(
        controllers: Controllers,
        playerId: number,
        creatureInstanceId: string,
        creatureCardId: string,
        attackerInstanceId?: string,
        attackerPlayerId?: number,
    ): void {
        for (const { effects, name, sourceInstanceId, sourceToolInstanceId } of this.getMatchingEffects(controllers, creatureInstanceId, creatureCardId, 'before-knockout')) {
            const context: BeforeKnockoutTriggerEffectContext = { type: 'before-knockout-trigger', sourcePlayer: playerId, effectName: name, sourceInstanceId, sourceToolInstanceId, attackerInstanceId, attackerPlayerId };
            controllers.effects.pushPendingEffect(effects, context);
        }
    }

    static processOnCheckup(
        controllers: Controllers,
        playerId: number,
        creatureInstanceId: string,
        creatureCardId: string,
    ): void {
        const currentPlayer = controllers.turn.get();
        for (const { effects, name, trigger, sourceInstanceId, sourceToolInstanceId } of this.getMatchingEffects(controllers, creatureInstanceId, creatureCardId, 'on-checkup')) {
            if (trigger.ownTurnOnly && playerId !== currentPlayer) {
                continue;
            }
            const context: OnCheckupTriggerEffectContext = { type: 'on-checkup-trigger', sourcePlayer: playerId, effectName: name, sourceInstanceId, sourceToolInstanceId };
            controllers.effects.pushPendingEffect(effects, context);
        }
        for (const { effects, name, sourceInstanceId } of this.getMatchingStadiumEffects(controllers, currentPlayer, 'on-checkup')) {
            const context: OnCheckupTriggerEffectContext = { type: 'on-checkup-trigger', sourcePlayer: currentPlayer, effectName: name, sourceInstanceId };
            controllers.effects.pushPendingEffect(effects, context);
        }
    }

    static processOnRetreat(
        controllers: Controllers,
        playerId: number,
        creatureInstanceId: string,
        creatureCardId: string,
    ): void {
        for (const { effects, name, sourceInstanceId, sourceToolInstanceId } of this.getMatchingEffects(controllers, creatureInstanceId, creatureCardId, 'on-retreat')) {
            const context: OnRetreatTriggerEffectContext = { type: 'on-retreat-trigger', sourcePlayer: playerId, effectName: name, sourceInstanceId, sourceToolInstanceId };
            controllers.effects.pushPendingEffect(effects, context);
        }
    }
}
