import { Controllers } from '../../controllers/controllers.js';
import { HandlerData } from '../../game-handler.js';
import { TryThenEffect } from '../../repository/effect-types.js';
import { CardRepository } from '../../repository/card-repository.js';
import { EffectContext } from '../effect-context.js';
import { AbstractEffectHandler, ResolutionRequirement, isEnergyResolutionTarget } from '../interfaces/effect-handler-interface.js';
import { FieldTargetResolver } from '../target-resolvers/field-target-resolver.js';
import { EnergyTargetResolver } from '../target-resolvers/energy-target-resolver.js';
// Imported at call-time only; safe with ESM live bindings despite the cycle
// (effect-handlers-map → this file → effect-handlers-map).
import { effectHandlers } from './effect-handlers-map.js';

/**
 * Handler for try-then effects.
 * Checks whether `attempt` can be applied; if so, enqueues [attempt, then] together.
 * If `attempt` cannot be applied, neither effect fires — modelling "Discard X. If you do, …"
 */
export class TryThenEffectHandler extends AbstractEffectHandler<TryThenEffect> {
    getResolutionRequirements(_effect: TryThenEffect): ResolutionRequirement[] {
        return [];
    }

    canApply(handlerData: HandlerData, effect: TryThenEffect, context: EffectContext, cardRepository: CardRepository): boolean {
        const attempt = effect.attempt;
        const handler = effectHandlers[attempt.type as keyof typeof effectHandlers];
        if (!handler) {
            return false;
        }

        // Check required resolution targets for the attempt effect
        const requirements = (handler as { getResolutionRequirements(e: typeof attempt): ResolutionRequirement[] })
            .getResolutionRequirements(attempt);
        for (const req of requirements) {
            if (!req.required) {
                continue; 
            }
            const available = isEnergyResolutionTarget(req.target)
                ? EnergyTargetResolver.isTargetAvailable(req.target, handlerData, context, cardRepository)
                : FieldTargetResolver.isTargetAvailable(req.target, handlerData, context, cardRepository);
            if (!available) {
                return false; 
            }
        }

        // Delegate to the attempt handler's own canApply if present
        const attemptHandler = handler as { canApply?(hd: HandlerData, e: typeof attempt, ctx: EffectContext, cr: CardRepository): boolean };
        if (attemptHandler.canApply) {
            return attemptHandler.canApply(handlerData, attempt, context, cardRepository);
        }

        return true;
    }

    apply(controllers: Controllers, effect: TryThenEffect, context: EffectContext): void {
        controllers.effects.pushPendingEffect([ effect.attempt, effect.then ], context);
    }
}

export const tryThenEffectHandler = new TryThenEffectHandler();
