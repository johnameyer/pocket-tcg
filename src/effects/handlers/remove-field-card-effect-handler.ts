import { Controllers } from '../../controllers/controllers.js';
import { RemoveFieldCardEffect } from '../../repository/effect-types.js';
import { EffectContext } from '../effect-context.js';
import { AbstractEffectHandler, ResolutionRequirement } from '../interfaces/effect-handler-interface.js';
import { getCreatureFromTarget } from '../effect-utils.js';
import { CardRepository } from '../../repository/card-repository.js';
import { HandlerData } from '../../game-handler.js';
import { FieldTargetResolver } from '../target-resolvers/field-target-resolver.js';

/**
 * Handler for remove field card effects that remove field cards to deck, hand, or discard.
 * Always includes all attached tools and evolution stack.
 */
export class RemoveFieldCardEffectHandler extends AbstractEffectHandler<RemoveFieldCardEffect> {
    /**
     * Get the resolution requirements for a remove field card effect.
     * 
     * @param effect The remove field card effect to get resolution requirements for
     * @returns Array of resolution requirements
     */
    getResolutionRequirements(effect: RemoveFieldCardEffect): ResolutionRequirement[] {
        return [
            { targetProperty: 'target', target: effect.target, required: true },
        ];
    }
    
    /**
     * Optional validation method to check if a remove field card effect can be applied.
     * 
     * @param handlerData Handler data view
     * @param effect The remove field card effect to validate
     * @param context Effect context
     * @returns True if the effect can be applied, false otherwise
     */
    canApply(handlerData: HandlerData, effect: RemoveFieldCardEffect, context: EffectContext, cardRepository: CardRepository): boolean {
        // If there's no target, we can't apply the effect
        if (!effect.target) {
            return false;
        }
        
        // Use TargetResolver to check if the target is available
        return FieldTargetResolver.isTargetAvailable(effect.target, handlerData, context, cardRepository);
    }

    /**
     * Apply a fully resolved remove field card effect.
     * This is called after all targets have been resolved.
     * 
     * @param controllers Game controllers
     * @param effect The remove field card effect to apply (with resolved targets)
     * @param context Effect context
     */
    apply(controllers: Controllers, effect: RemoveFieldCardEffect, context: EffectContext): void {
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
            
            // TODO: Implement actual card removal with tools and evolution stack
            controllers.players.messageAll({
                type: 'status',
                components: [ `${context.effectName} would remove ${creatureData.name} with all tools and evolutions to ${effect.destination} (not fully implemented)!` ],
            });
        }
    }
}

export const removeFieldCardEffectHandler = new RemoveFieldCardEffectHandler();
