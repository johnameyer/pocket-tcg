import { Controllers } from '../../controllers/controllers.js';
import { ToolDiscardEffect } from '../../repository/effect-types.js';
import { EffectContext } from '../effect-context.js';
import { AbstractEffectHandler, ResolutionRequirement } from '../interfaces/effect-handler-interface.js';
import { getCreatureFromTarget } from '../effect-utils.js';
import { getFieldInstanceId } from '../../utils/field-card-utils.js';
import { CardRepository } from '../../repository/card-repository.js';
import { HandlerData } from '../../game-handler.js';
import { FieldTargetResolver } from '../target-resolvers/field-target-resolver.js';
import { FieldCard } from '../../controllers/field-controller.js';

/**
 * Handler for tool discard effects that remove tools from creatures.
 */
export class ToolDiscardEffectHandler extends AbstractEffectHandler<ToolDiscardEffect> {
    /**
     * Get the resolution requirements for a tool discard effect.
     * Tool discard effects require a target to be resolved.
     * 
     * @param effect The tool discard effect to get resolution requirements for
     * @returns Array of resolution requirements
     */
    getResolutionRequirements(effect: ToolDiscardEffect): ResolutionRequirement[] {
        return [
            { targetProperty: 'target', target: effect.target, required: true },
        ];
    }
    
    /**
     * Validate if tool discard effect can be applied.
     * Effect should only be playable if there are tools that can be discarded.
     * 
     * @param handlerData Handler data view
     * @param effect The tool discard effect to validate
     * @param context Effect context
     * @returns True if the effect can be applied, false otherwise
     */
    canApply(handlerData: HandlerData, effect: ToolDiscardEffect, context: EffectContext, cardRepository: CardRepository): boolean {
        // If there's no target, we can't apply the effect
        if (!effect.target) {
            return false;
        }
        
        // Check if there are any creatures with tools attached
        const hasToolAttached = (creature: FieldCard, handlerData: HandlerData): boolean => {
            const fieldInstanceId = getFieldInstanceId(creature);
            return handlerData.tools?.attachedTools[fieldInstanceId] !== undefined;
        };
        
        // Use TargetResolver with validation function to check if any valid targets exist
        return FieldTargetResolver.isTargetAvailable(effect.target, handlerData, context, cardRepository, hasToolAttached);
    }

    /**
     * Apply a fully resolved tool discard effect.
     * This is called after all targets have been resolved.
     * 
     * @param controllers Game controllers
     * @param effect The tool discard effect to apply (with resolved targets)
     * @param context Effect context
     */
    apply(controllers: Controllers, effect: ToolDiscardEffect, context: EffectContext): void {
        if (effect.target.type !== 'resolved') {
            throw new Error(`Expected resolved target, got ${effect.target?.type || effect.target}`);
        }
        
        // Get resolved targets directly
        const targets = effect.target.targets;
        
        if (targets.length === 0) {
            throw new Error(`${context.effectName} resolved to no valid targets`);
        }
        
        // Process each target
        for (const targetInfo of targets) {
            const playerId = targetInfo.playerId;
            const fieldIndex = targetInfo.fieldIndex;
            
            // Get the target creature
            const targetCreature = getCreatureFromTarget(controllers, playerId, fieldIndex);
            if (!targetCreature) {
                continue;
            }
            
            // Get field instance ID for the creature
            const fieldInstanceId = getFieldInstanceId(targetCreature);
            
            // Check if creature has a tool attached
            const attachedTool = controllers.tools.getAttachedTool(fieldInstanceId);
            if (!attachedTool) {
                // No tool to discard, skip this creature
                continue;
            }
            
            // Get the creature and tool data for messaging
            const creatureData = controllers.cardRepository.getCreature(targetCreature.templateId);
            const toolData = controllers.cardRepository.getTool(attachedTool.templateId);
            
            // Discard the tool
            controllers.tools.detachTool(fieldInstanceId);
            controllers.discard.discardCard(playerId, { 
                templateId: attachedTool.templateId, 
                instanceId: attachedTool.instanceId, 
                type: 'tool',
            });
            
            // Message players
            controllers.players.messageAll({
                type: 'status',
                components: [ `${context.effectName} discards ${toolData.name} from ${creatureData.name}!` ],
            });
        }
    }
}

export const toolDiscardEffectHandler = new ToolDiscardEffectHandler();
