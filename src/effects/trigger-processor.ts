import { Controllers } from '../controllers/controllers.js';
import { EffectContextFactory } from './effect-context.js';

/**
 * These methods should only be called from the state machine and event handler
 */
export class TriggerProcessor {
    static processWhenDamaged(
        controllers: Controllers,
        playerId: number,
        creatureInstanceId: string,
        creatureCardId: string,
        damageAmount: number,
        attackerInstanceId?: string,
        attackerPlayerId?: number,
    ): void {
        const triggerData = { damage: damageAmount, attackerInstanceId, attackerPlayerId };

        // Process tool triggers
        const tool = controllers.tools.getAttachedTool(creatureInstanceId);
        
        if (tool) {
            const toolData = controllers.cardRepository.getTool(tool.templateId);
            
            if (toolData && toolData.effects && toolData.trigger?.type === 'damaged') {
                const context = EffectContextFactory.createTriggerContext(
                    playerId,
                    toolData.name,
                    'damaged',
                    creatureInstanceId,
                    triggerData,
                );

                // Push to queue instead of applying immediately
                controllers.effects.pushPendingEffect(toolData.effects, context);
            }
        }

        // Process ability triggers
        const creatureData = controllers.cardRepository.getCreature(creatureCardId);
        if (creatureData && creatureData.ability) {
            const ability = creatureData.ability;
            if (ability.trigger?.type === 'damaged' && ability.effects) {
                const context = EffectContextFactory.createTriggerContext(
                    playerId,
                    `${creatureData.name}'s ${ability.name}`,
                    'damaged',
                    creatureInstanceId,
                    triggerData,
                );
                
                // Push to queue instead of applying immediately
                controllers.effects.pushPendingEffect(ability.effects, context);
            }
        }
    }

