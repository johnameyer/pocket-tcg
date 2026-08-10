import { ChoiceTarget, ResolvedChoiceTarget } from '../../repository/targets/choice-target.js';
import { HandlerData } from '../../game-handler.js';

/**
 * Result of resolving a `ChoiceTarget` through the generic ResolutionRequirement pipeline.
 */
export type ChoiceTargetResolutionResult =
    | ResolvedChoiceTarget
    | { type: 'requires-selection', availableChoices: Array<{ name: string; value: string }> }
    | { type: 'no-valid-targets' };

/**
 * Resolves the `ChoiceTarget` family (`single-choice` / `resolved`) used by effects that
 * plug named-choice selection into the generic ResolutionRequirement pipeline (e.g.
 * choice-delegation).
 */
export class ChoiceTargetResolver {
    static resolveTarget(target: ChoiceTarget | undefined): ChoiceTargetResolutionResult {
        if (!target) {
            return { type: 'no-valid-targets' };
        }

        if (target.type === 'resolved') {
            return target;
        }

        if (target.choices.length === 0) {
            return { type: 'no-valid-targets' };
        }

        if (target.choices.length === 1) {
            return { type: 'resolved', value: target.choices[0].value };
        }

        return { type: 'requires-selection', availableChoices: target.choices };
    }

    /**
     * Checks whether a choice target has any choices available. Used for the coarse
     * availability pre-check in `EffectApplier.canApplyEffect`.
     */
    static isTargetAvailable(target: ChoiceTarget | undefined, _handlerData: HandlerData): boolean {
        if (!target) {
            return false;
        }
        if (target.type === 'resolved') {
            return true;
        }
        return target.choices.length > 0;
    }
}
