import { Controllers } from '../../controllers/controllers.js';
import { HpEffect } from '../../repository/effect-types.js';
import { CreatureAbility } from '../../repository/card-types.js';
import { FixedTarget, ResolvedTarget, TargetCriteria, Target } from '../../repository/target-types.js';
import { EffectContext } from '../effect-context.js';
import { AbstractEffectHandler, ResolutionRequirement } from '../interfaces/effect-handler-interface.js';
import { getEffectValue, getCreatureFromTarget } from '../effect-utils.js';
import { CardRepository } from '../../repository/card-repository.js';
import { HealResultMessage } from '../../messages/status/heal-result-message.js';
import { FieldCard } from "../../controllers/field-controller.js";
import { HandlerData } from '../../game-handler.js';
import { AttachableEnergyType } from '../../repository/energy-types.js';
import { TargetResolver } from '../target-resolver.js';

/**
 * Handler for HP effects (healing and damage).
 * This handler encapsulates all logic related to applying HP effects.
 */
// TODO: This file is rather long - can something be moved elsewhere? Or can we DRY duplicate application code? Maybe scope down the valid resolved targets like the other effect handlers
export class HpEffectHandler extends AbstractEffectHandler<HpEffect> {
    /**
     * Get the resolution requirements for an HP effect.
     * HP effects require a target to be resolved.
     * 
     * @param effect The HP effect to get resolution requirements for
     * @returns Array of resolution requirements
     */
    getResolutionRequirements(effect: HpEffect): ResolutionRequirement[] {
        return [
            { targetProperty: 'target', target: effect.target, required: true }
        ];
    }
    
    /**
     * Apply a fully resolved HP effect.
     * This is called after all targets have been resolved.
     * 
     * @param controllers Game controllers
     * @param effect The HP effect to apply (with resolved targets)
     * @param context Effect context
     */
    apply(controllers: Controllers, effect: HpEffect, context: EffectContext): void {
        const amount = getEffectValue(effect.amount, controllers, context);
        
        // Ensure we have a resolved target
        // TODO effect.target.type === 'resolved'?
        if (!effect.target || typeof effect.target !== 'object') {
            throw new Error(`Expected resolved target, got ${effect.target}`);
        }
        
        // Handle all-matching targets generically
        if (effect.target.type === 'all-matching') {
            this.handleAllMatchingTargets(controllers, effect, context, amount);
            return;
        }
        
        // Get resolved targets using the helper method from AbstractEffectHandler
        const targetsFromEffect = this.getResolvedTargets(effect, 'target');
        
        // Make sure targets is always an array
        const targets = Array.isArray(targetsFromEffect) ? targetsFromEffect : [targetsFromEffect];
        
        if (targets.length === 0) {
            controllers.players.messageAll({
                type: 'status',
                components: [`${context.effectName} found no valid targets!`]
            });
            return;
        }
        
        for (const target of targets as ResolvedTarget[]) {
            // Type narrowing: ensure we have a resolved target
            if (target.type !== 'resolved') {
                throw new Error(`Expected resolved target, got ${target.type}`);
            }
            
            const { playerId, fieldIndex } = target;
            
            // For healing effects, we can only target our own creature
            if (effect.operation === 'heal' && playerId !== context.sourcePlayer) {
                controllers.players.messageAll({
                    type: 'status',
                    components: [`${context.effectName} cannot heal opponent's creature!`]
                });
                continue;
            }
            
            // Get the target creature
            const targetCreature = getCreatureFromTarget(controllers, playerId, fieldIndex);
            
            if (!targetCreature) {
                controllers.players.messageAll({
                    type: 'status',
                    components: [`${context.effectName} target creature not found!`]
                });
                continue;
            }
        
            if (effect.operation === 'heal') {
                this.applyHealing(controllers, targetCreature, playerId, fieldIndex, amount, context.effectName);
            } else {
                this.applyDamage(controllers, targetCreature, playerId, fieldIndex, amount, context);
            }
        }
    }
    
