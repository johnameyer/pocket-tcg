import { Controllers } from '../../controllers/controllers.js';
import { HandlerData } from '../../game-handler.js';
import { FutureEffect } from '../../repository/effect-types.js';
import { EffectContext } from '../effect-context.js';
import { AbstractEffectHandler, ResolutionRequirement } from '../interfaces/effect-handler-interface.js';

class FutureEffectHandler extends AbstractEffectHandler<FutureEffect> {
    getResolutionRequirements(_effect: FutureEffect): ResolutionRequirement[] {
        return [];
    }

    apply(controllers: Controllers, effect: FutureEffect, context: EffectContext): void {
        controllers.effects.scheduleFutureEffect(
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

    canApply(_handlerData: HandlerData, effect: FutureEffect): boolean {
        return effect.effects.length > 0;
    }
}

export const futureEffectHandler = new FutureEffectHandler();
