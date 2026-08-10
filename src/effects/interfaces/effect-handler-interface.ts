import { Controllers } from '../../controllers/controllers.js';
import { HandlerData } from '../../game-handler.js';
import { Effect, ModifierEffect } from '../../repository/effect-types.js';
import { FieldTarget } from '../../repository/targets/field-target.js';
import { EnergyTarget } from '../../repository/targets/energy-target.js';
import { CardTarget } from '../../repository/targets/card-target.js';
import { EffectContext } from '../effect-context.js';
import { CardRepository } from '../../repository/card-repository.js';
import { GameCard } from '../../controllers/card-types.js';
import { FieldCard } from '../../controllers/field-controller.js';

/**
 * Type for the effect handlers record.
 * This ensures that we have a handler for each effect type.
 */
export type EffectHandlerMap = {
    [K in Effect['type']]: EffectHandler<Extract<Effect, { type: K }>>;
};

/**
 * Represents a requirement for resolving a target property in an effect.
 * This separates what needs resolution from how to resolve it.
 */
export function isEnergyResolutionTarget(target: FieldTarget | EnergyTarget | CardTarget): target is EnergyTarget {
    return target.type === 'field' || target.type === 'discard';
}

/**
 * Distinguishes the `CardTarget` family from `FieldTarget`, whose 'fixed'/'single-choice'/
 * 'resolved' type discriminants otherwise collide with `CardTarget`'s. `CardTarget`'s
 * 'fixed' variant always carries a top-level `location` (never `player`); its 'resolved'
 * variant carries `cards` (never `targets`). This is a structural heuristic scoped to the
 * shapes `CardTarget` actually declares - see the `dependsOn`/`filter` TODO below for why
 * this whole mechanism is a one-off rather than a fully general system.
 */
export function isCardResolutionTarget(target: FieldTarget | EnergyTarget | CardTarget): target is CardTarget {
    if (target.type === 'fixed') {
        return 'location' in target && !('player' in target);
    }
    if (target.type === 'resolved') {
        return 'cards' in target;
    }
    if (target.type === 'single-choice') {
        // FieldTargetCriteria.location, when set, is always 'field' (required for
        // FieldTargetResolver.getAvailableTargets to search field cards); CardTargetCriteria.location
        // is always 'hand'/'deck'/'discard'. That distinction - not mere presence of the key - is
        // what's unambiguous here.
        return 'criteria' in target && 'location' in target.criteria && target.criteria.location !== 'field';
    }
    return false;
}

export interface ResolutionRequirement {
    /** The property name on the effect object that contains the target */
    targetProperty: string;

    // TODO: also support a ChoiceTarget variant so choice-delegation-style selection can go through this same declarative pipeline.
    /** The target to resolve */
    target: FieldTarget | EnergyTarget | CardTarget;

    /** Whether this target is required for the effect to proceed */
    required: boolean;

    /**
     * Names of other requirements' `targetProperty` values (declared earlier in the same
     * handler's getResolutionRequirements() list) whose resolved values this requirement's
     * `filter` needs to see. Resolution proceeds strictly in array order - a requirement
     * can only depend on ones that come before it in the list.
     *
     * TODO: this closure-based dependsOn/filter mechanism is a pragmatic one-off built for
     * evolution-skip's fieldBase -> handEvolution relationship. It is NOT a general-purpose
     * cross-target dependency system: filter functions aren't inspectable/serializable, and
     * this hasn't been proven out for more than one dependency edge or for cases needing
     * bidirectional/cyclic dependencies. If a second effect needs something like this, take
     * a fresh look at the design (e.g. a declarative criteria-based approach was also
     * considered and rejected here for touching too much shared filter code) rather than
     * extending this mechanism or copy-pasting the closure pattern.
     */
    dependsOn?: string[];

    /**
     * Optional extra per-candidate filter, run during resolution after any requirements
     * named in `dependsOn` have already been resolved. `resolved` maps targetProperty name
     * to that requirement's already-resolved value (a ResolvedFieldTarget/ResolvedCardTarget/
     * ResolvedMultiEnergyTarget). Return false to exclude a candidate.
     * See the TODO on `dependsOn` above before adding a second use of this.
     */
    filter?: (candidate: FieldCard | GameCard, resolved: Record<string, unknown>, controllers: Controllers) => boolean;
}

/**
 * Interface for all effect handlers.
 * Each handler is responsible for a specific effect type and encapsulates
 * all logic related to that effect type.
 */
export interface EffectHandler<T extends Effect | ModifierEffect> {
    /**
     * Get the resolution requirements for an effect.
     * This defines what targets need to be resolved before the effect can be applied.
     * 
     * @param effect The effect to get resolution requirements for
     * @returns Array of resolution requirements
     */
    getResolutionRequirements(effect: T): ResolutionRequirement[];
    
    /**
     * Apply a fully resolved effect.
     * This is called after all targets have been resolved - so calls to TargetResolver should not be needed, just casts to ResolvedTarget.
     * 
     * @param controllers Game controllers
     * @param effect The effect to apply (with resolved targets)
     * @param context Effect context
     */
    apply(controllers: Controllers, effect: T, context: EffectContext): void;
    
    /**
     * Optional validation method to check if an effect can be applied.
     * Updated to use HandlerData for validation.
     * 
     * @param handlerData Handler data view
     * @param effect The effect to validate
     * @param context Effect context
     * @returns True if the effect can be applied, false otherwise
     */
    canApply?(handlerData: HandlerData, effect: T, context: EffectContext, cardRepository: CardRepository): boolean;

    /**
     * Optional method to resume an effect after a card selection has been made.
     * Implement this when the effect's apply() method creates a PendingCardSelection.
     * 
     * @param controllers Game controllers
     * @param effect The effect being resumed
     * @param selectedCards The cards selected by the player
     * @param context Effect context
     */
    resumeWithCardSelection?(controllers: Controllers, effect: T, selectedCards: GameCard[], context: EffectContext): void;
}

/**
 * Abstract base class for effect handlers.
 * Provides common functionality for all handlers.
 */
export abstract class AbstractEffectHandler<T extends Effect | ModifierEffect> implements EffectHandler<T> {
    abstract getResolutionRequirements(effect: T): ResolutionRequirement[];
    abstract apply(controllers: Controllers, effect: T, context: EffectContext): void;
    
}
