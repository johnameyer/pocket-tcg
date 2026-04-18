import { Controllers } from '../controllers/controllers.js';
import { HandlerData } from '../game-handler.js';
import { Effect } from '../repository/effect-types.js';
import { ResolvedFieldTarget } from '../repository/targets/field-target.js';
import { EnergyTarget } from '../repository/targets/energy-target.js';
import { ControllerUtils } from '../utils/controller-utils.js';
import { CardRepository } from '../repository/card-repository.js';
import { EffectContext } from './effect-context.js';
import { PendingCardSelection, PendingEnergySelection, PendingFieldSelection } from './pending-selection-types.js';
import { ResolutionRequirement, EffectHandler } from './interfaces/effect-handler-interface.js';
import { effectHandlers } from './handlers/effect-handlers-map.js';
import { FieldTargetResolver, SingleTargetResolutionResult, TargetResolutionResult } from './target-resolvers/field-target-resolver.js';
import { EnergyTargetResolver, EnergyOption, ResolvedMultiEnergyTarget } from './target-resolvers/energy-target-resolver.js';
import { GameCard } from '../controllers/card-types.js';

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

            /*
             * Stop processing further effects if a pending selection was set up by the handler.
             * Some effects (e.g. choice-delegation) require player input before subsequent effects
             * can be applied. The state machine's pending selection loop will resume execution
             * after the player responds.
             */
            if (controllers.turnState.getPendingSelection()) {
                return;
            }
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
            const target = requirement.target;
            let resolvedTarget: ResolvedFieldTarget | ResolvedMultiEnergyTarget | undefined;
            
            /*
             * Check if this is an EnergyTarget (has fieldTarget, count, and type='field') or FieldTarget
             * EnergyTarget has a 'count' property that FieldTarget doesn't have
             */
            if (target && typeof target === 'object' && 'fieldTarget' in target && 'count' in target) {
                // This is an EnergyTarget - use EnergyTargetResolver
                const energyTarget = target as unknown as EnergyTarget;
                
                /*
                 * Check if selection is needed (EnergyTargetResolver handles inner fieldTarget resolution)
                 * TODO: Implement handleTargetSelection for EnergyTargetResolver if needed
                 */
                
                const resolution = EnergyTargetResolver.resolveTarget(energyTarget, controllers, context);
                
                if (resolution.type === 'requires-selection') {
                    // Prompt the player to choose which creature(s) to take energy from
                    const pendingEnergySelection: PendingEnergySelection = {
                        selectionType: 'energy',
                        effect,
                        originalContext: context,
                        playerId: context.sourcePlayer,
                        count: 1,
                        availableEnergy: resolution.availableTargets,
                    };
                    controllers.turnState.setPendingSelection(pendingEnergySelection);
                    return null;
                }
                
                if (resolution.type === 'no-valid-targets') {
                    if (requirement.required) {
                        return null; // No valid targets for required property
                    }
                    resolvedTarget = undefined;
                } else {
                    // Resolved (always ResolvedMultiEnergyTarget)
                    resolvedTarget = resolution as ResolvedMultiEnergyTarget;
                }
            } else {
                /*
                 * This is a FieldTarget - use FieldTargetResolver
                 * Check if this target needs selection
                 */
                if (FieldTargetResolver.handleTargetSelection(controllers, effect, context, target)) {
                    return null; // Pending selection
                }
                
                // Determine if this is a single or multi target
                if (!target) {
                    // No target specified
                    resolvedTarget = undefined;
                } else if (target.type === 'all-matching' || target.type === 'multi-choice') {
                    // Multi-target: use resolveTarget and convert to array
                    const resolution = FieldTargetResolver.resolveTarget(target, controllers, context);
                    resolvedTarget = this.convertResolutionToResolvedTargets(resolution, context);
                } else {
                    // Single target (fixed, single-choice, or resolved): use resolveSingleTarget
                    const resolution = FieldTargetResolver.resolveSingleTarget(target, controllers, context);
                    resolvedTarget = this.convertSingleResolutionToResolvedTarget(resolution, context);
                }
                
                if (!resolvedTarget && requirement.required) {
                    return null; // No valid targets for required property
                }
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
    ): ResolvedFieldTarget | undefined {
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
            
            case 'no-valid-targets':
                // No valid targets found - effect cannot be applied
                return undefined;
                
            case 'requires-selection':
                throw new Error('requires-selection encountered in resolution phase (should have been captured by selection phase)');
                
            default:
                throw new Error(`Unexpected resolution type: ${(resolution as { type?: string }).type ?? resolution}`);
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
    ): ResolvedFieldTarget {
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
            
            case 'no-valid-targets':
                // No valid targets - return empty resolved target
                return {
                    type: 'resolved',
                    targets: [],
                };
                
            case 'requires-selection':
                // This shouldn't reach here - requires-selection needs handler input
                throw new Error('requires-selection encountered in resolution phase (should have been captured by selection phase)');
                
            default:
                throw new Error(`Unexpected resolution type: ${(resolution as { type?: string }).type ?? resolution}`);
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
    static resumeEffectWithSelection(controllers: Controllers, pendingSelection: PendingFieldSelection, targetPlayerId: number, targetCreatureIndex: number): boolean {
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
                 * There's still another target that needs selection.
                 * Compute available targets for the next pending selection so handlers
                 * don't have to re-run resolution themselves.
                 */
                const nextResolution = FieldTargetResolver.resolveTarget(target, controllers, originalContext);
                const nextAvailableTargets = nextResolution.type === 'requires-selection'
                    ? nextResolution.availableTargets
                    : [];
                const pendingSelection: PendingFieldSelection = {
                    selectionType: 'field',
                    effect: resolvedEffect,
                    originalContext,
                    count: 1,
                    availableTargets: nextAvailableTargets,
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
                if (requirement.required && !FieldTargetResolver.isTargetAvailable(requirement.target, handlerData, context, cardRepository)) {
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
            if (FieldTargetResolver.requiresTargetSelection(requirement.target, context)) {
                return true;
            }
        }
        
        return false;
    }

    /**
     * Resume an effect after a card selection has been made by the player.
     * Dispatches to the appropriate handler's resumeWithCardSelection method.
     * Template IDs are resolved to concrete card instances by consuming the first
     * matching available card for each template ID (handles duplicate cards correctly).
     * 
     * @param controllers Game controllers
     * @param pendingSelection The pending card selection
     * @param selectedCardTemplateIds The template IDs of the cards selected by the player
     */
    static resumeEffectWithCardSelection(
        controllers: Controllers,
        pendingSelection: PendingCardSelection,
        selectedCardTemplateIds: string[],
    ): void {
        const { effect, originalContext, availableCards } = pendingSelection;
        const handler = effectHandlers[effect.type] as EffectHandler<typeof effect>;

        if (!handler?.resumeWithCardSelection) {
            console.warn(`Handler for effect type '${effect.type}' does not support card selection resume`);
            return;
        }

        // Resolve each template ID to a concrete card instance, consuming duplicates in order
        const remaining = [ ...availableCards ];
        const selectedCards = selectedCardTemplateIds.map(templateId => {
            const idx = remaining.findIndex(card => card.templateId === templateId);
            if (idx === -1) {
                return undefined;
            }
            return remaining.splice(idx, 1)[0];
        }).filter((card): card is GameCard => card !== undefined);

        handler.resumeWithCardSelection(controllers, effect, selectedCards, originalContext);
    }

    /**
     * Resume an effect after an energy selection has been made by the player.
     * Resolves the selected EnergyOptions into a ResolvedMultiEnergyTarget and
     * re-runs the effect with the resolved energy.
     * 
     * @param controllers Game controllers
     * @param pendingSelection The pending energy selection
     * @param selectedTargets The creatures selected by the player (playerId + fieldIndex)
     */
    static resumeEffectWithEnergySelection(
        controllers: Controllers,
        pendingSelection: PendingEnergySelection,
        selectedTargets: Array<{ playerId: number; fieldIndex: number }>,
    ): void {
        const { effect, originalContext, availableEnergy } = pendingSelection;
        const handler = effectHandlers[effect.type] as EffectHandler<typeof effect>;

        if (!handler) {
            console.warn(`No handler found for effect type: ${effect.type}`);
            return;
        }

        // Build ResolvedMultiEnergyTarget from the selected EnergyOptions
        const resolvedTargets = selectedTargets
            .map(sel => availableEnergy.find(opt => opt.playerId === sel.playerId && opt.fieldIndex === sel.fieldIndex))
            .filter((opt): opt is EnergyOption => opt !== undefined)
            .map(opt => ({
                playerId: opt.playerId,
                fieldIndex: opt.fieldIndex,
                energy: opt.availableEnergy,
            }));

        const resolvedEnergy: ResolvedMultiEnergyTarget = {
            type: 'resolved-multi',
            targets: resolvedTargets,
        };

        // Find the EnergyTarget property name and replace with resolved value
        const requirements = handler.getResolutionRequirements(effect);
        /*
         * TODO: Replace deep copy hack with proper effect cloning mechanism
         * Deep copy the effect to avoid modifying the original
         */
        let resolvedEffect = JSON.parse(JSON.stringify(effect));
        for (const requirement of requirements) {
            const target = requirement.target;
            if (target && typeof target === 'object' && 'fieldTarget' in target && 'count' in target) {
                resolvedEffect = {
                    ...resolvedEffect,
                    [requirement.targetProperty]: resolvedEnergy,
                };
                break;
            }
        }

        handler.apply(controllers, resolvedEffect, originalContext);
    }
}
