import { Controllers } from '../../controllers/controllers.js';
import { MoveCardsEffect } from '../../repository/effect-types.js';
import { EffectContext } from '../effect-context.js';
import { AbstractEffectHandler, ResolutionRequirement } from '../interfaces/effect-handler-interface.js';
import { getCreatureFromTarget } from '../effect-utils.js';
import { CardRepository } from '../../repository/card-repository.js';
import { HandlerData } from '../../game-handler.js';
import { FieldTargetResolver } from '../target-resolvers/field-target-resolver.js';

/**
 * Handler for move cards effects that relocate field cards to deck, hand, or discard.
 * Can include tools and evolution stack. Supports pull evolution functionality.
 */
export class MoveCardsEffectHandler extends AbstractEffectHandler<MoveCardsEffect> {
    /**
     * Get the resolution requirements for a move cards effect.
     * Move cards effects require a target to be resolved.
     * 
     * @param effect The move cards effect to get resolution requirements for
     * @returns Array of resolution requirements
     */
    getResolutionRequirements(effect: MoveCardsEffect): ResolutionRequirement[] {
        const requirements: ResolutionRequirement[] = [
            { targetProperty: 'target', target: effect.target, required: true },
        ];
        
        // If switchWith is specified, it also needs resolution
        if (effect.switchWith) {
            requirements.push({ targetProperty: 'switchWith', target: effect.switchWith, required: true });
        }
        
        return requirements;
    }
    
    /**
     * Optional validation method to check if a move cards effect can be applied.
     * 
     * @param handlerData Handler data view
     * @param effect The move cards effect to validate
     * @param context Effect context
     * @returns True if the effect can be applied, false otherwise
     */
    canApply(handlerData: HandlerData, effect: MoveCardsEffect, context: EffectContext, cardRepository: CardRepository): boolean {
        // If there's no target, we can't apply the effect
        if (!effect.target) {
            return false;
        }
        
        // Use TargetResolver to check if the target is available
        return FieldTargetResolver.isTargetAvailable(effect.target, handlerData, context, cardRepository);
    }

    /**
     * Apply a fully resolved move cards effect.
     * This is called after all targets have been resolved.
     * 
     * @param controllers Game controllers
     * @param effect The move cards effect to apply (with resolved targets)
     * @param context Effect context
     */
    apply(controllers: Controllers, effect: MoveCardsEffect, context: EffectContext): void {
        if (effect.target.type !== 'resolved') {
            throw new Error(`Expected resolved target, got ${effect.target?.type || effect.target}`);
        }
        
        // Get resolved targets directly
        const targets = effect.target.targets;
        
        if (targets.length === 0) {
            throw new Error(`${context.effectName} resolved to no valid targets`);
        }
        
        // TODO: Implement pull evolution functionality
        if (effect.pullEvolution) {
            controllers.players.messageAll({
                type: 'status',
                components: [ `${context.effectName} pull evolution is not yet implemented!` ],
            });
            return;
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
            
            // TODO: Implement actual card movement with tools and evolution stack
            // For now, just message that the effect would happen
            let moveDescription = '';
            if (effect.include === 'all') {
                moveDescription = ' with all tools and evolutions';
            } else if (effect.include === 'tool') {
                moveDescription = ' with tool';
            } else if (effect.include === 'evolution') {
                moveDescription = ' with evolution stack';
            }
            
            controllers.players.messageAll({
                type: 'status',
                components: [ `${context.effectName} would move ${creatureData.name}${moveDescription} to ${effect.destination} (not fully implemented)!` ],
            });
        }
    }
}

export const moveCardsEffectHandler = new MoveCardsEffectHandler();
