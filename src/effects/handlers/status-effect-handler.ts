import { Controllers } from '../../controllers/controllers.js';
import { StatusEffectType } from '../../controllers/status-effect-controller.js';
import { StatusEffect } from '../../repository/effect-types.js';
import { EffectContext } from '../effect-context.js';
import { AbstractEffectHandler, ResolutionRequirement } from '../interfaces/effect-handler-interface.js';
import { getCreatureFromTarget } from '../effect-utils.js';
import { CardRepository } from '../../repository/card-repository.js';
import { HandlerData } from '../../game-handler.js';
import { TargetResolver } from '../target-resolver.js';

/**
 * Handler for status effects that apply conditions like poison, burn, etc. to creature.
 */
export class StatusEffectHandler extends AbstractEffectHandler<StatusEffect> {
    /**
     * Get the resolution requirements for a status effect.
     * Status effects require a target to be resolved.
     * 
     * @param effect The status effect to get resolution requirements for
     * @returns Array of resolution requirements
     */
    getResolutionRequirements(effect: StatusEffect): ResolutionRequirement[] {
        return [
            { targetProperty: 'target', target: effect.target, required: true },
        ];
    }
    
    /**
     * Optional validation method to check if a status effect can be applied.
     * 
     * @param handlerData Handler data view
     * @param effect The status effect to validate
     * @param context Effect context
     * @returns True if the effect can be applied, false otherwise
     */
    canApply(handlerData: HandlerData, effect: StatusEffect, context: EffectContext, cardRepository: CardRepository): boolean {
        // If there's no target, we can't apply the effect
        if (!effect.target) {
            return false;
        }
        
        // Use TargetResolver to check if the target is available
        return TargetResolver.isTargetAvailable(effect.target, handlerData, context, cardRepository);
    }

    /**
     * Apply a fully resolved status effect.
     * This is called after all targets have been resolved.
     * 
     * @param controllers Game controllers
     * @param effect The status effect to apply (with resolved targets)
     * @param context Effect context
     */
    apply(controllers: Controllers, effect: StatusEffect, context: EffectContext): void {
        if (effect.target.type !== 'resolved') {
            throw new Error(`Expected resolved target, got ${effect.target?.type || effect.target}`);
        }
        
        // Get resolved targets directly
        const targets = effect.target.targets;
        
        if (targets.length === 0) {
            return;
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
            
            // Get the creature data - will throw an error if not found
            const creatureData = controllers.cardRepository.getCreature(targetCreature.templateId);
            const creatureName = creatureData.name;
            
            // Apply the appropriate status effect
            this.applyStatusToTarget(controllers, effect, context, playerId, creatureName);
        }
    }
    
    // TODO: Duped comment?
    /**
     * Helper function to apply status effect to a target
     * 
     * @param controllers Game controllers
     * @param effect The status effect to apply
     * @param context Effect context
     * @param targetPlayerId The player ID of the target
     * @param creatureName Name of the creature for messaging
     */
    /**
     * Helper function to apply status effect to a target
     * Uses a switch statement for better readability and maintainability
     * 
     * @param controllers Game controllers
     * @param effect The status effect to apply
     * @param context Effect context
     * @param targetPlayerId The player ID of the target
     * @param creatureName Name of the creature for messaging
     */
    private applyStatusToTarget(
        controllers: Controllers,
        effect: StatusEffect,
        context: EffectContext,
        targetPlayerId: number,
        creatureName: string,
    ): void {
        // TODO can we just have the message generation as a map and then send it generically / DRY controllers.players.messageAll?
        switch (effect.condition) {
            case 'poison':
                controllers.statusEffects.applyStatusEffect(targetPlayerId, StatusEffectType.POISONED);
                controllers.players.messageAll({
                    type: 'status',
                    components: [ `${context.effectName} inflicts poison on ${creatureName}!` ],
                });
                break;
                
            case 'burn':
                controllers.statusEffects.applyStatusEffect(targetPlayerId, StatusEffectType.BURNED);
                controllers.players.messageAll({
                    type: 'status',
                    components: [ `${context.effectName} inflicts burn on ${creatureName}!` ],
                });
                break;
                
            case 'paralysis':
                controllers.statusEffects.applyStatusEffect(targetPlayerId, StatusEffectType.PARALYZED);
                controllers.players.messageAll({
                    type: 'status',
                    components: [ `${context.effectName} inflicts paralysis on ${creatureName}!` ],
                });
                break;
                
            case 'sleep':
                controllers.statusEffects.applyStatusEffect(targetPlayerId, StatusEffectType.ASLEEP);
                controllers.players.messageAll({
                    type: 'status',
                    components: [ `${context.effectName} puts ${creatureName} to sleep!` ],
                });
                break;
                
            case 'confusion':
                controllers.statusEffects.applyStatusEffect(targetPlayerId, StatusEffectType.CONFUSED);
                controllers.players.messageAll({
                    type: 'status',
                    components: [ `${context.effectName} confuses ${creatureName}!` ],
                });
                break;
                
            default:
                /*
                 * TODO throw an error
                 * Log a warning for unknown status conditions
                 */
                console.warn(`[StatusEffectHandler] Unknown status condition: ${effect.condition}`);
                controllers.players.messageAll({
                    type: 'status',
                    components: [ `${context.effectName} tried to apply unknown status '${effect.condition}'!` ],
                });
                break;
        }
    }
}

export const statusEffectHandler = new StatusEffectHandler();
