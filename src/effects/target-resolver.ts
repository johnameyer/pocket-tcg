import { Controllers } from '../controllers/controllers.js';
import { Effect } from '../repository/effect-types.js';
import { Target, FixedTarget, TargetCriteria, SingleTarget, ResolvedTarget } from '../repository/target-types.js';
import { CardRepository } from '../repository/card-repository.js';
import { HandlerData } from '../game-handler.js';
<<<<<<< HEAD
import { FieldCard } from '../controllers/field-controller.js';
=======
import { FieldCard } from "../controllers/field-controller.js";
import { PendingTargetSelection } from './pending-selection-types.js';
>>>>>>> ed465c3 (Add new selection types, handler methods, and response messages)
import { ControllerUtils } from '../utils/controller-utils.js';
import { toFieldCard, getCurrentInstanceId } from '../utils/field-card-utils.js';
import { ConditionEvaluator } from './condition-evaluator.js';
import { EffectContext } from './effect-context.js';

/**
 * Result of target resolution, indicating whether a target was resolved,
 * requires selection, or has no valid targets.
 */
export type TargetResolutionResult = 
    | ResolvedTarget // Using the new ResolvedTarget interface
    | { type: 'requires-selection', availableTargets: TargetOption[] }
    | { type: 'no-valid-targets' }
    | { type: 'auto-resolved', playerId: number, fieldIndex: number } // For source-creature targeting cases
    | { type: 'all-matching', targets: { playerId: number, fieldIndex: number }[] }; // For all-matching targets

/**
 * Represents a target option for user selection.
 */
export interface TargetOption {
    playerId: number;
    fieldIndex: number;
    name: string;
    hp: number;
    position: 'active' | 'bench';
}

/**
 * Result of single target resolution, excluding multi-target results.
 */
export type SingleTargetResolutionResult = 
    | ResolvedTarget // Using the new ResolvedTarget interface
    | { type: 'requires-selection', availableTargets: TargetOption[] }
    | { type: 'no-valid-targets' }
    | { type: 'auto-resolved', playerId: number, fieldIndex: number };

/**
 * Centralized class for handling all target resolution logic.
 * This eliminates scattered special-case handling and provides a consistent
 * interface for resolving targets across all effect implementations.
 */
export class TargetResolver {
    /**
     * Resolves a target, handling all cases: fixed, choice, and special cases.
     * Returns a resolution result indicating what action to take.
     * 
     * @param target The target to resolve
     * @param controllers Game controllers
     * @param context Effect context
     * @returns A TargetResolutionResult indicating how the target was resolved
     */
    /**
     * Resolves a single target (FixedTarget or SingleChoiceTarget).
     * This method is specifically for effects that expect exactly one target,
     * and will never return an 'all-matching' result.
     * 
     * @param target The single target to resolve
     * @param controllers Game controllers
     * @param context Effect context
     * @returns A SingleTargetResolutionResult indicating how the target was resolved
     */
    static resolveSingleTarget(
        target: SingleTarget | undefined,
        controllers: Controllers,
        context: EffectContext,
    ): SingleTargetResolutionResult {
        // Use the general resolveTarget method but ensure we don't get an 'all-matching' result
        const result = this.resolveTarget(target, controllers, context);
        
        // Filter out 'all-matching' results which shouldn't happen with SingleTarget input
        if (result.type === 'all-matching') {
            // If there are targets, return the first one as a resolved target
            if (result.targets.length > 0) {
                return {
                    type: 'resolved',
                    targets: [{
                        playerId: result.targets[0].playerId,
                        fieldIndex: result.targets[0].fieldIndex,
                    }],
                };
            }
            // If no targets, return no-valid-targets
            return { type: 'no-valid-targets' };
        }
        
        return result;
    }

