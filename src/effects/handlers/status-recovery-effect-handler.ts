import { Controllers } from '../../controllers/controllers.js';
import { StatusRecoveryEffect } from '../../repository/effect-types.js';
import { EffectContext } from '../effect-context.js';
import { AbstractEffectHandler, ResolutionRequirement } from '../interfaces/effect-handler-interface.js';
import { getCreatureFromTarget } from '../effect-utils.js';
import { CardRepository } from '../../repository/card-repository.js';
import { HandlerData } from '../../game-handler.js';
import { FieldTargetResolver } from '../target-resolvers/field-target-resolver.js';

/**
 * Handler for status recovery effects that remove status conditions from creatures.
 */
export class StatusRecoveryEffectHandler extends AbstractEffectHandler<StatusRecoveryEffect> {
    /**
     * Get the resolution requirements for a status recovery effect.
     * Status recovery effects require a target to be resolved.
     * 
     * @param effect The status recovery effect to get resolution requirements for
     * @returns Array of resolution requirements
     */
    getResolutionRequirements(effect: StatusRecoveryEffect): ResolutionRequirement[] {
        return [
            { targetProperty: 'target', target: effect.target, required: true },
        ];
    }
    
    /**
     * Optional validation method to check if a status recovery effect can be applied.
     * 
     * @param handlerData Handler data view
     * @param effect The status recovery effect to validate
     * @param context Effect context
     * @returns True if the effect can be applied, false otherwise
     */
    canApply(handlerData: HandlerData, effect: StatusRecoveryEffect, context: EffectContext, cardRepository: CardRepository): boolean {
        // If there's no target, we can't apply the effect
        if (!effect.target) {
            return false;
        }
        
        // Use TargetResolver to check if the target is available
        return FieldTargetResolver.isTargetAvailable(effect.target, handlerData, context, cardRepository);
    }

    /**
     * Apply a fully resolved status recovery effect.
     * This is called after all targets have been resolved.
     * 
     * @param controllers Game controllers
     * @param effect The status recovery effect to apply (with resolved targets)
     * @param context Effect context
     */
    apply(controllers: Controllers, effect: StatusRecoveryEffect, context: EffectContext): void {
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
            
            // For status effects, we only care about active creature (index 0)
            if (fieldIndex !== 0) {
                continue;
            }
            
            // Get the target creature for name display
            const targetCreature = getCreatureFromTarget(controllers, playerId, fieldIndex);
            if (!targetCreature) {
                continue;
            }
            
            // Get the creature data
            const creatureData = controllers.cardRepository.getCreature(targetCreature.templateId);
            const creatureName = creatureData.name;
            
            // If specific conditions specified, remove only those
            if (effect.conditions && effect.conditions.length > 0) {
                // Get current effects
                const currentEffects = controllers.statusEffects.getActiveStatusEffects(playerId);
                
                // Filter out the effects to remove by checking the string representation
                const filteredEffects = currentEffects.filter(e => {
                    const typeStr = String(e.type);
                    return !effect.conditions!.some(c => c === typeStr);
                });
                
                // Clear all and re-apply filtered effects
                controllers.statusEffects.clearAllStatusEffects(playerId);
                for (const eff of filteredEffects) {
                    controllers.statusEffects.applyStatusEffect(playerId, eff.type);
                }
                
                const conditionNames = effect.conditions.join(' and ');
                controllers.players.messageAll({
                    type: 'status',
                    components: [ `${context.effectName} cures ${conditionNames} from ${creatureName}!` ],
                });
            } else {
                // Remove all status conditions
                controllers.statusEffects.clearAllStatusEffects(playerId);
                
                controllers.players.messageAll({
                    type: 'status',
                    components: [ `${context.effectName} cures all status conditions from ${creatureName}!` ],
                });
            }
        }
    }
}

export const statusRecoveryEffectHandler = new StatusRecoveryEffectHandler();
