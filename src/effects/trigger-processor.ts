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
    ): void {
        // Process tool triggers
        const tool = controllers.tools.getAttachedTool(creatureInstanceId);
        
        if (tool) {
            const toolData = controllers.cardRepository.getTool(tool.templateId);
            
            if (toolData && toolData.effects && toolData.trigger?.type === 'damaged') {
                const fieldCards = controllers.field.getCards(playerId);
                const creaturePosition = fieldCards.findIndex(card => card?.instanceId === creatureInstanceId);
                
                const context = EffectContextFactory.createTriggerContext(
                    playerId,
                    toolData.name,
                    'damaged',
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
            if (ability.trigger?.type === 'damaged' && ability.effects) {
                const context = EffectContextFactory.createTriggerContext(
                    playerId,
                    `${creatureData.name}'s ${ability.name}`,
                    'damaged',
                    creatureInstanceId,
                );
                
                // Push to queue instead of applying immediately
                controllers.effects.pushPendingEffect(ability.effects, context);
            }
        }
    }

    static processEnergyAttachment(
        controllers: Controllers,
        playerId: number,
        creatureInstanceId: string,
        creatureCardId: string,
        energyType: string,
    ): void {
        // Get the creature data
        const creatureData = controllers.cardRepository.getCreature(creatureCardId);
        
        // Process tool triggers
        const tool = controllers.tools.getAttachedTool(creatureInstanceId);
        if (tool) {
            const toolData = controllers.cardRepository.getTool(tool.templateId);
            if (toolData && toolData.effects && toolData.trigger?.type === 'energy-attachment') {
                // Check if the trigger is for a specific energy type
                if (!toolData.trigger.energyType || toolData.trigger.energyType === energyType) {
                    const toolContext = EffectContextFactory.createTriggerContext(
                        playerId,
                        toolData.name,
                        'energy-attachment',
                        creatureInstanceId,
                        { energyType },
                    );
                    controllers.effects.pushPendingEffect(toolData.effects, toolContext);
                }
            }
        }
        
        // Process ability triggers
        if (creatureData.ability) {
            const ability = creatureData.ability;
            if (ability.trigger?.type === 'energy-attachment' && ability.effects) {
                // Check if the trigger is for a specific energy type
                if (!ability.trigger.energyType || ability.trigger.energyType === energyType) {
                    const abilityContext = EffectContextFactory.createTriggerContext(
                        playerId,
                        `${creatureData.name}'s ${ability.name}`,
                        'energy-attachment',
                        creatureInstanceId,
                        { energyType },
                    );
                    controllers.effects.pushPendingEffect(ability.effects, abilityContext);
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

    static processBeforeKnockout(
        controllers: Controllers,
        playerId: number,
        creatureInstanceId: string,
        creatureCardId: string,
    ): void {
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