    static resolveTarget(
        target: Target | undefined,
        controllers: Controllers,
        context: EffectContext,
    ): TargetResolutionResult {
        // If no target, can't resolve
        if (!target) {
            return { type: 'no-valid-targets' };
        }
        
        // Handle all-matching targets
        if (target.type === 'all-matching') {
            const matchingTargets: { playerId: number, fieldIndex: number }[] = [];
            const criteria = target.criteria;
            
            // Determine which players to check based on criteria
            const playerIds: number[] = [];
            if (!criteria.player || criteria.player === 'self') {
                playerIds.push(context.sourcePlayer);
            }
            if (!criteria.player || criteria.player === 'opponent') {
                playerIds.push(1 - context.sourcePlayer);
            }
            
            // Find all matching creature
            for (const playerId of playerIds) {
                // Get all creature (active and benched)
                const handlerData = ControllerUtils.createPlayerView(controllers, context.sourcePlayer);
                const allCreatures = controllers.field.getCards(playerId) || [];
                
                for (let fieldIndex = 0; fieldIndex < allCreatures.length; fieldIndex++) {
                    const creature = allCreatures[fieldIndex];
                    if (creature && TargetResolver.creatureMatchesCriteria(creature, criteria, handlerData, controllers.cardRepository.cardRepository, fieldIndex)) {
                        matchingTargets.push({ playerId, fieldIndex });
                    }
                }
            }
            
            if (matchingTargets.length === 0) {
                return { type: 'no-valid-targets' };
            }
            
            return { type: 'all-matching', targets: matchingTargets };
        }
        
        // If targetPlayerId and targetCreatureIndex are provided in the context, use them directly
        if (context.targetPlayerId !== undefined && context.targetCreatureIndex !== undefined) {
            return { 
                type: 'resolved', 
                targets: [{
                    playerId: context.targetPlayerId, 
                    fieldIndex: context.targetCreatureIndex, 
                }],
            };
        }
        
        // Handle fixed targets
        if (target.type === 'fixed') {
            // If playerId and fieldIndex are already set, use them directly
            if ('playerId' in target 
                && typeof target.playerId === 'number' 
                && 'fieldIndex' in target 
                && typeof target.fieldIndex === 'number') {
                return { 
                    type: 'resolved', 
                    targets: [{
                        playerId: target.playerId, 
                        fieldIndex: target.fieldIndex, 
                    }],
                };
            }
            
            // Resolve based on player and position
            const playerId = target.player === 'self' ? context.sourcePlayer : 1 - context.sourcePlayer;
            let fieldIndex: number;
            
            if (target.position === 'active') {
                fieldIndex = 0;
            } else if (target.position === 'source') {
                // For source targeting, determine position based on context type
                if (context.type === 'ability') {
                    fieldIndex = context.fieldPosition;
                } else if (context.type === 'attack') {
                    // Attacks are always from active creature
                    fieldIndex = 0;
                } else if (context.type === 'trigger') {
                    // For triggers, find the field position of the creature that has the trigger
                    const allCreatures = controllers.field.getCards(playerId) || [];
                    fieldIndex = allCreatures.findIndex(creature => creature?.instanceId === context.creatureInstanceId);
                    if (fieldIndex === -1) {
                        throw new Error(`Trigger source creature not found: ${context.creatureInstanceId}`);
                    }
                } else {
                    throw new Error(`Source targeting not supported for context type: ${context.type}`);
                }
            } else {
                fieldIndex = 0; // Default to active
            }
            
            return {
                type: 'resolved',
                targets: [{
                    playerId,
                    fieldIndex,
                }],
            };
        }
        
        // For choice targets, check if there are valid targets
        const availableTargets = this.getAvailableTargets(target, controllers, context);
        
        if (availableTargets.length === 0) {
            return { type: 'no-valid-targets' };
        }
        
        /*
         * If there's only one valid target and it's a single-choice target, auto-resolve as resolved
         * But don't auto-resolve for bench damage effects to ensure explicit targeting
         */
        if (availableTargets.length === 1 && target.type === 'single-choice') {
            // Special case for bench damage effects - require explicit selection
            if ('criteria' in target 
                && target.criteria 
                && target.criteria.position === 'bench'
                && context.effectName.includes('damage')) {
                
                // Return requires-selection to force the user to explicitly select the bench creature
                return {
                    type: 'requires-selection',
                    availableTargets,
                };
            }
            
            return {
                type: 'resolved',
                targets: [{
                    playerId: availableTargets[0].playerId,
                    fieldIndex: availableTargets[0].fieldIndex,
                }],
            };
        }
        
        // Otherwise, requires selection
        return {
            type: 'requires-selection',
            availableTargets,
        };
    }
    
