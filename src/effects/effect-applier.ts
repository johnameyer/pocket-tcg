import { Controllers } from '../controllers/controllers.js';
import { HandlerData } from '../game-handler.js';
import { Effect } from '../repository/effect-types.js';
import { ResolvedTarget } from '../repository/target-types.js';
import { ControllerUtils } from '../utils/controller-utils.js';
import { CardRepository } from '../repository/card-repository.js';
import { EffectContext } from './effect-context.js';
import { PendingTargetSelection } from './pending-selection-types.js';
import { ResolutionRequirement, EffectHandler } from './interfaces/effect-handler-interface.js';
import { effectHandlers } from './handlers/effect-handlers-map.js';
import { TargetResolver, SingleTargetResolutionResult, TargetResolutionResult } from './target-resolver.js';

export class EffectApplier {
    /**
     * Main method for applying effects.
     * This orchestrates the resolution and application of effects.
     * Updated to be HandlerData-primary for validation.
     * 
     * @param effects Array of effects to apply
     * @param controllers Game controllers
     * @param context Effect context
     */
    static applyEffects(effects: Effect[], controllers: Controllers, context: EffectContext): void {
        // Guard against undefined/null effects
        if (!effects || !Array.isArray(effects)) {
            return;
        }

        // Create HandlerData view for validation
        const handlerData = ControllerUtils.createPlayerView(controllers, context.sourcePlayer);

        for (const effect of effects) {
            // Skip undefined/null effects
            if (!effect || !effect.type) {
                continue;
            }

            // Get the handler for this effect type with proper type safety
            const handler = effectHandlers[effect.type] as EffectHandler<typeof effect>;
            
            if (!handler) {
                continue;
            }

            // Validate using HandlerData
            if (!this.canApplyEffect(effect, handlerData, context, controllers.cardRepository.cardRepository)) {
                continue;
            }

            // Get resolution requirements from handler
            const requirements = handler.getResolutionRequirements(effect);

            // Handle resolution for all requirements
            const resolvedEffect = this.resolveEffectRequirements(effect, requirements, controllers, context);
            if (!resolvedEffect) {
                // Pending selection or no valid targets
                return;
            }

            // Apply effect directly - handlers are responsible for their own multi-target logic
            handler.apply(controllers, resolvedEffect, context);
        }
    }
    
    /**
     * Resolves all target requirements for an effect.
     * 
     * @param effect The effect to resolve requirements for
     * @param requirements Array of resolution requirements
     * @param controllers Game controllers
     * @param context Effect context
     * @returns The resolved effect or null if pending selection or no valid targets
     */
    private static resolveEffectRequirements(
        effect: Effect,
        requirements: ResolutionRequirement[],
        controllers: Controllers,
        context: EffectContext,
    ): Effect | null {
        /*
         * TODO: Replace deep copy hack with proper effect cloning mechanism
         * Deep copy the effect to avoid modifying the original
         */
        let resolvedEffect = JSON.parse(JSON.stringify(effect));
        
        for (const requirement of requirements) {
            // Check if this target needs selection
            if (TargetResolver.handleTargetSelection(controllers, effect, context, requirement.target)) {
                return null; // Pending selection
            }
            
            // Determine if this is a single or multi target
            const target = requirement.target;
            let resolvedTarget: ResolvedTarget | undefined;
            
            if (!target) {
                // No target specified
                resolvedTarget = undefined;
            } else if (target.type === 'all-matching' || target.type === 'multi-choice') {
                // Multi-target: use resolveTarget and convert to array
                const resolution = TargetResolver.resolveTarget(target, controllers, context);
                resolvedTarget = this.convertResolutionToResolvedTargets(resolution, context);
            } else {
                // Single target (fixed, single-choice, or resolved): use resolveSingleTarget
                const resolution = TargetResolver.resolveSingleTarget(target, controllers, context);
                resolvedTarget = this.convertSingleResolutionToResolvedTarget(resolution, context);
            }
            
            if (!resolvedTarget && requirement.required) {
                return null; // No valid targets for required property
            }
            
            // Set resolved target on the effect using spread operator for type safety
            resolvedEffect = {
                ...resolvedEffect,
                [requirement.targetProperty]: resolvedTarget,
            };
        }
        
        return resolvedEffect;
    }

    /**
     * Converts a single target resolution result to a ResolvedTarget.
     * 
     * @param resolution The single target resolution result
     * @param context The effect context
     * @returns A ResolvedTarget or undefined if no valid target
     */
    private static convertSingleResolutionToResolvedTarget(
        resolution: SingleTargetResolutionResult,
        context: EffectContext,
    ): ResolvedTarget | undefined {
        switch (resolution.type) {
            case 'resolved':
                return resolution; // Already a ResolvedTarget with targets array
            case 'auto-resolved':
                return {
                    type: 'resolved',
                    targets: [{
                        playerId: resolution.playerId,
                        fieldIndex: resolution.fieldIndex,
                    }],
                };
                
            default:
                console.warn(`Unexpected resolution type: ${resolution.type}`);
                return undefined;
        }
    }
    
    /**
     * Converts a target resolution result to an array of ResolvedTargets.
     * 
     * @param resolution The target resolution result
     * @param context The effect context
     * @returns An array of ResolvedTargets or empty array if no valid targets
     */
    private static convertResolutionToResolvedTargets(
        resolution: TargetResolutionResult,
        context: EffectContext,
    ): ResolvedTarget {
        switch (resolution.type) {
            case 'resolved':
                return resolution; // Already a ResolvedTarget with targets array
            case 'auto-resolved':
                return {
                    type: 'resolved',
                    targets: [{
                        playerId: resolution.playerId,
                        fieldIndex: resolution.fieldIndex,
                    }],
                };
                
            case 'all-matching':
                return {
                    type: 'resolved',
                    targets: resolution.targets.map(t => ({
                        playerId: t.playerId,
                        fieldIndex: t.fieldIndex,
                    })),
                };
                
            default:
                return {
                    type: 'resolved',
                    targets: [],
                };
        }
    }
    