    static processEnergyAttachment(
        controllers: Controllers,
        triggerTargetPlayerId: number,
        triggerTargetInstanceId: string,
        energyType: string,
    ): void {
        const triggerData = { energyType, triggerTargetInstanceId, triggerTargetPlayerId };

        // Fire triggers for ALL field cards on ALL players so that any creature/tool
        // watching for energy attachment (including on the opponent) receives the event.
        for (let playerId = 0; playerId < controllers.players.count; playerId++) {
            const fieldCards = controllers.field.getCards(playerId);
            for (let fieldIndex = 0; fieldIndex < fieldCards.length; fieldIndex++) {
                const card = fieldCards[fieldIndex];
                if (!card) {
                    continue;
                }

                // Process tool triggers
                const tool = controllers.tools.getAttachedTool(card.instanceId);
                if (tool) {
                    const toolData = controllers.cardRepository.getTool(tool.templateId);
                    if (toolData?.effects && toolData.trigger?.type === 'energy-attachment'
                        && (!toolData.trigger.energyType || toolData.trigger.energyType === energyType)) {
                        const toolContext = EffectContextFactory.createTriggerContext(
                            playerId,
                            toolData.name,
                            'energy-attachment',
                            card.instanceId,
                            triggerData,
                        );
                        controllers.effects.pushPendingEffect(toolData.effects, toolContext);
                    }
                }

                // Process ability triggers
                const cardData = controllers.cardRepository.getCreature(card.templateId);
                if (cardData?.ability?.trigger?.type === 'energy-attachment' && cardData.ability.effects) {
                    if (!cardData.ability.trigger.energyType || cardData.ability.trigger.energyType === energyType) {
                        const abilityContext = EffectContextFactory.createTriggerContext(
                            playerId,
                            `${cardData.name}'s ${cardData.ability.name}`,
                            'energy-attachment',
                            card.instanceId,
                            triggerData,
                        );
                        controllers.effects.pushPendingEffect(cardData.ability.effects, abilityContext);
                    }
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
        
        // Process tool triggers
        const tool = controllers.tools.getAttachedTool(creatureInstanceId);
        if (tool) {
            const toolData = controllers.cardRepository.getTool(tool.templateId);
            if (toolData && toolData.effects && toolData.trigger?.type === 'end-of-turn') {
                // Check ownTurnOnly restriction
                if (toolData.trigger.ownTurnOnly && playerId !== currentPlayer) {
                    return; // Skip if it's not the owner's turn
                }
                
                const context = EffectContextFactory.createTriggerContext(
                    playerId,
                    toolData.name,
                    'end-of-turn',
                    creatureInstanceId,
                );

                // Push to queue instead of applying immediately
                controllers.effects.pushPendingEffect(toolData.effects, context);
            }
        }
        
        // Process ability triggers
        const creatureData = controllers.cardRepository.getCreature(creatureCardId);
        if (creatureData && creatureData.ability) {
            const ability = creatureData.ability;
            if (ability.trigger?.type === 'end-of-turn' && ability.effects) {
                // Check ownTurnOnly restriction
                if (ability.trigger.ownTurnOnly && playerId !== currentPlayer) {
                    return; // Skip if it's not the owner's turn
                }
                
                // Check firstTurnOnly restriction
                if (ability.trigger.firstTurnOnly && controllers.turnCounter.getTurnNumber() !== 0) {
                    return; // Skip this ability if it's not the first turn (turn 0)
                }
                
                const context = EffectContextFactory.createTriggerContext(
                    playerId,
                    `${creatureData.name}'s ${ability.name}`,
                    'end-of-turn',
                    creatureInstanceId,
                );
                
                // Push to queue instead of applying immediately
                controllers.effects.pushPendingEffect(ability.effects, context);
            }
        }
    }

    static processStartOfTurn(
        controllers: Controllers,
        playerId: number,
        creatureInstanceId: string,
        creatureCardId: string,
    ): void {
        const currentPlayer = controllers.turn.get();
        
        // Process tool triggers
        const tool = controllers.tools.getAttachedTool(creatureInstanceId);
        if (tool) {
            const toolData = controllers.cardRepository.getTool(tool.templateId);
            if (toolData && toolData.effects && toolData.trigger?.type === 'start-of-turn') {
                // Check ownTurnOnly restriction
                if (toolData.trigger.ownTurnOnly && playerId !== currentPlayer) {
                    return; // Skip if it's not the owner's turn
                }
                
                const context = EffectContextFactory.createTriggerContext(
                    playerId,
                    toolData.name,
                    'start-of-turn',
                    creatureInstanceId,
                );

                controllers.effects.pushPendingEffect(toolData.effects, context);
            }
        }
        
        // Process ability triggers
        const creatureData = controllers.cardRepository.getCreature(creatureCardId);
        if (creatureData && creatureData.ability) {
            const ability = creatureData.ability;
            if (ability.trigger?.type === 'start-of-turn' && ability.effects) {
                // Check ownTurnOnly restriction
                if (ability.trigger.ownTurnOnly && playerId !== currentPlayer) {
                    return; // Skip if it's not the owner's turn
                }
                
                const context = EffectContextFactory.createTriggerContext(
                    playerId,
                    `${creatureData.name}'s ${ability.name}`,
                    'start-of-turn',
                    creatureInstanceId,
                );
                
                controllers.effects.pushPendingEffect(ability.effects, context);
            }
        }
    }

    static processOnPlay(
        controllers: Controllers,
        playerId: number,
        creatureInstanceId: string,
        creatureCardId: string,
        isEvolution: boolean,
    ): void {
        // Process tool triggers
        const tool = controllers.tools.getAttachedTool(creatureInstanceId);
        if (tool) {
            const toolData = controllers.cardRepository.getTool(tool.templateId);
            if (toolData && toolData.effects && toolData.trigger?.type === 'on-play') {
                // Check filterEvolution - if true, only trigger on non-evolution plays
                if (toolData.trigger.filterEvolution && isEvolution) {
                    return; // Skip if this is an evolution and filter is enabled
                }
                
                const context = EffectContextFactory.createTriggerContext(
                    playerId,
                    toolData.name,
                    'on-play',
                    creatureInstanceId,
                );

                controllers.effects.pushPendingEffect(toolData.effects, context);
            }
        }
        
        // Process ability triggers
        const creatureData = controllers.cardRepository.getCreature(creatureCardId);
        if (creatureData && creatureData.ability) {
            const ability = creatureData.ability;
            if (ability.trigger?.type === 'on-play' && ability.effects) {
                // Check filterEvolution - if true, only trigger on non-evolution plays
                if (ability.trigger.filterEvolution && isEvolution) {
                    return; // Skip if this is an evolution and filter is enabled
                }
                
                const context = EffectContextFactory.createTriggerContext(
                    playerId,
                    `${creatureData.name}'s ${ability.name}`,
                    'on-play',
                    creatureInstanceId,
                );
                
                controllers.effects.pushPendingEffect(ability.effects, context);
            }
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
        const triggerData = { defenderInstanceId, defenderPlayerId };

        // Process tool triggers
        const tool = controllers.tools.getAttachedTool(creatureInstanceId);
        if (tool) {
            const toolData = controllers.cardRepository.getTool(tool.templateId);
            if (toolData && toolData.effects && toolData.trigger?.type === 'on-attack') {
                const context = EffectContextFactory.createTriggerContext(
                    playerId,
                    toolData.name,
                    'on-attack',
                    creatureInstanceId,
                    triggerData,
                );
                controllers.effects.pushPendingEffect(toolData.effects, context);
            }
        }

        // Process ability triggers
        const creatureData = controllers.cardRepository.getCreature(creatureCardId);
        if (creatureData && creatureData.ability) {
            const ability = creatureData.ability;
            if (ability.trigger?.type === 'on-attack' && ability.effects) {
                const context = EffectContextFactory.createTriggerContext(
                    playerId,
                    `${creatureData.name}'s ${ability.name}`,
                    'on-attack',
                    creatureInstanceId,
                    triggerData,
                );
                controllers.effects.pushPendingEffect(ability.effects, context);
            }
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
        const triggerData = { attackerInstanceId, attackerPlayerId };

        // Process tool triggers
        const tool = controllers.tools.getAttachedTool(creatureInstanceId);
        if (tool) {
            const toolData = controllers.cardRepository.getTool(tool.templateId);
            if (toolData && toolData.effects && toolData.trigger?.type === 'before-knockout') {
                const context = EffectContextFactory.createTriggerContext(
                    playerId,
                    toolData.name,
                    'before-knockout',
                    creatureInstanceId,
                    triggerData,
                );

                controllers.effects.pushPendingEffect(toolData.effects, context);
            }
        }
        
        // Process ability triggers
        const creatureData = controllers.cardRepository.getCreature(creatureCardId);
        if (creatureData && creatureData.ability) {
            const ability = creatureData.ability;
            if (ability.trigger?.type === 'before-knockout' && ability.effects) {
                const context = EffectContextFactory.createTriggerContext(
                    playerId,
                    `${creatureData.name}'s ${ability.name}`,
                    'before-knockout',
                    creatureInstanceId,
                    triggerData,
                );
                
                controllers.effects.pushPendingEffect(ability.effects, context);
            }
        }
    }

    static processOnCheckup(
        controllers: Controllers,
        playerId: number,
        creatureInstanceId: string,
        creatureCardId: string,
    ): void {
        const currentPlayer = controllers.turn.get();
        
        // Process tool triggers
        const tool = controllers.tools.getAttachedTool(creatureInstanceId);
        if (tool) {
            const toolData = controllers.cardRepository.getTool(tool.templateId);
            if (toolData && toolData.effects && toolData.trigger?.type === 'on-checkup') {
                // Check ownTurnOnly restriction
                if (toolData.trigger.ownTurnOnly && playerId !== currentPlayer) {
                    return; // Skip if it's not the owner's turn
                }
                
                const context = EffectContextFactory.createTriggerContext(
                    playerId,
                    toolData.name,
                    'on-checkup',
                    creatureInstanceId,
                );

                controllers.effects.pushPendingEffect(toolData.effects, context);
            }
        }
        
        // Process ability triggers
        const creatureData = controllers.cardRepository.getCreature(creatureCardId);
        if (creatureData && creatureData.ability) {
            const ability = creatureData.ability;
            if (ability.trigger?.type === 'on-checkup' && ability.effects) {
                // Check ownTurnOnly restriction
                if (ability.trigger.ownTurnOnly && playerId !== currentPlayer) {
                    return; // Skip if it's not the owner's turn
                }
                
                const context = EffectContextFactory.createTriggerContext(
                    playerId,
                    `${creatureData.name}'s ${ability.name}`,
                    'on-checkup',
                    creatureInstanceId,
                );
                
                controllers.effects.pushPendingEffect(ability.effects, context);
            }
        }
    }

    static processOnRetreat(
        controllers: Controllers,
        playerId: number,
        creatureInstanceId: string,
        creatureCardId: string,
    ): void {
        // Process tool triggers
        const tool = controllers.tools.getAttachedTool(creatureInstanceId);
        if (tool) {
            const toolData = controllers.cardRepository.getTool(tool.templateId);
            if (toolData && toolData.effects && toolData.trigger?.type === 'on-retreat') {
                const context = EffectContextFactory.createTriggerContext(
                    playerId,
                    toolData.name,
                    'on-retreat',
                    creatureInstanceId,
                );

                controllers.effects.pushPendingEffect(toolData.effects, context);
            }
        }
        
        // Process ability triggers
        const creatureData = controllers.cardRepository.getCreature(creatureCardId);
        if (creatureData && creatureData.ability) {
            const ability = creatureData.ability;
            if (ability.trigger?.type === 'on-retreat' && ability.effects) {
                const context = EffectContextFactory.createTriggerContext(
                    playerId,
                    `${creatureData.name}'s ${ability.name}`,
                    'on-retreat',
                    creatureInstanceId,
                );
                
                controllers.effects.pushPendingEffect(ability.effects, context);
            }
        }
    }
}
