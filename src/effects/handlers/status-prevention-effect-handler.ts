import { Controllers } from '../../controllers/controllers.js';
import { StatusPreventionEffect } from '../../repository/effect-types.js';
import { EffectContext } from '../effect-context.js';
import { AbstractEffectHandler, ResolutionRequirement } from '../interfaces/effect-handler-interface.js';
import { TargetResolver } from '../target-resolver.js';

/**
 * Handler for status prevention effects that prevent special conditions.
 */
export class StatusPreventionEffectHandler extends AbstractEffectHandler<StatusPreventionEffect> {
    /**
     * Get resolution requirements for status prevention effect.
     * 
     * @param effect The status prevention effect
     * @returns Resolution requirements
     */
    getResolutionRequirements(effect: StatusPreventionEffect): ResolutionRequirement[] {
        if (TargetResolver.requiresTargetSelection(effect.target, {} as EffectContext)) {
            return [{ targetProperty: 'target', target: effect.target, required: true }];
        }
        return [];
    }
    
    /**
     * Apply a status prevention effect.
     * This prevents special conditions from being applied to targets.
     * 
     * @param controllers Game controllers
     * @param effect The status prevention effect to apply
     * @param context Effect context
     */
    apply(controllers: Controllers, effect: StatusPreventionEffect, context: EffectContext): void {
        // TODO: Implement status prevention logic
        controllers.players.messageAll({
            type: 'status',
            components: [ `${context.effectName} is not yet implemented!` ],
        });
    }
}

export const statusPreventionEffectHandler = new StatusPreventionEffectHandler();
