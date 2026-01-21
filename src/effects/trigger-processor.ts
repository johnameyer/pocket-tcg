import { Controllers } from '../controllers/controllers.js';
import { CardRepository } from '../repository/card-repository.js';
import { EffectApplier } from './effect-applier.js';
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
        damageAmount: number
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
                    creatureInstanceId
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
                    creatureInstanceId
                );
                
                // Push to queue instead of applying immediately
                controllers.effects.pushPendingEffect(ability.effects, context);
            }
        }
    }

    static processEndOfTurn(
        controllers: Controllers,
        playerId: number,
        creatureInstanceId: string,
        creatureCardId: string
    ): void {
        // Process tool triggers
        const tool = controllers.tools.getAttachedTool(creatureInstanceId);
        if (tool) {
            const toolData = controllers.cardRepository.getTool(tool.templateId);
            if (toolData && toolData.effects && toolData.trigger?.type === 'end-of-turn') {
                const currentPlayer = controllers.turn.get();
                
                const context = EffectContextFactory.createTriggerContext(
                    playerId,
                    toolData.name,
                    'end-of-turn',
                    creatureInstanceId
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
                
                // Check firstTurnOnly restriction
                if (ability.trigger.firstTurnOnly && controllers.turnCounter.getTurnNumber() !== 0) {
                    return; // Skip this ability if it's not the first turn (turn 0)
                }
                
                const context = EffectContextFactory.createTriggerContext(
                    playerId,
                    `${creatureData.name}'s ${ability.name}`,
                    'end-of-turn',
                    creatureInstanceId
                );
                
                // Push to queue instead of applying immediately
                controllers.effects.pushPendingEffect(ability.effects, context);
            }
        }
    }
}
