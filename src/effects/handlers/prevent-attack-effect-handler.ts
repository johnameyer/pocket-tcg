import { Controllers } from '../../controllers/controllers.js';
import { PreventAttackEffect } from '../../repository/effect-types.js';
import { EffectContext } from '../effect-context.js';
import { AbstractEffectHandler, ResolutionRequirement } from '../interfaces/effect-handler-interface.js';
import { getCreatureFromTarget } from '../effect-utils.js';
import { CardRepository } from '../../repository/card-repository.js';
import { HandlerData } from '../../game-handler.js';
import { FieldTargetResolver } from '../target-resolvers/field-target-resolver.js';

/**
 * Handler for prevent attack effects that prevent creature from attacking.
 */
export class PreventAttackEffectHandler extends AbstractEffectHandler<PreventAttackEffect> {
    /**
     * Validate if a prevent attack effect can be applied.
     * Checks if there are valid targets for applying attack prevention.
     * 
     * @param handlerData Handler data view
     * @param effect The prevent attack effect to validate
     * @param context Effect context
     * @returns True if the effect can be applied, false otherwise
     */
    canApply(handlerData: HandlerData, effect: PreventAttackEffect, context: EffectContext, cardRepository: CardRepository): boolean {
        // Use TargetResolver to check if the target is available
        const result = FieldTargetResolver.isTargetAvailable(effect.target, handlerData, context, cardRepository);
        return result;
    }

    /**
     * Get the resolution requirements for a prevent attack effect.
     * Prevent attack effects require a target to apply the prevention to.
     * 
     * @param effect The prevent attack effect
     * @returns Array with target resolution requirement
     */
    getResolutionRequirements(effect: PreventAttackEffect): ResolutionRequirement[] {
        return [
            { targetProperty: 'target', target: effect.target, required: true },
        ];
    }
    
    /**
     * Apply a prevent attack effect.
     * This registers a passive effect that prevents the target creature from attacking during the specified duration.
     * 
     * @param controllers Game controllers
     * @param effect The prevent attack effect to apply
     * @param context Effect context
     */
    apply(controllers: Controllers, effect: PreventAttackEffect, context: EffectContext): void {
        if (effect.target.type !== 'resolved') {
            throw new Error(`Expected resolved target, got ${effect.target?.type || effect.target}`);
        }
        
        // Get resolved targets directly
        const targets = effect.target.targets;
        
        if (targets.length === 0) {
            throw new Error(`${context.effectName} resolved to no valid targets`);
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
                    type: 'prevent-attack',
                    target: effect.target,
                    duration: effect.duration,
                },
                effect.duration,
                controllers.turnCounter.getTurnNumber(),
            );
            
            // Send a message about the attack prevention
            controllers.players.messageAll({
                type: 'status',
                components: [ `${creatureName} cannot attack!` ],
            });
        }
    }
}

export const preventAttackEffectHandler = new PreventAttackEffectHandler();
