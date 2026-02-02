import { Controllers } from '../../controllers/controllers.js';
import { ToolDiscardEffect } from '../../repository/effect-types.js';
import { EffectContext } from '../effect-context.js';
import { AbstractEffectHandler, ResolutionRequirement } from '../interfaces/effect-handler-interface.js';
import { TargetResolver } from '../target-resolver.js';

/**
 * Handler for tool discard effects that remove tools from targeted field cards.
 */
export class ToolDiscardEffectHandler extends AbstractEffectHandler<ToolDiscardEffect> {
    /**
     * Get resolution requirements for tool discard effect.
     * 
     * @param effect The tool discard effect
     * @returns Resolution requirements
     */
    getResolutionRequirements(effect: ToolDiscardEffect): ResolutionRequirement[] {
        if (TargetResolver.requiresTargetSelection(effect.target, {} as EffectContext)) {
            return [{ targetProperty: 'target', target: effect.target, required: true }];
        }
        return [];
    }
    
    /**
     * Apply a tool discard effect.
     * This discards tools attached to the targeted field cards.
     * 
     * @param controllers Game controllers
     * @param effect The tool discard effect to apply
     * @param context Effect context
     */
    apply(controllers: Controllers, effect: ToolDiscardEffect, context: EffectContext): void {
        // Resolve the target
        const resolution = TargetResolver.resolveTarget(effect.target, controllers, context);
        
        if (resolution.type === 'no-valid-targets') {
            controllers.players.messageAll({
                type: 'status',
                components: [ `${context.effectName} has no valid targets!` ],
            });
            return;
        }
        
        if (resolution.type === 'requires-selection') {
            // Target selection is handled by the effect applier
            return;
        }
        
        // Get targets to process
        let targets: Array<{ playerId: number; fieldIndex: number }> = [];
        if (resolution.type === 'resolved' || resolution.type === 'auto-resolved') {
            targets = resolution.type === 'resolved' ? resolution.targets : [{ playerId: resolution.playerId, fieldIndex: resolution.fieldIndex }];
        } else if (resolution.type === 'all-matching') {
            targets = resolution.targets;
        }
        
        // Discard tools from each target
        for (const { playerId, fieldIndex } of targets) {
            const fieldCard = controllers.field.getCardByPosition(playerId, fieldIndex);
            if (!fieldCard) {
                continue;
            }
            
            const tool = controllers.tools.getAttachedTool(fieldCard.instanceId);
            if (tool) {
                // Detach and discard the tool
                controllers.tools.detachTool(fieldCard.instanceId);
                controllers.discard.discardCard(playerId, {
                    instanceId: tool.instanceId,
                    templateId: tool.templateId,
                    type: 'tool',
                });
                
                const toolData = controllers.cardRepository.getTool(tool.templateId);
                controllers.players.messageAll({
                    type: 'status',
                    components: [ `${context.effectName} discards ${toolData.name}!` ],
                });
            }
        }
    }
}

export const toolDiscardEffectHandler = new ToolDiscardEffectHandler();