    /**
     * Gets all available target options for user selection.
     * 
     * @param target The target specification
     * @param controllers Game controllers
     * @param context Effect context
     * @returns Array of available target options
     */
    static getAvailableTargets(
        target: Target,
        controllers: Controllers,
        context: EffectContext,
    ): TargetOption[] {
        const availableTargets: TargetOption[] = [];
        
        // Handle single-choice and multi-choice targets
        if (target.type === 'single-choice' || target.type === 'multi-choice') {
            const chooserId = target.chooser === 'self' ? context.sourcePlayer : 1 - context.sourcePlayer;
            const criteria = target.criteria;
            
            if (criteria.location === 'field') {
                const playerIds = [];
                
                if (!criteria.player || criteria.player === 'self') {
                    playerIds.push(context.sourcePlayer);
                }
                
                if (!criteria.player || criteria.player === 'opponent') {
                    playerIds.push(1 - context.sourcePlayer);
                }
                
                // Create HandlerData view for accessing creature
                const handlerData = ControllerUtils.createPlayerView(controllers, context.sourcePlayer);
                
                for (const playerId of playerIds) {
                    // Get all creature for this player
                    const allCreatures = controllers.field.getCards(playerId) || [];
                    
                    for (let fieldIndex = 0; fieldIndex < allCreatures.length; fieldIndex++) {
                        const creature = allCreatures[fieldIndex];
                        
                        // Skip if no creature at this position
                        if (!creature) {
                            continue;
                        }
                        
                        // Skip active creature if position is explicitly set to 'bench'
                        if (target.criteria?.position === 'bench' && fieldIndex === 0) {
                            continue;
                        }
                        
                        // Skip bench creature if position is explicitly set to 'active'
                        if (target.criteria?.position === 'active' && fieldIndex > 0) {
                            continue;
                        }
                        
                        // Check if creature matches criteria
                        if (TargetResolver.creatureMatchesCriteria(creature, target.criteria, handlerData, controllers.cardRepository.cardRepository, fieldIndex)) {
                            const creatureData = controllers.cardRepository.getCreature(creature.templateId);
                            availableTargets.push({
                                playerId,
                                fieldIndex,
                                name: creatureData.name,
                                hp: Math.max(0, creatureData.maxHp - creature.damageTaken),
                                position: fieldIndex === 0 ? 'active' : 'bench',
                            });
                        }
                    }
                }
            }
        }
        
        return availableTargets;
    }

    /**
     * Checks if a target is available for selection.
     * This method is purely about target availability, not effect-specific validation.
     * 
     * @param target The target to check
     * @param handlerData HandlerData view
     * @param context Effect context
     * @returns True if the target is available, false otherwise
     */
    static isTargetAvailable(
        target: Target | undefined,
        handlerData: HandlerData,
        context: EffectContext,
        cardRepository: CardRepository,
        validationFn?: (creature: FieldCard, handlerData: HandlerData) => boolean,
    ): boolean {
        // Check if the target exists
        if (!target) {
            return false;
        }
        
        // Use validation function if provided to check if any matching creature pass the validation
        if (validationFn) {
            return this.hasValidTargetsWithValidation(target, handlerData, context, cardRepository, validationFn);
        }
        
        // Default behavior: check if target has any matching creature
        return this.hasValidTargets(target, handlerData, context, cardRepository);
    }
    
    /**
     * Check if a target has valid creature that pass the validation function.
     */
    private static hasValidTargetsWithValidation(
        target: Target,
        handlerData: HandlerData,
        context: EffectContext,
        cardRepository: CardRepository,
        validationFn: (creature: FieldCard, handlerData: HandlerData) => boolean,
    ): boolean {
        // Handle different target types
        if (target.type === 'all-matching' || target.type === 'single-choice') {
            const criteria = target.criteria;
            
            // Determine which players to check based on criteria
            const playerIds = [];
            if (!criteria.player || criteria.player === 'self') {
                playerIds.push(context.sourcePlayer);
            }
            if (!criteria.player || criteria.player === 'opponent') {
                playerIds.push(1 - context.sourcePlayer);
            }
            
            // Check if any creature matches criteria AND passes validation
            for (const playerId of playerIds) {
                const allCreatures = handlerData.field.creatures[playerId] || [];
                
                for (let fieldIndex = 0; fieldIndex < allCreatures.length; fieldIndex++) {
                    const creature = allCreatures[fieldIndex];
                    if (creature 
                        && TargetResolver.creatureMatchesCriteria(toFieldCard(creature), criteria, handlerData, cardRepository, fieldIndex)
                        && validationFn(toFieldCard(creature), handlerData)) {
                        return true;
                    }
                }
            }
            
            return false;
        }
        
        // For fixed targets, check the specific creature
        if (target.type === 'fixed') {
            const creature = this.getFixedTargetCreature(target, handlerData, context);
            return creature ? validationFn(creature, handlerData) : false;
        }
        
        return true; // Other target types don't need validation
    }
    