    // The resolveTargetToArray method is replaced by convertSingleResolutionToFixedTarget and convertResolutionToFixedTargets

    /**
     * Method to resume effect application after target selection.
     * 
     * @param controllers Game controllers
     * @param pendingSelection The pending target selection
     * @param targetPlayerId The selected target player ID
     * @param targetCreatureIndex The selected target creature index
     */
    static resumeEffectWithSelection(controllers: Controllers, pendingSelection: PendingTargetSelection, targetPlayerId: number, targetCreatureIndex: number): boolean {
        const { effect, originalContext, selectionType = 'target' } = pendingSelection;

        /*
         * Target validation is now handled at the event handler level
         * If we reach here, the target is valid
         */
        
        // Create a resolved target from the selection
        const resolvedTarget = {
            type: 'resolved' as const,
            targets: [{
                playerId: targetPlayerId,
                fieldIndex: targetCreatureIndex,
            }],
        };
        
        /*
         * TODO: Replace deep copy hack with proper effect cloning mechanism
         * Create a deep copy of the effect
         */
        let resolvedEffect = JSON.parse(JSON.stringify(effect));
        
        // Get the handler for this effect type with proper type safety
        const handler = effectHandlers[effect.type] as EffectHandler<typeof effect>;
        if (!handler) {
            console.warn(`No handler found for effect type: ${effect.type}`);
            return false;
        }
        
        // Get resolution requirements from handler
        const requirements = handler.getResolutionRequirements(effect);
        
        // Find the first unresolved requirement that needs selection (in order)
        let targetPropertyUpdated = false;
        
        for (const requirement of requirements) {
            const currentTarget = resolvedEffect[requirement.targetProperty];
            const target = requirement.target;
            
            // Check if this requirement is unresolved and needs selection
            if (target && typeof target === 'object' 
                && (target.type === 'single-choice' || target.type === 'multi-choice')
                && (!currentTarget || currentTarget.type !== 'resolved')) {
                // This is the next target that needs selection
                resolvedEffect = {
                    ...resolvedEffect,
                    [requirement.targetProperty]: resolvedTarget,
                };
                targetPropertyUpdated = true;
                break;
            }
        }
        
        // If no property was updated, log a warning
        if (!targetPropertyUpdated) {
            console.warn(`Could not determine which property needs the resolved target for effect type: ${effect.type}`);
            return false;
        }
        
        // Check if there are still unresolved targets that need selection
        for (const requirement of requirements) {
            const currentTarget = resolvedEffect[requirement.targetProperty];
            const target = requirement.target;
            
            // Check if this requirement is still unresolved and needs selection
            if (target && typeof target === 'object' 
                && (target.type === 'single-choice' || target.type === 'multi-choice')
                && (!currentTarget || currentTarget.type !== 'resolved')) {
                /*
                 * There's still another target that needs selection
                 * Set up pending selection for the next target
                 */
                const pendingSelection: PendingTargetSelection = {
                    selectionType: 'target',
                    effect: resolvedEffect,
                    originalContext,
                };
                controllers.turnState.setPendingSelection(pendingSelection);
                return true; // Indicate that a new pending selection was set up
            }
        }
        
        // All targets are resolved, apply the effect
        handler.apply(controllers, resolvedEffect, originalContext);
        
        return false; // Indicate that no new pending selection was set up
    }

    /**
     * Check if an effect can be applied.
     * Updated to be HandlerData-primary for validation.
     * First checks if all required targets are available, then calls the handler's canApply method.
     * 
     * @param effect The effect to check
     * @param handlerData HandlerData view
     * @param context Effect context
     * @returns True if the effect can be applied, false otherwise
     */
    static canApplyEffect(effect: Effect, handlerData: HandlerData, context: EffectContext, cardRepository: CardRepository): boolean {
        // Get the handler for this effect type with proper type safety
        const handler = effectHandlers[effect.type] as EffectHandler<typeof effect>;
        
        if (!handler) {
            console.warn(`No handler found for effect type: ${effect.type}`);
            return false;
        }
        
        // First, check if all required targets are available
        const requirements = handler.getResolutionRequirements(effect);
        
        // If there are requirements, check if all required targets are available
        if (requirements.length > 0) {
            for (const requirement of requirements) {
                if (requirement.required && !TargetResolver.isTargetAvailable(requirement.target, handlerData, context, cardRepository)) {
                    return false;
                }
            }
        }
        
        // If all required targets are available, then check if the handler has additional validation
        if (handler.canApply) {
            return handler.canApply(handlerData, effect, context, cardRepository);
        }
        
        // If no additional validation is needed, the effect can be applied
        return true;
    }

    /**
     * Check if an effect requires target selection.
     * 
     * @param effect The effect to check
     * @param context Effect context
     * @returns True if the effect requires target selection, false otherwise
     */
    static requiresTargetSelection(effect: Effect, context: EffectContext): boolean {
        // Get the handler for this effect type with proper type safety
        const handler = effectHandlers[effect.type] as EffectHandler<typeof effect>;
        
        if (!handler) {
            console.warn(`No handler found for effect type: ${effect.type}`);
            return false;
        }
        
        // Get resolution requirements from handler
        const requirements = handler.getResolutionRequirements(effect);
        
        // Check if any target requires selection
        for (const requirement of requirements) {
            if (TargetResolver.requiresTargetSelection(requirement.target, context)) {
                return true;
            }
        }
        
        return false;
    }
}
