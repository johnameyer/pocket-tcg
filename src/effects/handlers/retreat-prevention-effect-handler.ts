import { Controllers } from '../../controllers/controllers.js';
import { RetreatPreventionEffect } from '../../repository/effect-types.js';
import { EffectContext } from '../effect-context.js';
import { AbstractEffectHandler, ResolutionRequirement } from '../interfaces/effect-handler-interface.js';

/**
 * Handler for retreat prevention effects that prevent creature from retreating.
 * Uses criteria-based matching — no target resolution required.
 */
export class RetreatPreventionEffectHandler extends AbstractEffectHandler<RetreatPreventionEffect> {
    /**
     * Retreat prevention effects match criteria passively, so no resolution is needed.
     *
     * @param effect The retreat prevention effect
     * @returns Empty array (no resolution needed)
     */
    getResolutionRequirements(effect: RetreatPreventionEffect): ResolutionRequirement[] {
        return [];
    }

    /**
     * Apply a retreat prevention effect.
     * Registers a passive effect that prevents creatures matching the target criteria from retreating.
     *
     * @param controllers Game controllers
     * @param effect The retreat prevention effect to apply
     * @param context Effect context
     */
    apply(controllers: Controllers, effect: RetreatPreventionEffect, context: EffectContext): void {
        controllers.effects.registerPassiveEffect(
            context.sourcePlayer,
            context.effectName,
            effect,
            effect.duration,
            controllers.turnCounter.getTurnNumber(),
        );

        controllers.players.messageAll({
            type: 'status',
            components: [ `${context.effectName} prevents retreat!` ],
        });
    }
}

export const retreatPreventionEffectHandler = new RetreatPreventionEffectHandler();