    /**
     * Check if a target has any valid creature (default behavior).
     */
    private static hasValidTargets(
        target: Target,
        handlerData: HandlerData,
        context: EffectContext,
        cardRepository: CardRepository,
    ): boolean {
        
        // For most targets, just check if there are any matching creature
        if (target.type === 'all-matching' || target.type === 'single-choice') {
            const criteria = target.criteria;
            
            // Determine which players to check based on criteria
            const playerIds = [];
            if (!criteria.player || criteria.player === 'self') {
                playerIds.push(context.sourcePlayer);
            }
            if (!criteria.player || criteria.player === 'opponent') {
                playerIds.push(1 - context.sourcePlayer);
            }
            
            // Check if any creature matches the criteria
            for (const playerId of playerIds) {
                const allCreatures = handlerData.field.creatures[playerId] || [];
                
                for (let fieldIndex = 0; fieldIndex < allCreatures.length; fieldIndex++) {
                    const creature = allCreatures[fieldIndex];
                    if (creature && TargetResolver.creatureMatchesCriteria(toFieldCard(creature), criteria, handlerData, cardRepository, fieldIndex)) {
                        return true;
                    }
                }
            }
            
            return false;
        }
        
        // For fixed targets, check if the target creature exists
        if (target.type === 'fixed') {
            const creature = this.getFixedTargetCreature(target, handlerData, context);
            return !!creature;
        }
        
        return true;
    }
    
    /**
     * Get the creature for a fixed target.
     */
    private static getFixedTargetCreature(
        target: FixedTarget,
        handlerData: HandlerData,
        context: EffectContext,
    ): FieldCard | undefined {
        // Determine player and position from new target structure
        const playerId = target.player === 'self' ? context.sourcePlayer : (1 - context.sourcePlayer);
        let fieldIndex: number;
        
        if (target.position === 'active') {
            fieldIndex = 0;
        } else if (target.position === 'source') {
            // For source targeting, determine position based on context type
            if (context.type === 'ability') {
                fieldIndex = context.fieldPosition;
            } else if (context.type === 'attack') {
                // Attacks are always from active creature
                fieldIndex = 0;
            } else if (context.type === 'trigger') {
                // For triggers, find the field position of the creature that has the trigger
                const allCreatures = handlerData.field.creatures[playerId] || [];
                fieldIndex = allCreatures.findIndex(creature => creature && getCurrentInstanceId(creature) === context.creatureInstanceId);
                if (fieldIndex === -1) {
                    throw new Error(`Trigger source creature not found: ${context.creatureInstanceId}`);
                }
            } else {
                throw new Error(`Source targeting not supported for context type: ${context.type}`);
            }
        } else {
            fieldIndex = 0; // Default to active
        }
        
        const card = handlerData.field?.creatures?.[playerId]?.[fieldIndex];
        return card ? toFieldCard(card) : undefined;
    }
    
    /**
     * Checks if a creature matches the given criteria 
     * 
     * @param creature The creature to check
     * @param criteria The criteria to match against
     * @param handlerData HandlerData view
     * @returns True if the creature matches the criteria, false otherwise
     */
    private static creatureMatchesCriteria(
        creature: FieldCard,
        criteria: TargetCriteria,
        handlerData: HandlerData,
        cardRepository: CardRepository,
        fieldIndex?: number,
    ): boolean {
        if (!criteria) {
            return true; 
        }
        
        // Check position criteria using field index
        if (criteria.position === 'active' && fieldIndex !== undefined && fieldIndex !== 0) {
            return false;
        }
        
        if (criteria.position === 'bench' && fieldIndex !== undefined && fieldIndex === 0) {
            return false;
        }
        
        // Check condition using the ConditionEvaluator
        if (criteria.condition) {
            if (!ConditionEvaluator.evaluateCondition(criteria.condition, creature, handlerData, cardRepository)) {
                return false;
            }
        }
        
        // Check creature type criteria
        if (criteria.fieldCardType) {
            try {
                const creatureData = cardRepository.getCreature(creature.templateId);
                if (creatureData.type !== criteria.fieldCardType) {
                    return false;
                }
            } catch (error) {
                // If creature not found, criteria doesn't match
                return false;
            }
        }
        
        /*
         * Check filter criteria (e.g., 'ultra-beast')
         * TODO: This should use the condition system instead of a filter property
         */
        /*
         *if (criteria.filter === 'ultra-beast') {
         *    try {
         *        const creatureData = cardRepository.getCreature(creature.templateId);
         *        // Ultra beast check should be handled by condition system
         *        // This code path may not be needed if using proper conditions
         *        return false;
         *    } catch (error) {
         *        // If creature not found, criteria doesn't match
         *        return false;
         *    }
         *}
         */
        
        return true;
    }
    
