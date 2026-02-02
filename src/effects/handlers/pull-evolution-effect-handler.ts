import { Controllers } from '../../controllers/controllers.js';
import { PullEvolutionEffect } from '../../repository/effect-types.js';
import { EffectContext } from '../effect-context.js';
import { AbstractEffectHandler, ResolutionRequirement } from '../interfaces/effect-handler-interface.js';
import { TargetResolver } from '../target-resolver.js';

/**
 * Handler for pull evolution effects that pull evolution cards from deck and immediately evolve.
 */
export class PullEvolutionEffectHandler extends AbstractEffectHandler<PullEvolutionEffect> {
    /**
     * Get resolution requirements for pull evolution effect.
     * 
     * @param effect The pull evolution effect
     * @returns Resolution requirements
     */
    getResolutionRequirements(effect: PullEvolutionEffect): ResolutionRequirement[] {
        if (TargetResolver.requiresTargetSelection(effect.target, {} as EffectContext)) {
            return [{ targetProperty: 'target', target: effect.target, required: true }];
        }
        return [];
    }
    
    /**
     * Apply a pull evolution effect.
     * This searches the deck for an evolution card and immediately evolves the target.
     * 
     * @param controllers Game controllers
     * @param effect The pull evolution effect to apply
     * @param context Effect context
     */
    apply(controllers: Controllers, effect: PullEvolutionEffect, context: EffectContext): void {
        // TODO: Implement pull evolution logic
        controllers.players.messageAll({
            type: 'status',
            components: [ `${context.effectName} is not yet implemented!` ],
        });
    }
}

export const pullEvolutionEffectHandler = new PullEvolutionEffectHandler();
