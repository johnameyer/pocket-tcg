import { Controllers } from '../../controllers/controllers.js';
import { HandlerData } from '../../game-handler.js';
import { Effect } from '../../repository/effect-types.js';
import { FieldTarget } from '../../repository/targets/field-target.js';
import { EffectContext } from '../effect-context.js';
import { CardRepository } from '../../repository/card-repository.js';

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
export interface ResolutionRequirement {
    /** The property name on the effect object that contains the target */
    targetProperty: string;
    
    /** The target to resolve */
    target: FieldTarget;
    
    /** Whether this target is required for the effect to proceed */
    required: boolean;
}

/**
 * Interface for all effect handlers.
 * Each handler is responsible for a specific effect type and encapsulates
 * all logic related to that effect type.
 */
export interface EffectHandler<T extends Effect> {
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
}

/**
 * Abstract base class for effect handlers.
 * Provides common functionality for all handlers.
 */
export abstract class AbstractEffectHandler<T extends Effect> implements EffectHandler<T> {
    abstract getResolutionRequirements(effect: T): ResolutionRequirement[];
    abstract apply(controllers: Controllers, effect: T, context: EffectContext): void;
    
}
