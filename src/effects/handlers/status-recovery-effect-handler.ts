import { Controllers } from '../../controllers/controllers.js';
import { StatusRecoveryEffect } from '../../repository/effect-types.js';
import { EffectContext } from '../effect-context.js';
import { AbstractEffectHandler, ResolutionRequirement } from '../interfaces/effect-handler-interface.js';
import { TargetResolver } from '../target-resolver.js';

/**
 * Handler for status recovery effects that remove special conditions.
 */
export class StatusRecoveryEffectHandler extends AbstractEffectHandler<StatusRecoveryEffect> {
    /**
     * Get resolution requirements for status recovery effect.
     * 
     * @param effect The status recovery effect
     * @returns Resolution requirements
     */
    getResolutionRequirements(effect: StatusRecoveryEffect): ResolutionRequirement[] {
        if (TargetResolver.requiresTargetSelection(effect.target, {} as EffectContext)) {
            return [{ targetProperty: 'target', target: effect.target, required: true }];
        }
        return [];
    }
    
    /**
     * Apply a status recovery effect.
     * This removes special conditions from targets.
     * 
     * @param controllers Game controllers
     * @param effect The status recovery effect to apply
     * @param context Effect context
     */
    apply(controllers: Controllers, effect: StatusRecoveryEffect, context: EffectContext): void {
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
        
        // Remove conditions from each target
        for (const { playerId, fieldIndex } of targets) {
            // Status effects only apply to active cards (fieldIndex 0)
            if (fieldIndex !== 0) {
                continue;
            }
            
            const conditionsToRemove = effect.conditions || [ 'sleep', 'burn', 'confusion', 'paralysis', 'poison' ];
            
            let removed = false;
            for (const condition of conditionsToRemove) {
                if (controllers.statusEffects.hasStatusEffect(playerId, condition as any)) {
                    controllers.statusEffects.removeStatusEffect(playerId, condition as any);
                    removed = true;
                }
            }
            
            if (removed) {
                const fieldCard = controllers.field.getCardByPosition(playerId, fieldIndex);
                if (fieldCard) {
                    const cardData = controllers.cardRepository.getCreature(fieldCard.templateId);
                    controllers.players.messageAll({
                        type: 'status',
                        components: [ `${context.effectName} heals ${cardData.name}'s special conditions!` ],
                    });
                }
            }
        }
    }
}

export const statusRecoveryEffectHandler = new StatusRecoveryEffectHandler();
