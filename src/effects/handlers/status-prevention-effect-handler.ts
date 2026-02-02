import { Controllers } from '../../controllers/controllers.js';
import { StatusPreventionEffect } from '../../repository/effect-types.js';
import { EffectContext } from '../effect-context.js';
import { AbstractEffectHandler, ResolutionRequirement } from '../interfaces/effect-handler-interface.js';
import { TargetResolver } from '../target-resolver.js';

/**
 * Handler for status prevention effects that prevent special conditions.
 * Note: This is a placeholder implementation. Full prevention would require
 * adding a prevention tracking system to the status effect controller.
 */
export class StatusPreventionEffectHandler extends AbstractEffectHandler<StatusPreventionEffect> {
    /**
     * Get resolution requirements for status prevention effect.
     * 
     * @param effect The status prevention effect
     * @returns Resolution requirements
     */
    getResolutionRequirements(effect: StatusPreventionEffect): ResolutionRequirement[] {
        if (TargetResolver.requiresTargetSelection(effect.target, {} as EffectContext)) {
            return [{ targetProperty: 'target', target: effect.target, required: true }];
        }
        return [];
    }
    
    /**
     * Apply a status prevention effect.
     * This prevents special conditions from being applied to targets.
     * 
     * Note: This is a basic implementation that logs a message.
     * Full implementation would require tracking prevention in the status effect controller.
     * 
     * @param controllers Game controllers
     * @param effect The status prevention effect to apply
     * @param context Effect context
     */
    apply(controllers: Controllers, effect: StatusPreventionEffect, context: EffectContext): void {
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
        
        // Apply prevention to each target
        // TODO: Implement actual prevention tracking in status effect controller
        // For now, just send a message indicating prevention is active
        for (const { playerId, fieldIndex } of targets) {
            const fieldCard = controllers.field.getCardByPosition(playerId, fieldIndex);
            if (fieldCard) {
                const conditionsText = effect.conditions 
                    ? effect.conditions.join(', ')
                    : 'all special conditions';
                    
                controllers.players.messageAll({
                    type: 'status',
                    components: [ `${context.effectName} protects ${fieldCard.data.name} from ${conditionsText}!` ],
                });
            }
        }
    }
}

export const statusPreventionEffectHandler = new StatusPreventionEffectHandler();
