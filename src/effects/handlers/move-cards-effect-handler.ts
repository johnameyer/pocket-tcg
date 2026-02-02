import { Controllers } from '../../controllers/controllers.js';
import { MoveCardsEffect } from '../../repository/effect-types.js';
import { EffectContext } from '../effect-context.js';
import { AbstractEffectHandler, ResolutionRequirement } from '../interfaces/effect-handler-interface.js';
import { TargetResolver } from '../target-resolver.js';

/**
 * Handler for move cards effects that move cards (with tools/evolution) to deck/hand.
 */
export class MoveCardsEffectHandler extends AbstractEffectHandler<MoveCardsEffect> {
    /**
     * Get resolution requirements for move cards effect.
     * 
     * @param effect The move cards effect
     * @returns Resolution requirements
     */
    getResolutionRequirements(effect: MoveCardsEffect): ResolutionRequirement[] {
        const requirements: ResolutionRequirement[] = [];
        
        if (TargetResolver.requiresTargetSelection(effect.target, {} as EffectContext)) {
            requirements.push({ targetProperty: 'target', target: effect.target, required: true });
        }
        
        if (effect.switchWith && TargetResolver.requiresTargetSelection(effect.switchWith, {} as EffectContext)) {
            requirements.push({ targetProperty: 'switchWith', target: effect.switchWith, required: true });
        }
        
        return requirements;
    }
    
    /**
     * Apply a move cards effect.
     * This moves cards (possibly with tools and evolution stack) to deck or hand.
     * 
     * @param controllers Game controllers
     * @param effect The move cards effect to apply
     * @param context Effect context
     */
    apply(controllers: Controllers, effect: MoveCardsEffect, context: EffectContext): void {
        // TODO: Implement move cards logic
        controllers.players.messageAll({
            type: 'status',
            components: [ `${context.effectName} is not yet implemented!` ],
        });
    }
}

export const moveCardsEffectHandler = new MoveCardsEffectHandler();