    /**
     * Handle all-matching targets for HP effects
     * 
     * @param controllers Game controllers
     * @param effect The HP effect to apply
     * @param context Effect context
     * @param amount The amount to heal or damage
     */
    private handleAllMatchingTargets(
        controllers: Controllers,
        effect: HpEffect,
        context: EffectContext,
        amount: number
    ): void {
        if (!effect.target || effect.target.type !== 'all-matching' || !effect.target.criteria) {
            throw new Error('Invalid all-matching target');
        }
        
        const criteria = effect.target.criteria;
        
        // For healing effects, we can only target our own creature
        if (effect.operation === 'heal' && criteria.player === 'opponent') {
            controllers.players.messageAll({
                type: 'status',
                components: [`${context.effectName} cannot heal opponent's creature!`]
            });
            return;
        }
        
        // Determine which players to check based on criteria
        const playerIds = [];
        if (!criteria.player || criteria.player === 'self') {
            playerIds.push(context.sourcePlayer);
        }
        if ((!criteria.player || criteria.player === 'opponent') && effect.operation !== 'heal') {
            playerIds.push((context.sourcePlayer + 1) % 2); // Assuming 2 players
        }
        
        let targetsFound = false;
        
        // Process each player's creature
        for (const playerId of playerIds) {
            // Process active creature first (if not bench-only scope)
            // Check if we should process active creature based on position criteria
            if (!criteria.position || criteria.position !== 'bench') {
                const activecreature = controllers.field.getCardByPosition(playerId, 0);
                if (activecreature) {
                    // Check if the creature matches the criteria directly
                    // For all-matching targets, we can evaluate simple conditions directly
                    // TODO generify appropriately - is TargetResolver not working?
                    if (criteria.condition && criteria.condition.hasEnergy && typeof criteria.condition.hasEnergy === 'object') {
                        // Get the energy type and required count
                        const energyType = Object.keys(criteria.condition.hasEnergy)[0] as AttachableEnergyType;
                        const requiredCount = criteria.condition.hasEnergy[energyType] || 1;
                        
                        // Check if the creature has enough energy of the specified type
                        const energyCount = controllers.energy.countEnergyTypeByInstance(activecreature.instanceId, energyType);
                        if (energyCount >= requiredCount) {
                            targetsFound = true;
                            if (effect.operation === 'heal') {
                                if (activecreature.damageTaken > 0) {
                                    this.applyHealing(controllers, activecreature, playerId, 0, amount, context.effectName);
                                }
                            } else {
                                this.applyDamage(controllers, activecreature, playerId, 0, amount, context);
                            }
                        }
                    } else {
                        // For other conditions, assume they match
                        targetsFound = true;
                        if (effect.operation === 'heal') {
                            if (activecreature.damageTaken > 0) {
                                this.applyHealing(controllers, activecreature, playerId, 0, amount, context.effectName);
                            }
                        } else {
                            this.applyDamage(controllers, activecreature, playerId, 0, amount, context);
                        }
                    }
                }
            }
            
            // Process benched creature
            const benchedcreature = controllers.field.getCards(playerId).slice(1);
            for (let i = 0; i < benchedcreature.length; i++) {
                const creature = benchedcreature[i];
                if (!creature) continue;
                
                // Check if the creature matches the criteria directly
                // For all-matching targets, we can evaluate simple conditions directly
                if (criteria.condition && typeof criteria.condition === 'object' && 
                    criteria.condition.hasEnergy && typeof criteria.condition.hasEnergy === 'object' &&
                    criteria.condition.hasEnergy.water) {
                    // Check if the creature has Water energy
                    const requiredCount = criteria.condition.hasEnergy.water || 1;
                    const waterEnergyCount = controllers.energy.countEnergyTypeByInstance(creature.instanceId, 'water');
                    if (waterEnergyCount >= requiredCount) {
                        targetsFound = true;
                        if (effect.operation === 'heal') {
                            if (creature.damageTaken > 0) {
                                // Bench positions start at 1 in the controller
                                this.applyHealing(controllers, creature, playerId, i + 1, amount, context.effectName);
                            }
                        } else {
                            // Bench positions start at 1 in the controller
                            this.applyDamage(controllers, creature, playerId, i + 1, amount, context);
                        }
                    }
                } else {
                    // For other conditions, assume they match
                    targetsFound = true;
                    if (effect.operation === 'heal') {
                        if (creature.damageTaken > 0) {
                            // Bench positions start at 1 in the controller
                            this.applyHealing(controllers, creature, playerId, i + 1, amount, context.effectName);
                        }
                    } else {
                        // Bench positions start at 1 in the controller
                        this.applyDamage(controllers, creature, playerId, i + 1, amount, context);
                    }
                }
            }
        }
        
        if (!targetsFound) {
            controllers.players.messageAll({
                type: 'status',
                components: [`${context.effectName} found no matching creature!`]
            });
        }
    }
    
