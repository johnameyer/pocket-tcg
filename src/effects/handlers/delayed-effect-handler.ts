import { Controllers } from '../../controllers/controllers.js';
import { HandlerData } from '../../game-handler.js';
import { DelayedEffect } from '../../repository/effect-types.js';
import { EffectContext } from '../effect-context.js';
import { AbstractEffectHandler, ResolutionRequirement } from '../interfaces/effect-handler-interface.js';

class DelayedEffectHandler extends AbstractEffectHandler<DelayedEffect> {
    getResolutionRequirements(_effect: DelayedEffect): ResolutionRequirement[] {
        return [];
    }

    apply(controllers: Controllers, effect: DelayedEffect, context: EffectContext): void {
        controllers.effects.scheduleDelayedEffect(
            context.sourcePlayer,
            context.effectName,
            effect.effects,
            context,
            effect.delayTurns,
            effect.targetPlayer,
            effect.phase,
            controllers.turnCounter.getTurnNumber(),
        );
    }

    canApply(_handlerData: HandlerData, effect: DelayedEffect): boolean {
        return effect.effects.length > 0;
    }
}

export const delayedEffectHandler = new DelayedEffectHandler();
