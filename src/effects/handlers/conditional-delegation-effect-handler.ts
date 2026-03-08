import { Controllers } from '../../controllers/controllers.js';
import { ConditionalDelegationEffect } from '../../repository/effect-types.js';
import { EffectContext } from '../effect-context.js';
import { AbstractEffectHandler, ResolutionRequirement } from '../interfaces/effect-handler-interface.js';
import { getEffectValue } from '../effect-utils.js';

/**
 * Handler for conditional delegation effects.
 * Evaluates a generic EffectValue as the condition (non-zero = true) and enqueues
 * the trueEffects or falseEffects accordingly.
 *
 * Common conditions:
 *  - Coin flip:   { type: 'coin-flip', headsValue: 1, tailsValue: 0 }
 *  - Multi-flip:  { type: 'coin-flip', headsValue: 1, tailsValue: 0, flipCount: N }
 *                 (sum equals heads count; combine with ComparisonValue for a minimum heads threshold)
 *  - Energy check: { type: 'count', countType: 'energy', fieldCriteria: { player: 'self', position: 'active' } }
 *  - Any ComparisonValue or ConditionalValue
 */
export class ConditionalDelegationEffectHandler extends AbstractEffectHandler<ConditionalDelegationEffect> {
    getResolutionRequirements(_effect: ConditionalDelegationEffect): ResolutionRequirement[] {
        return [];
    }

    apply(controllers: Controllers, effect: ConditionalDelegationEffect, context: EffectContext): void {
        const conditionValue = getEffectValue(effect.condition, controllers, context);
        const conditionMet = conditionValue !== 0;

        const effectsToApply = conditionMet ? effect.trueEffects : effect.falseEffects;
        if (effectsToApply.length > 0) {
            controllers.effects.pushPendingEffect(effectsToApply, context);
        }
    }
}

export const conditionalDelegationEffectHandler = new ConditionalDelegationEffectHandler();
