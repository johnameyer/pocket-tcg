import { Controllers } from '../../controllers/controllers.js';
import { PullEvolutionEffect } from '../../repository/effect-types.js';
import { EffectContext } from '../effect-context.js';
import { AbstractEffectHandler, ResolutionRequirement } from '../interfaces/effect-handler-interface.js';
import { getCreatureFromTarget } from '../effect-utils.js';
import { CardRepository } from '../../repository/card-repository.js';
import { HandlerData } from '../../game-handler.js';
import { FieldTargetResolver } from '../target-resolvers/field-target-resolver.js';

/**
 * Handler for pull evolution effects that pull an evolution from deck and immediately evolve the target.
 */
export class PullEvolutionEffectHandler extends AbstractEffectHandler<PullEvolutionEffect> {
    /**
     * Get the resolution requirements for a pull evolution effect.
     * 
     * @param effect The pull evolution effect to get resolution requirements for
     * @returns Array of resolution requirements
     */
    getResolutionRequirements(effect: PullEvolutionEffect): ResolutionRequirement[] {
        return [
            { targetProperty: 'target', target: effect.target, required: true },
        ];
    }
    
    /**
     * Optional validation method to check if a pull evolution effect can be applied.
     * 
     * @param handlerData Handler data view
     * @param effect The pull evolution effect to validate
     * @param context Effect context
     * @returns True if the effect can be applied, false otherwise
     */
    canApply(handlerData: HandlerData, effect: PullEvolutionEffect, context: EffectContext, cardRepository: CardRepository): boolean {
        // If there's no target, we can't apply the effect
        if (!effect.target) {
            return false;
        }
        
        // Use TargetResolver to check if the target is available
        return FieldTargetResolver.isTargetAvailable(effect.target, handlerData, context, cardRepository);
    }

    /**
     * Apply a fully resolved pull evolution effect.
     * This is called after all targets have been resolved.
     * 
     * @param controllers Game controllers
     * @param effect The pull evolution effect to apply (with resolved targets)
     * @param context Effect context
     */
    apply(controllers: Controllers, effect: PullEvolutionEffect, context: EffectContext): void {
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
            
            // Get the creature data for messaging
            const creatureData = controllers.cardRepository.getCreature(targetCreature.templateId);
            
            // TODO: Implement actual pull evolution functionality
            controllers.players.messageAll({
                type: 'status',
                components: [ `${context.effectName} would pull and evolve ${creatureData.name} (not fully implemented)!` ],
            });
        }
    }
}

export const pullEvolutionEffectHandler = new PullEvolutionEffectHandler();
