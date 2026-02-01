import { Controllers } from '../../controllers/controllers.js';
import { RetreatPreventionEffect } from '../../repository/effect-types.js';
import { EffectContext } from '../effect-context.js';
import { AbstractEffectHandler, ResolutionRequirement } from '../interfaces/effect-handler-interface.js';
import { getCreatureFromTarget } from '../effect-utils.js';
import { CardRepository } from '../../repository/card-repository.js';
import { HandlerData } from '../../game-handler.js';
import { TargetResolver } from '../target-resolver.js';

/**
 * Handler for retreat prevention effects that prevent creature from retreating.
 */
export class RetreatPreventionEffectHandler extends AbstractEffectHandler<RetreatPreventionEffect> {
    /**
     * Validate if a retreat prevention effect can be applied.
     * Checks if there are valid targets for applying retreat prevention.
     * 
     * @param handlerData Handler data view
     * @param effect The retreat prevention effect to validate
     * @param context Effect context
     * @returns True if the effect can be applied, false otherwise
     */
    canApply(handlerData: HandlerData, effect: RetreatPreventionEffect, context: EffectContext, cardRepository: CardRepository): boolean {
        // Use TargetResolver to check if the target is available
        const result = TargetResolver.isTargetAvailable(effect.target, handlerData, context, cardRepository);
        return result;
    }

    /**
     * Get the resolution requirements for a retreat prevention effect.
     * Retreat prevention effects require a target to apply the prevention to.
     * 
     * @param effect The retreat prevention effect
     * @returns Array with target resolution requirement
     */
    getResolutionRequirements(effect: RetreatPreventionEffect): ResolutionRequirement[] {
        return [
            { targetProperty: 'target', target: effect.target, required: true },
        ];
    }
    
    /**
     * Apply a retreat prevention effect.
     * This registers a passive effect that prevents the target creature from retreating during the specified duration.
     * 
     * @param controllers Game controllers
     * @param effect The retreat prevention effect to apply
     * @param context Effect context
     */
    apply(controllers: Controllers, effect: RetreatPreventionEffect, context: EffectContext): void {
        // Ensure we have a valid target
        if (!effect.target) {
            throw new Error('No target specified for retreat prevention effect');
        }
        
        if (effect.target.type !== 'resolved') {
            throw new Error(`Expected resolved target, got ${effect.target?.type || effect.target}`);
        }
        
        // Get resolved targets directly
        const targets = effect.target.targets;
        
        if (targets.length === 0) {
            controllers.players.messageAll({
                type: 'status',
                components: [ `${context.effectName} found no valid targets!` ],
            });
            return;
        }
        
        for (const target of targets) {
            const { playerId, fieldIndex } = target;
            
            // Get the target creature
            const targetCreature = getCreatureFromTarget(controllers, playerId, fieldIndex);
            
            if (!targetCreature) {
                controllers.players.messageAll({
                    type: 'status',
                    components: [ `${context.effectName} target creature not found!` ],
                });
                continue;
            }
            
            // Get creature data for messaging
            const creatureName = controllers.cardRepository.getCreature(targetCreature.templateId).name;
            
            // Register as a passive effect with the specified duration
            controllers.effects.registerPassiveEffect(
                context.sourcePlayer,
                context.effectName,
                {
                    type: 'retreat-prevention',
                    target: effect.target,
                    duration: effect.duration,
                },
                effect.duration,
                controllers.turnCounter.getTurnNumber()
            );
            
            // Send a message about the retreat prevention
            controllers.players.messageAll({
                type: 'status',
                components: [ `${creatureName} cannot retreat!` ],
            });
        }
    }
}

export const retreatPreventionEffectHandler = new RetreatPreventionEffectHandler();
