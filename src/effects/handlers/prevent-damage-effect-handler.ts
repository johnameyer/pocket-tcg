import { Controllers } from '../../controllers/controllers.js';
import { PreventDamageEffect } from '../../repository/effect-types.js';
import { EffectContext } from '../effect-context.js';
import { AbstractEffectHandler, ResolutionRequirement } from '../effect-handler.js';
import { getCreatureFromTarget } from '../effect-utils.js';
import { CardRepository } from '../../repository/card-repository.js';
import { HandlerData } from '../../game-handler.js';
import { TargetResolver } from '../target-resolver.js';

/**
 * Handler for prevent damage effects that prevent damage from specific sources.
 */
export class PreventDamageEffectHandler extends AbstractEffectHandler<PreventDamageEffect> {
    /**
     * Validate if a prevent damage effect can be applied.
     * 
     * @param handlerData Handler data view
     * @param effect The prevent damage effect to validate
     * @param context Effect context
     * @returns True if the effect can be applied, false otherwise
     */
    canApply(handlerData: HandlerData, effect: PreventDamageEffect, context: EffectContext, cardRepository: CardRepository): boolean {
        // If no target specified, can always apply (protects self)
        if(!effect.target) {
            return true;
        }
        
        // Use TargetResolver to check if the target is available
        return TargetResolver.isTargetAvailable(effect.target, handlerData, context, cardRepository);
    }

    /**
     * Get the resolution requirements for a prevent damage effect.
     * 
     * @param effect The prevent damage effect to get resolution requirements for
     * @returns Array with target resolution requirement if target specified
     */
    getResolutionRequirements(effect: PreventDamageEffect): ResolutionRequirement[] {
        if(effect.target) {
            return [
                { targetProperty: 'target', target: effect.target, required: true },
            ];
        }
        return []; // No target requirements if no target specified
    }
    
    /**
     * Apply a fully resolved prevent damage effect.
     * This prevents damage to the creature from specific sources.
     * 
     * @param controllers Game controllers
     * @param effect The prevent damage effect to apply
     * @param context Effect context
     */
    apply(controllers: Controllers, effect: PreventDamageEffect, context: EffectContext): void {
        // Get the creature instance ID from the context or target
        let creatureInstanceId: string | undefined;
        
        if(effect.target) {
            if(effect.target.type !== 'resolved') {
                throw new Error(`Expected resolved target, got ${effect.target?.type || effect.target}`);
            }
            
            // Get resolved targets directly
            const targets = effect.target.targets;
            
            if(targets.length === 0) {
                controllers.players.messageAll({
                    type: 'status',
                    components: [ `${context.effectName} found no valid targets!` ],
                });
                return;
            }
            
            for(const target of targets) {
                const { playerId, fieldIndex } = target;
                const targetCreature = getCreatureFromTarget(controllers, playerId, fieldIndex);
                
                if(!targetCreature) {
                    controllers.players.messageAll({
                        type: 'status',
                        components: [ `${context.effectName} target creature not found!` ],
                    });
                    continue;
                }
                
                creatureInstanceId = targetCreature.instanceId;
            }
        } else {
            // No target specified - protect based on context
            if(context.type === 'ability' || context.type === 'trigger') {
                creatureInstanceId = context.creatureInstanceId;
            } else if(context.type === 'trainer') {
                // For trainer cards without target, protect the active creature of the player who played the card
                const activeCreature = controllers.field.getRawCardByPosition(context.sourcePlayer, 0);
                if(activeCreature) {
                    creatureInstanceId = activeCreature.instanceId;
                }
            }
        }
        
        if(creatureInstanceId) {
            /*
             * Register the damage prevention effect with the turn state controller
             * This will be checked during damage calculation
             */
            controllers.turnState.registerDamagePrevention(context.sourcePlayer, context.effectName);
            
            // Show a message about the damage prevention
            const sourceText = effect.source ? `from ${effect.source}` : '';
            controllers.players.messageAll({
                type: 'status',
                components: [ `${context.effectName} prevents damage ${sourceText}!` ],
            });
        } else {
            console.warn('[PreventDamageEffectHandler] No creature instance ID in context, cannot apply prevent damage effect');
        }
    }
}

export const preventDamageEffectHandler = new PreventDamageEffectHandler();
