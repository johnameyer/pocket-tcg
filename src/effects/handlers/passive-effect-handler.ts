import { Controllers } from '../../controllers/controllers.js';
import { RegisterPassiveEffect } from '../../repository/effect-types.js';
import { EffectContext } from '../effect-context.js';
import { AbstractEffectHandler, ResolutionRequirement } from '../interfaces/effect-handler-interface.js';

/**
 * Handler for the unified passive effect type.
 * Registers any modifier effect as a passive effect that persists over time.
 */
export class PassiveEffectHandler extends AbstractEffectHandler<RegisterPassiveEffect> {
    /**
     * Passive effects require no target resolution — they match criteria passively at query time.
     *
     * @param effect The register-passive effect
     * @returns Empty array (no resolution needed)
     */
    getResolutionRequirements(effect: RegisterPassiveEffect): ResolutionRequirement[] {
        return [];
    }

    /**
     * Apply a passive effect by registering its modifier into the active passive effects store.
     *
     * @param controllers Game controllers
     * @param effect The register-passive effect to apply
     * @param context Effect context
     */
    apply(controllers: Controllers, effect: RegisterPassiveEffect, context: EffectContext): void {
        controllers.effects.registerPassiveEffect(
            context.sourcePlayer,
            context.effectName,
            effect.modifier,
            effect.modifier.duration,
            controllers.turnCounter.getTurnNumber(),
            context.sourceInstanceId,
            context.sourceToolInstanceId,
        );

        controllers.players.messageAll({
            type: 'status',
            components: [ `${context.effectName} is now active!` ],
        });
    }
}

export const passiveEffectHandler = new PassiveEffectHandler();
