import { Controllers } from '../controllers/controllers.js';
import { Effect } from '../repository/effect-types.js';
import { Trigger } from '../repository/card-types.js';
import { EffectContextFactory } from './effect-context.js';

type MatchingEffect<T extends Trigger['type']> = {
    effects: Effect[];
    name: string;
    trigger: Extract<Trigger, { type: T }>;
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
                });
            }
        }

        const creatureData = controllers.cardRepository.getCreature(creatureCardId);
        if (creatureData?.ability?.effects?.length && creatureData.ability.trigger?.type === triggerType) {
            matches.push({
                trigger: creatureData.ability.trigger as Extract<Trigger, { type: T }>,
                effects: creatureData.ability.effects,
                name: `${creatureData.name}'s ${creatureData.ability.name}`,
            });
        }

        return matches;
    }

    /**
     * Returns game-level sources (stadium) whose trigger type matches.
     * Consistent with getMatchingEffects — caller builds context via createCardPlayedContext.
     */
    private static getMatchingGameEffects<T extends Trigger['type']>(
        controllers: Controllers,
        currentPlayer: number,
        triggerType: T,
    ): { effects: Effect[]; context: ReturnType<typeof EffectContextFactory.createCardPlayedContext> }[] {
        const activeStadium = controllers.stadium.getActiveStadium();
        if (!activeStadium) {
            return [];
        }
        const stadiumData = controllers.cardRepository.getStadium(activeStadium.templateId);
        if (!stadiumData?.effects?.length || stadiumData.trigger?.type !== triggerType) {
            return [];
        }
        const context = EffectContextFactory.createCardPlayedContext(currentPlayer, stadiumData.name, 'stadium');
        context.sourceInstanceId = activeStadium.instanceId;
        return [{ effects: stadiumData.effects, context }];
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
        for (const { effects, name } of this.getMatchingEffects(controllers, creatureInstanceId, creatureCardId, 'damaged')) {
            controllers.effects.pushPendingEffect(effects, EffectContextFactory.createTriggerContext(
                playerId, name, creatureInstanceId,
                { triggerType: 'damaged', damage: damageAmount, attackerInstanceId, attackerPlayerId },
            ));
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
                for (const { effects, name, trigger } of this.getMatchingEffects(controllers, card.instanceId, card.templateId, 'energy-attachment')) {
                    if (trigger.energyType && trigger.energyType !== energyType) {
                        continue;
                    }
                    controllers.effects.pushPendingEffect(effects, EffectContextFactory.createTriggerContext(
                        playerId, name, card.instanceId,
                        { triggerType: 'energy-attachment', energyType, triggerTargetInstanceId, triggerTargetPlayerId },
                    ));
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
        for (const { effects, name, trigger } of this.getMatchingEffects(controllers, creatureInstanceId, creatureCardId, 'end-of-turn')) {
            if (trigger.ownTurnOnly && playerId !== currentPlayer) {
                continue;
            }
            if (trigger.firstTurnOnly && controllers.turnCounter.getTurnNumber() !== 0) {
                continue;
            }
            controllers.effects.pushPendingEffect(effects, EffectContextFactory.createTriggerContext(
                playerId, name, creatureInstanceId, { triggerType: 'end-of-turn' },
            ));
        }
        for (const { effects, context } of this.getMatchingGameEffects(controllers, currentPlayer, 'end-of-turn')) {
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
        for (const { effects, name, trigger } of this.getMatchingEffects(controllers, creatureInstanceId, creatureCardId, 'start-of-turn')) {
            if (trigger.ownTurnOnly && playerId !== currentPlayer) {
                continue;
            }
            controllers.effects.pushPendingEffect(effects, EffectContextFactory.createTriggerContext(
                playerId, name, creatureInstanceId, { triggerType: 'start-of-turn' },
            ));
        }
        for (const { effects, context } of this.getMatchingGameEffects(controllers, currentPlayer, 'start-of-turn')) {
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
        for (const { effects, name, trigger } of this.getMatchingEffects(controllers, creatureInstanceId, creatureCardId, 'on-play')) {
            if (trigger.filterEvolution && isEvolution) {
                continue;
            }
            controllers.effects.pushPendingEffect(effects, EffectContextFactory.createTriggerContext(
                playerId, name, creatureInstanceId, { triggerType: 'on-play' },
            ));
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
        for (const { effects, name } of this.getMatchingEffects(controllers, creatureInstanceId, creatureCardId, 'on-attack')) {
            controllers.effects.pushPendingEffect(effects, EffectContextFactory.createTriggerContext(
                playerId, name, creatureInstanceId,
                { triggerType: 'on-attack', defenderInstanceId, defenderPlayerId },
            ));
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
        for (const { effects, name } of this.getMatchingEffects(controllers, creatureInstanceId, creatureCardId, 'before-knockout')) {
            controllers.effects.pushPendingEffect(effects, EffectContextFactory.createTriggerContext(
                playerId, name, creatureInstanceId,
                { triggerType: 'before-knockout', attackerInstanceId, attackerPlayerId },
            ));
        }
    }

    static processOnCheckup(
        controllers: Controllers,
        playerId: number,
        creatureInstanceId: string,
        creatureCardId: string,
    ): void {
        const currentPlayer = controllers.turn.get();
        for (const { effects, name, trigger } of this.getMatchingEffects(controllers, creatureInstanceId, creatureCardId, 'on-checkup')) {
            if (trigger.ownTurnOnly && playerId !== currentPlayer) {
                continue;
            }
            controllers.effects.pushPendingEffect(effects, EffectContextFactory.createTriggerContext(
                playerId, name, creatureInstanceId, { triggerType: 'on-checkup' },
            ));
        }
        for (const { effects, context } of this.getMatchingGameEffects(controllers, currentPlayer, 'on-checkup')) {
            controllers.effects.pushPendingEffect(effects, context);
        }
    }

    static processOnRetreat(
        controllers: Controllers,
        playerId: number,
        creatureInstanceId: string,
        creatureCardId: string,
    ): void {
        for (const { effects, name } of this.getMatchingEffects(controllers, creatureInstanceId, creatureCardId, 'on-retreat')) {
            controllers.effects.pushPendingEffect(effects, EffectContextFactory.createTriggerContext(
                playerId, name, creatureInstanceId, { triggerType: 'on-retreat' },
            ));
        }
    }
}
