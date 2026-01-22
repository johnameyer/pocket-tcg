import { Controllers } from '../../controllers/controllers.js';
import { HpEffect } from '../../repository/effect-types.js';
import { CreatureAbility } from '../../repository/card-types.js';
import { FixedTarget, ResolvedTarget, TargetCriteria, Target } from '../../repository/target-types.js';
import { EffectContext, EffectContextFactory } from '../effect-context.js';
import { AbstractEffectHandler, ResolutionRequirement } from '../interfaces/effect-handler-interface.js';
import { getEffectValue, getCreatureFromTarget } from '../effect-utils.js';
import { CardRepository } from '../../repository/card-repository.js';
import { HealResultMessage } from '../../messages/status/heal-result-message.js';
import { FieldCard } from "../../controllers/field-controller.js";
import { HandlerData } from '../../game-handler.js';
import { AttachableEnergyType } from '../../repository/energy-types.js';
import { TargetResolver } from '../target-resolver.js';
import { TriggerProcessor } from '../trigger-processor.js';

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
        
        if (effect.target.type !== 'resolved') {
            throw new Error(`Expected resolved target, got ${effect.target.type}`);
        }
        
        // Get resolved targets directly
        const targets = effect.target.targets;
        
        if (targets.length === 0) {
            controllers.players.messageAll({
                type: 'status',
                components: [`${context.effectName} found no valid targets!`]
            });
            return;
        }
        
        for (const target of targets) {
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
            
            // Trigger when-damaged effects by calling TriggerProcessor
            // which will push them to the queue for processing
            TriggerProcessor.processWhenDamaged(
                controllers,
                playerId,
                creature.instanceId,
                creature.templateId,
                damageDealt
            );
        }
    }
    
    
}

// Export the handler instance
export const hpEffectHandler = new HpEffectHandler();
