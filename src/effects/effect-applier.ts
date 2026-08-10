import { Controllers } from '../controllers/controllers.js';
import { HandlerData } from '../game-handler.js';
import { Effect } from '../repository/effect-types.js';
import { FieldTarget, ResolvedFieldTarget, SingleFieldTarget } from '../repository/targets/field-target.js';
import { ResolvedCardTarget } from '../repository/targets/card-target.js';
import { ResolvedChoiceTarget } from '../repository/targets/choice-target.js';
import { AttachableEnergyType } from '../repository/energy-types.js';
import { ControllerUtils } from '../utils/controller-utils.js';
import { CardRepository } from '../repository/card-repository.js';
import { GameCard } from '../controllers/card-types.js';
import { EffectContext } from './effect-context.js';
import { PendingCardSelection, PendingChoiceSelection, PendingEnergySelection, PendingFieldSelection } from './pending-selection-types.js';
import { ResolutionRequirement, EffectHandler, isEnergyResolutionTarget, isCardResolutionTarget, isChoiceResolutionTarget } from './interfaces/effect-handler-interface.js';
import { effectHandlers } from './handlers/effect-handlers-map.js';
import { FieldTargetResolver, SingleTargetResolutionResult, TargetResolutionResult } from './target-resolvers/field-target-resolver.js';
import { EnergyTargetResolver, EnergyOption, ResolvedMultiEnergyTarget } from './target-resolvers/energy-target-resolver.js';
import { CardTargetResolver } from './target-resolvers/card-target-resolver.js';
import { ChoiceTargetResolver } from './target-resolvers/choice-target-resolver.js';
import { EffectQueueProcessor } from './effect-queue-processor.js';

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

        for (let effectIndex = 0; effectIndex < effects.length; effectIndex++) {
            const effect = effects[effectIndex];
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

            /*
             * If this effect pauses on a player selection (e.g. its target needs a choice), the
             * remaining effects in this list must ride along as continuationEffects so they resume
             * after the selection resolves - otherwise the natural for-loop below never reaches them,
             * since a pause returns out of this function entirely. Harmless to compute unconditionally:
             * it's only ever consumed at the point a pending selection is actually created (see the
             * `context.selectionContinuationEffects` reads across effect-applier.ts/field-target-resolver.ts),
             * so effects that resolve immediately are unaffected - the for-loop just continues as before.
             */
            const continuationEffects = effectIndex < effects.length - 1
                ? effects.slice(effectIndex + 1)
                : undefined;

            // Get resolution requirements from handler
            const requirements = handler.getResolutionRequirements(effect);

            // Handle resolution for all requirements
            const effectContext = continuationEffects && continuationEffects.length > 0
                ? { ...context, selectionContinuationEffects: continuationEffects }
                : context;
            const resolvedEffect = this.resolveEffectRequirements(effect, requirements, controllers, effectContext);
            if (!resolvedEffect) {
                // Pending selection or no valid targets
                return;
            }

            // Apply effect directly - handlers are responsible for their own multi-target logic
            handler.apply(controllers, resolvedEffect, effectContext);

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
        const resolvedEffect = JSON.parse(JSON.stringify(effect));

        const result = this.resolveFrom(requirements, resolvedEffect, {}, 0, controllers, context);
        return result ? result.effect : null;
    }

    /**
     * Resolves requirements[startIndex..] in order, mutating an accumulator effect and a
     * `resolved` map (targetProperty -> resolved value) as it goes so that later requirements'
     * `filter` can see earlier ones via `dependsOn`. Shared by the initial resolution pass and
     * by both selection-resume paths (`resumeEffectWithSelection` / `resumeEffectWithCardSelection`)
     * so a chain of selections (e.g. evolution-skip's fieldBase -> handEvolution) can pause and
     * resume mid-way without re-deriving which requirement comes next.
     *
     * Returns null when a pending selection was set up (caller should stop) or when a required
     * target had no valid candidates. Otherwise returns the fully-resolved effect and resolved map.
     */
    private static resolveFrom(
        requirements: ResolutionRequirement[],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- resolvedEffect is a JSON.parse-produced plain object being built up property-by-property, same as the rest of this file
        resolvedEffect: any,
        resolved: Record<string, unknown>,
        startIndex: number,
        controllers: Controllers,
        context: EffectContext,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ): { effect: any; resolved: Record<string, unknown> } | null {
        for (let i = startIndex; i < requirements.length; i++) {
            const requirement = requirements[i];
            const target = requirement.target;
            let resolvedTarget: ResolvedFieldTarget | ResolvedMultiEnergyTarget | ResolvedCardTarget | ResolvedChoiceTarget | undefined;

            /*
             * Check if this is an EnergyTarget (type 'field' or 'discard'), a CardTarget, or a
             * FieldTarget. EnergyTarget's 'field'/'discard' discriminants never collide with the
             * others'; CardTarget vs FieldTarget is distinguished structurally by isCardResolutionTarget.
             */
            if (target && typeof target === 'object' && isEnergyResolutionTarget(target)) {
                // This is an EnergyTarget - use EnergyTargetResolver
                const energyTarget = target;

                /*
                 * Check if selection is needed (EnergyTargetResolver handles inner fieldTarget resolution)
                 * TODO: Implement handleTargetSelection for EnergyTargetResolver if needed
                 */

                const resolution = EnergyTargetResolver.resolveTarget(energyTarget, controllers, context);

                if (resolution.type === 'requires-selection') {
                    // Prompt the player to choose which creature(s) to take energy from
                    const pendingEnergySelection: PendingEnergySelection = {
                        selectionType: 'energy',
                        effect: resolvedEffect,
                        originalContext: context,
                        continuationEffects: context.selectionContinuationEffects,
                        playerId: context.sourcePlayer,
                        count: 1,
                        availableEnergy: resolution.availableTargets,
                        resolutionIndex: i,
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
            } else if (target && typeof target === 'object' && isChoiceResolutionTarget(target)) {
                // This is a ChoiceTarget - use ChoiceTargetResolver
                if (target.type === 'resolved') {
                    throw new Error('Encountered an already-resolved ChoiceTarget in resolveFrom - resolveTarget should have returned it directly');
                }
                const result = ChoiceTargetResolver.resolveTarget(target);

                if (result.type === 'requires-selection') {
                    const pendingChoiceSelection: PendingChoiceSelection = {
                        selectionType: 'choice',
                        effect: resolvedEffect,
                        originalContext: context,
                        continuationEffects: context.selectionContinuationEffects,
                        choices: result.availableChoices,
                        count: 1,
                        resolutionIndex: i,
                    };
                    controllers.turnState.setPendingSelection(pendingChoiceSelection);
                    return null;
                }

                if (result.type === 'no-valid-targets') {
                    if (requirement.required) {
                        return null;
                    }
                    resolvedTarget = undefined;
                } else {
                    resolvedTarget = result;
                }
            } else if (target && typeof target === 'object' && isCardResolutionTarget(target)) {
                // This is a CardTarget - use CardTargetResolver, honoring dependsOn/filter if present.
                if (target.type === 'resolved') {
                    throw new Error('Encountered an already-resolved CardTarget in resolveFrom - resolveTarget should have returned it directly');
                }
                const result = CardTargetResolver.resolveTarget(target, controllers, context, requirement.filter, resolved);

                if (result.type === 'requires-selection') {
                    const playerId = target.type === 'fixed'
                        ? (target.player === 'self' ? context.sourcePlayer : 1 - context.sourcePlayer)
                        : (target.chooser === 'self' ? context.sourcePlayer : 1 - context.sourcePlayer);
                    const pendingCardSelection: PendingCardSelection = {
                        selectionType: 'card',
                        effect: resolvedEffect,
                        originalContext: context,
                        continuationEffects: context.selectionContinuationEffects,
                        playerId,
                        location: target.location,
                        count: target.type === 'multi-choice' ? target.count : 1,
                        availableCards: result.availableCards,
                        resolutionIndex: i,
                    };
                    controllers.turnState.setPendingSelection(pendingCardSelection);
                    return null;
                }

                if (result.type === 'no-valid-targets') {
                    if (requirement.required) {
                        return null;
                    }
                    resolvedTarget = undefined;
                } else {
                    resolvedTarget = result;
                }
            } else if (requirement.filter) {
                /*
                 * Filtered FieldTarget resolution (evolution-skip's fieldBase): candidates are
                 * narrowed by requirement.filter before deciding auto-resolve vs. selection.
                 * Only single-choice is supported - see the dependsOn/filter TODO on ResolutionRequirement.
                 */
                if (!target || target.type !== 'single-choice') {
                    throw new Error(`Filtered field resolution requirement not supported for target type: ${target?.type}`);
                }
                const filterFn = requirement.filter;
                const options = FieldTargetResolver.getAvailableTargets(target, controllers, context)
                    .filter(option => {
                        const raw = controllers.field.getRawCardByPosition(option.playerId, option.fieldIndex);
                        return !!raw && filterFn(raw, resolved, controllers);
                    });

                if (options.length === 0) {
                    if (requirement.required) {
                        return null;
                    }
                    resolvedTarget = undefined;
                } else if (options.length === 1) {
                    resolvedTarget = {
                        type: 'resolved',
                        targets: [{ playerId: options[0].playerId, fieldIndex: options[0].fieldIndex }],
                    };
                } else {
                    const pendingFieldSelection: PendingFieldSelection = {
                        selectionType: 'field',
                        effect: resolvedEffect,
                        originalContext: context,
                        continuationEffects: context.selectionContinuationEffects,
                        count: 1,
                        availableTargets: options,
                        resolutionIndex: i,
                    };
                    controllers.turnState.setPendingSelection(pendingFieldSelection);
                    return null;
                }
            } else {
                /*
                 * This is a FieldTarget - use FieldTargetResolver
                 * Check if this target needs selection. Pass resolvedEffect (not the raw effect) so
                 * that any earlier requirement already resolved in this loop (e.g. a source that
                 * auto-resolved before this destination needed a player choice) isn't discarded.
                 */
                if (FieldTargetResolver.handleTargetSelection(controllers, resolvedEffect, context, target)) {
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
            resolved = {
                ...resolved,
                [requirement.targetProperty]: resolvedTarget,
            };
        }

        return { effect: resolvedEffect, resolved };
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
        _context: EffectContext,
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
        _context: EffectContext,
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
    static resumeEffectWithSelection(controllers: Controllers, pendingSelection: PendingFieldSelection, selectedTargets: Array<{ playerId: number; fieldIndex: number }>): boolean {
        const { effect, originalContext, selectionType: _selectionType = 'target' } = pendingSelection;
        const context = pendingSelection.continuationEffects && pendingSelection.continuationEffects.length > 0
            ? { ...originalContext, selectionContinuationEffects: pendingSelection.continuationEffects }
            : originalContext;

        /*
         * Target validation is now handled at the event handler level
         * If we reach here, the target is valid
         */

        // Create a resolved target from the selection (may contain multiple targets for multi-choice selections)
        const resolvedTarget = {
            type: 'resolved' as const,
            targets: selectedTargets,
        };

        // Get the handler for this effect type with proper type safety
        const handler = effectHandlers[effect.type] as EffectHandler<typeof effect>;
        if (!handler) {
            console.warn(`No handler found for effect type: ${effect.type}`);
            return false;
        }

        // Get resolution requirements from handler
        const requirements = handler.getResolutionRequirements(effect);

        if (pendingSelection.resolutionIndex !== undefined) {
            return this.resumeFromResolutionIndex(controllers, handler, requirements, effect, resolvedTarget, pendingSelection.resolutionIndex, context, originalContext, pendingSelection.continuationEffects);
        }

        /*
         * TODO: Replace deep copy hack with proper effect cloning mechanism
         * Create a deep copy of the effect
         */
        let resolvedEffect = JSON.parse(JSON.stringify(effect));

        // Find the first unresolved requirement that needs selection (in order)
        let targetPropertyUpdated = false;
        
        for (const requirement of requirements) {
            const currentTarget = resolvedEffect[requirement.targetProperty];
            const target = requirement.target;
            
            // Check if this requirement is unresolved and needs selection
            if (target && typeof target === 'object'
                && !isCardResolutionTarget(target)
                && !isChoiceResolutionTarget(target)
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
                && !isCardResolutionTarget(target)
                && !isChoiceResolutionTarget(target)
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
                    continuationEffects: originalContext.selectionContinuationEffects,
                    count: target.type === 'multi-choice' ? target.count : 1,
                    availableTargets: nextAvailableTargets,
                    allowRepeats: target.type === 'multi-choice' ? target.allowRepeats : undefined,
                };
                controllers.turnState.setPendingSelection(pendingSelection);
                return true; // Indicate that a new pending selection was set up
            }
        }
        
        // All targets are resolved, apply the effect
        handler.apply(controllers, resolvedEffect, context);

        if (controllers.turnState.getPendingSelection()) {
            return true;
        }

        if (pendingSelection.continuationEffects && pendingSelection.continuationEffects.length > 0) {
            controllers.effects.pushPendingEffect(pendingSelection.continuationEffects, originalContext);
            EffectQueueProcessor.processQueue(controllers);
            return !!controllers.turnState.getPendingSelection();
        }

        return false; // Indicate that no new pending selection was set up
    }

    /**
     * Shared resume path for selections created by the generic ResolutionRequirement pipeline
     * (i.e. `pendingSelection.resolutionIndex` is set - see `resolveFrom`). Writes the just-made
     * selection into the requirement at `resolutionIndex` and continues resolving any requirements
     * after it (which may themselves depend on it via `dependsOn`/`filter`, or need their own
     * player selection), applying the handler once everything is resolved.
     */
    private static resumeFromResolutionIndex(
        controllers: Controllers,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- handler is keyed generically across all effect types here
        handler: EffectHandler<any>,
        requirements: ResolutionRequirement[],
        effect: Effect,
        resolvedValue: ResolvedFieldTarget | ResolvedCardTarget | ResolvedChoiceTarget,
        resolutionIndex: number,
        context: EffectContext,
        originalContext: EffectContext,
        continuationEffects: Effect[] | undefined,
    ): boolean {
        /*
         * TODO: Replace deep copy hack with proper effect cloning mechanism
         * Create a deep copy of the effect
         */
        let resolvedEffect = JSON.parse(JSON.stringify(effect));
        resolvedEffect = {
            ...resolvedEffect,
            [requirements[resolutionIndex].targetProperty]: resolvedValue,
        };

        const resolved: Record<string, unknown> = {};
        for (let j = 0; j <= resolutionIndex; j++) {
            resolved[requirements[j].targetProperty] = resolvedEffect[requirements[j].targetProperty];
        }

        const result = this.resolveFrom(requirements, resolvedEffect, resolved, resolutionIndex + 1, controllers, context);
        if (!result) {
            return true; // A new pending selection was set up inside resolveFrom
        }

        handler.apply(controllers, result.effect, context);

        if (controllers.turnState.getPendingSelection()) {
            return true;
        }

        if (continuationEffects && continuationEffects.length > 0) {
            controllers.effects.pushPendingEffect(continuationEffects, originalContext);
            EffectQueueProcessor.processQueue(controllers);
            return !!controllers.turnState.getPendingSelection();
        }

        return false;
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
                const isAvailable = isEnergyResolutionTarget(requirement.target)
                    ? EnergyTargetResolver.isTargetAvailable(requirement.target, handlerData, context, cardRepository)
                    : isCardResolutionTarget(requirement.target)
                        ? CardTargetResolver.isTargetAvailable(requirement.target, handlerData, context, cardRepository)
                        : isChoiceResolutionTarget(requirement.target)
                            ? ChoiceTargetResolver.isTargetAvailable(requirement.target, handlerData)
                            : FieldTargetResolver.isTargetAvailable(requirement.target, handlerData, context, cardRepository);
                if (requirement.required && !isAvailable) {
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
            if (isCardResolutionTarget(requirement.target)) {
                if (requirement.target.type === 'single-choice' || requirement.target.type === 'multi-choice') {
                    return true;
                }
                continue;
            }
            if (isChoiceResolutionTarget(requirement.target)) {
                if (requirement.target.type === 'single-choice' && requirement.target.choices.length > 1) {
                    return true;
                }
                continue;
            }
            const innerTarget = isEnergyResolutionTarget(requirement.target)
                ? (requirement.target.type === 'field' ? requirement.target.fieldTarget : undefined)
                : requirement.target;
            if (FieldTargetResolver.requiresTargetSelection(innerTarget, context)) {
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
        const context = pendingSelection.continuationEffects && pendingSelection.continuationEffects.length > 0
            ? { ...originalContext, selectionContinuationEffects: pendingSelection.continuationEffects }
            : originalContext;
        const handler = effectHandlers[effect.type] as EffectHandler<typeof effect>;

        if (!handler) {
            console.warn(`No handler found for effect type: ${effect.type}`);
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

        if (pendingSelection.resolutionIndex !== undefined) {
            const requirements = handler.getResolutionRequirements(effect);
            const resolvedCardTarget: ResolvedCardTarget = {
                type: 'resolved',
                cards: selectedCards.map(card => ({ instanceId: card.instanceId })),
            };
            this.resumeFromResolutionIndex(controllers, handler, requirements, effect, resolvedCardTarget, pendingSelection.resolutionIndex, context, originalContext, pendingSelection.continuationEffects);
            return;
        }

        if (!handler.resumeWithCardSelection) {
            console.warn(`Handler for effect type '${effect.type}' does not support card selection resume`);
            return;
        }

        handler.resumeWithCardSelection(controllers, effect, selectedCards, context);

        if (!controllers.turnState.getPendingSelection() && pendingSelection.continuationEffects && pendingSelection.continuationEffects.length > 0) {
            controllers.effects.pushPendingEffect(pendingSelection.continuationEffects, originalContext);
            EffectQueueProcessor.processQueue(controllers);
        }
    }

    /**
     * Resume an effect after a named choice has been made by the player (e.g.
     * choice-delegation). Writes the selected value into the requirement at
     * `pendingSelection.resolutionIndex` and continues resolution via `resumeFromResolutionIndex`,
     * exactly mirroring `resumeEffectWithCardSelection`'s resolutionIndex-based path.
     *
     * @param controllers Game controllers
     * @param pendingSelection The pending choice selection
     * @param selectedValue The value of the choice selected by the player
     */
    static resumeEffectWithChoiceSelection(
        controllers: Controllers,
        pendingSelection: PendingChoiceSelection,
        selectedValue: string,
    ): void {
        const { effect, originalContext } = pendingSelection;
        const context = pendingSelection.continuationEffects && pendingSelection.continuationEffects.length > 0
            ? { ...originalContext, selectionContinuationEffects: pendingSelection.continuationEffects }
            : originalContext;
        const handler = effectHandlers[effect.type] as EffectHandler<typeof effect>;

        if (!handler) {
            console.warn(`No handler found for effect type: ${effect.type}`);
            return;
        }

        if (pendingSelection.resolutionIndex === undefined) {
            console.warn(`Handler for effect type '${effect.type}' does not support resolutionIndex-based choice selection resume`);
            return;
        }

        const requirements = handler.getResolutionRequirements(effect);
        const resolvedChoiceTarget: ResolvedChoiceTarget = {
            type: 'resolved',
            value: selectedValue,
        };
        this.resumeFromResolutionIndex(controllers, handler, requirements, effect, resolvedChoiceTarget, pendingSelection.resolutionIndex, context, originalContext, pendingSelection.continuationEffects);
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
        selectedTargets: Array<{ playerId: number; fieldIndex: number; energyType?: AttachableEnergyType }>,
    ): void {
        const { effect, originalContext, availableEnergy } = pendingSelection;
        const context = pendingSelection.continuationEffects && pendingSelection.continuationEffects.length > 0
            ? { ...originalContext, selectionContinuationEffects: pendingSelection.continuationEffects }
            : originalContext;
        const handler = effectHandlers[effect.type] as EffectHandler<typeof effect>;

        if (!handler) {
            console.warn(`No handler found for effect type: ${effect.type}`);
            return;
        }

        // Build ResolvedMultiEnergyTarget from the selected EnergyOptions.
        // Options are matched by (playerId, fieldIndex, energyType) since type-choice options
        // (e.g. picking which energy type to take from the discard pile) can share the same
        // playerId/fieldIndex and differ only by energyType.
        const resolvedTargets = selectedTargets
            .map(sel => availableEnergy.find(opt => opt.playerId === sel.playerId && opt.fieldIndex === sel.fieldIndex && opt.energyType === sel.energyType))
            .filter((opt): opt is EnergyOption => opt !== undefined)
            .map(opt => ({
                playerId: opt.playerId,
                fieldIndex: opt.fieldIndex,
                location: opt.location,
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
        // Set when another requirement (e.g. the destination field target) also needs player input;
        // resolution is deferred to a follow-up PendingFieldSelection instead of applying immediately.
        let pendingFieldRequirement: { targetProperty: string; target: FieldTarget } | undefined;

        for (const requirement of requirements) {
            const target = requirement.target;
            if (target && typeof target === 'object' && ((target as { type?: string }).type === 'field' || (target as { type?: string }).type === 'discard')) {
                resolvedEffect = {
                    ...resolvedEffect,
                    [requirement.targetProperty]: resolvedEnergy,
                };
            } else if (target && typeof target === 'object' && (target as { type?: string }).type === 'fixed') {
                // Resolve fixed field targets before apply() so handler receives 'resolved' type
                const resolution = FieldTargetResolver.resolveSingleTarget(target as SingleFieldTarget, controllers, context);
                if (resolution && resolution.type === 'resolved') {
                    resolvedEffect = {
                        ...resolvedEffect,
                        [requirement.targetProperty]: resolution,
                    };
                }
            } else if (target && typeof target === 'object'
                && ((target as FieldTarget).type === 'single-choice' || (target as FieldTarget).type === 'multi-choice' || (target as FieldTarget).type === 'all-matching')) {
                // Another (destination) target also needs resolving now that the source is known
                const resolution = FieldTargetResolver.resolveTarget(target as FieldTarget, controllers, context);
                if (resolution.type === 'requires-selection') {
                    pendingFieldRequirement = { targetProperty: requirement.targetProperty, target: target as FieldTarget };
                } else {
                    resolvedEffect = {
                        ...resolvedEffect,
                        [requirement.targetProperty]: this.convertResolutionToResolvedTargets(resolution, context),
                    };
                }
            }
        }

        if (pendingFieldRequirement) {
            const resolution = FieldTargetResolver.resolveTarget(pendingFieldRequirement.target, controllers, context);
            const nextAvailableTargets = resolution.type === 'requires-selection' ? resolution.availableTargets : [];
            const nextCount = pendingFieldRequirement.target.type === 'multi-choice' ? pendingFieldRequirement.target.count : 1;
            const nextAllowRepeats = pendingFieldRequirement.target.type === 'multi-choice' ? pendingFieldRequirement.target.allowRepeats : undefined;
            const nextPendingSelection: PendingFieldSelection = {
                selectionType: 'field',
                effect: resolvedEffect,
                originalContext,
                continuationEffects: pendingSelection.continuationEffects,
                count: nextCount,
                availableTargets: nextAvailableTargets,
                allowRepeats: nextAllowRepeats,
            };
            controllers.turnState.setPendingSelection(nextPendingSelection);
            return;
        }

        handler.apply(controllers, resolvedEffect, context);

        if (!controllers.turnState.getPendingSelection() && pendingSelection.continuationEffects && pendingSelection.continuationEffects.length > 0) {
            controllers.effects.pushPendingEffect(pendingSelection.continuationEffects, originalContext);
            EffectQueueProcessor.processQueue(controllers);
        }
    }
}