    /**
     * Checks if a target requires selection.
     * This is a replacement for the existing targetRequiresSelection function.
     * 
     * @param target The target to check
     * @param context Effect context
     * @returns True if target selection is needed, false otherwise
     */
    static requiresTargetSelection(
        target: Target | undefined,
        context: EffectContext,
    ): boolean {
        // If no target, no selection needed
        if (!target) {
            return false; 
        }
        
        // If fixed target, no selection needed
        if (target.type === 'fixed') {
            return false;
        }
        
        // If context already has target information, no selection needed
        if (context && context.targetPlayerId !== undefined && context.targetCreatureIndex !== undefined) {
            return false;
        }
        
        // For all choice targets, selection is needed
        return target.type === 'single-choice' || target.type === 'multi-choice';
    }
    
    /**
     * Handles the common pattern of checking if target selection is needed and setting up pending target selection.
     * This centralizes the logic that was previously duplicated across effect implementations.
     * 
     * @param controllers Game controllers
     * @param effect The effect that may require target selection
     * @param context Effect context
     * @param target Optional explicit target (if not included in the effect)
     * @returns true if pending target selection was set up, false if no selection is needed
     */
    static handleTargetSelection(
        controllers: Controllers,
        effect: Effect,
        context: EffectContext,
        target?: Target,
    ): boolean {
        // Use the target from the effect if not explicitly provided
        const targetToUse = target || ('target' in effect ? effect.target as Target : undefined);
        
        // If no target, no selection needed
        if (!targetToUse) {
            return false;
        }
        
        // For single-choice and multi-choice targets, we need to check if there are multiple options
        if (targetToUse.type === 'single-choice' || targetToUse.type === 'multi-choice') {
            // Resolve target using the TargetResolver
            const resolution = this.resolveTarget(targetToUse, controllers, context);
            
            // If target resolution requires selection, set up pending target selection
            if (resolution.type === 'requires-selection') {
                controllers.turnState.setPendingSelection({
                    selectionType: 'target',
                    effect: effect,
                    originalContext: context,
                });
                return true;
            }
            
            // If target is resolved or auto-resolved, no selection needed
            if (resolution.type === 'resolved' || resolution.type === 'auto-resolved') {
                return false;
            }
        }
        
        // For fixed targets, no selection needed
        if (targetToUse.type === 'fixed') {
            return false;
        }
        
        // No target selection needed
        return false;
    }

    /**
     * Validates if a selected target matches the target criteria.
     * 
     * @param target The target definition with criteria
     * @param targetPlayerId The selected target player ID
     * @param targetCreatureIndex The selected target creature index
     * @param controllers Game controllers
     * @param context Effect context
     * @returns true if the target is valid, false otherwise
     */
    static validateTargetSelection(
        target: Target,
        targetPlayerId: number,
        targetCreatureIndex: number,
        controllers: Controllers,
        context: EffectContext,
    ): boolean {
        if (!target || !('criteria' in target) || !target.criteria) {
            return true; // No criteria means any target is valid
        }

        const handlerData = ControllerUtils.createPlayerView(controllers, context.sourcePlayer);
        const creature = controllers.field.getCardByPosition(targetPlayerId, targetCreatureIndex);
        
        if (!creature) {
            return false; // No creature at the specified position
        }

        return this.creatureMatchesCriteria(creature, target.criteria, handlerData, controllers.cardRepository.cardRepository, targetCreatureIndex);
    }
}