    /**
     * Optional validation method to check if an HP effect can be applied.
     * For heal effects, checks if the target has damage to heal.
     * Updated to use HandlerData for validation.
     * 
     * @param handlerData Handler data view
     * @param effect The HP effect to validate
     * @param context Effect context
     * @returns True if the effect can be applied, false otherwise
     */
    canApply(handlerData: HandlerData, effect: HpEffect, context: EffectContext, cardRepository: CardRepository): boolean {
        // For heal effects, check if there are any damaged creature that can be healed
        if (effect.operation === 'heal') {
            // Create validation function to check if creature can be healed
            const canBeHealed = (creature: FieldCard, handlerData: HandlerData): boolean => {
                return creature.damageTaken > 0; // creature must have damage to be healed
            };
            
            // Use TargetResolver with validation function
            return TargetResolver.isTargetAvailable(effect.target, handlerData, context, cardRepository, canBeHealed);
        }
        
        // For damage effects, targets are always available if they exist
        return TargetResolver.isTargetAvailable(effect.target, handlerData, context, cardRepository);
    }
    
    /**
     * Helper method to get all creature for a player
     * 
     * @param handlerData Handler data view
     * @param playerId The player ID
     * @returns Array of all creature for the player
     */
    private getAllcreature(handlerData: HandlerData, playerId: number): FieldCard[] {
        const result = [];
        const playercreature = handlerData.field.creatures[playerId] || [];
        
        for (let i = 0; i < playercreature.length; i++) {
            const creature = playercreature[i];
            if (creature) {
                result.push(creature);
            }
        }
        
        return result;
    }
    
    /**
     * Helper method to check if a target is a fixed or all-matching target
     * 
     * @param target The target to check
     * @returns True if the target is a fixed or all-matching target
     */
    private isFixedOrAllMatchingTarget(target: Target): boolean {
        return target && typeof target === 'object' && 
               'type' in target && 
               (target.type === 'fixed' || target.type === 'all-matching');
    }
    
    /**
     * Helper method to check if a target is a choice target
     * 
     * @param target The target to check
     * @returns True if the target is a choice target
     */
    private isChoiceTarget(target: Target): boolean {
        return target && typeof target === 'object' && 
               'type' in target && 
               (target.type === 'single-choice' || target.type === 'multi-choice');
    }
                
    /**
     * Helper function to apply healing to a creature
     * 
     * @param controllers Game controllers
     * @param creature The creature to heal
     * @param playerId The player ID
     * @param fieldIndex The index of the creature (0 for active, 1+ for bench)
     * @param amount The amount to heal
     * @param effectName The name of the effect
     */
    private applyHealing(
        controllers: Controllers,
        creature: FieldCard,
        playerId: number,
        fieldIndex: number,
        amount: number,
        effectName: string
    ): void {
        // creature is guaranteed to exist at this point
        
        // Store the original damage taken for comparison
        const originalDamageTaken = creature.damageTaken;
        
        // Use the controller's heal method which returns the actual healing done
        let healedAmount: number;
        if (fieldIndex === 0) {
            // Active creature
            healedAmount = controllers.field.healDamage(playerId, amount);
        } else {
            // Benched creature
            healedAmount = controllers.field.healBenchedCard(playerId, fieldIndex - 1, amount);
        }
        
        // Send healing message if any healing was done
        if (healedAmount > 0) {
            // Get the creature data - will throw an error if not found
            const creatureData = controllers.cardRepository.getCreature(creature.templateId);
            const creatureName = creatureData.name;
            // Use the actual HP from the creature data
            const maxHp = Number(creatureData.maxHp);
            const currentHp = Math.max(0, maxHp - (originalDamageTaken - healedAmount));
            
            controllers.players.messageAll(new HealResultMessage(
                creatureName,
                healedAmount,
                currentHp
            ));
        }
    }
    
    /**
     * Helper function to apply damage to a creature
     * 
     * @param controllers Game controllers
     * @param creature The creature to damage
     * @param playerId The player ID
     * @param fieldIndex The index of the creature (0 for active, 1+ for bench)
     * @param amount The amount of damage to apply
     * @param context The effect context
     * @param customName Optional custom name for the creature
     */
    private applyDamage(
        controllers: Controllers,
        creature: FieldCard,
        playerId: number,
        fieldIndex: number,
        amount: number,
        context: EffectContext,
        customName?: string
    ): void {
        // creature is guaranteed to exist at this point
        
        // Use the controller's applyDamage method and get the actual amount applied
        const damageDealt = controllers.field.applyDamage(playerId, amount, fieldIndex);
        
        // Send damage message if any damage was dealt
        if (damageDealt > 0) {
            // Get the creature data - will throw an error if not found
            const creatureData = controllers.cardRepository.getCreature(creature.templateId);
            const creatureName = customName || creatureData.name;
            
            controllers.players.messageAll({
                type: 'status',
                components: [`${context.effectName} deals ${damageDealt} damage${customName ? ' to ' + customName : ''}!`]
            });
        }
    }
    
    
}

// Export the handler instance
export const hpEffectHandler = new HpEffectHandler();
