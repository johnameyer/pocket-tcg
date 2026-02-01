import { Controllers } from '../../controllers/controllers.js';
import { HandlerData } from '../../game-handler.js';
import { EnergyTransferEffect } from '../../repository/effect-types.js';
import { TargetCriteria } from '../../repository/target-types.js';
import { EffectContext } from '../effect-context.js';
import { AbstractEffectHandler, ResolutionRequirement } from '../interfaces/effect-handler-interface.js';
import { getEffectValue } from '../effect-utils.js';
import { CardRepository } from '../../repository/card-repository.js';
import { AttachableEnergyType } from '../../repository/energy-types.js';
import { TargetResolver } from '../target-resolver.js';
import { ConditionEvaluator } from '../condition-evaluator.js';
import { Condition } from '../../repository/condition-types.js';
import { FieldCard } from '../../controllers/field-controller.js';
import { getFieldInstanceId } from '../../utils/field-card-utils.js';

/**
 * Handler for energy transfer effects that move energy from one creature to another.
 */
export class EnergyTransferEffectHandler extends AbstractEffectHandler<EnergyTransferEffect> {
    /**
     * Get the resolution requirements for an energy transfer effect.
     * Energy transfer effects require both source and target to be resolved.
     * 
     * @param effect The energy transfer effect to get resolution requirements for
     * @returns Array of resolution requirements
     */
    getResolutionRequirements(effect: EnergyTransferEffect): ResolutionRequirement[] {
        return [
            { targetProperty: 'source', target: effect.source, required: true },
            { targetProperty: 'target', target: effect.target, required: true },
        ];
    }
    
    /**
     * Optional validation method to check if an energy transfer effect can be applied.
     * Updated to use HandlerData for validation.
     * 
     * @param handlerData Handler data view
     * @param effect The energy transfer effect to validate
     * @param context Effect context
     * @returns True if the effect can be applied, false otherwise
     */
    canApply(handlerData: HandlerData, effect: EnergyTransferEffect, context: EffectContext, cardRepository: CardRepository): boolean {
        
        // Create validation function to check if creature has required energy
        const hasRequiredEnergy = (creature: FieldCard, handlerData: HandlerData): boolean => {
            if(!effect.energyTypes || effect.energyTypes.length === 0) {
                return true; // No specific energy requirement
            }
            
            const fieldInstanceId = getFieldInstanceId(creature);
            const attachedEnergy = handlerData.energy?.attachedEnergyByInstance?.[fieldInstanceId];
            if(!attachedEnergy) {
                return false; 
            }
            
            // Check if the creature has any of the required energy types
            for(const energyType of effect.energyTypes) {
                const energyCount = attachedEnergy[energyType];
                if(energyCount && energyCount > 0) {
                    return true;
                }
            }
            
            return false;
        };
        
        // Use TargetResolver with validation function
        const sourceAvailable = TargetResolver.isTargetAvailable(effect.source, handlerData, context, cardRepository, hasRequiredEnergy);
        const targetAvailable = TargetResolver.isTargetAvailable(effect.target, handlerData, context, cardRepository);
        
        return sourceAvailable && targetAvailable;
    }
    
    /**
     * Helper method to check if a creature matches the given criteria.
     * 
     * @param creature The creature to check
     * @param criteria The criteria to match against
     * @param handlerData Handler data view
     * @returns True if the creature matches the criteria, false otherwise
     */
    private creatureMatchesCriteria(
        creature: FieldCard,
        position: number,
        criteria: TargetCriteria,
        handlerData: HandlerData,
        cardRepository: CardRepository,
    ): boolean {
        if(!criteria) {
            return true; 
        }
        
        // Check position criteria
        if(criteria.position === 'active' && position !== 0) {
            return false;
        }
        
        if(criteria.position === 'bench' && position === 0) {
            return false;
        }
        
        // Check condition using the ConditionEvaluator
        if(criteria.condition) {
            // Handle componentized conditions
            if(typeof criteria.condition === 'object') {
                if(!ConditionEvaluator.evaluateCondition(criteria.condition as Condition, creature, handlerData, cardRepository)) {
                    return false;
                }
            } else if(typeof criteria.condition === 'string') {
                /*
                 * Handle legacy string conditions
                 * Legacy condition handling 
                 */
                if(criteria.condition === 'damaged' && creature.damageTaken <= 0) {
                    return false;
                }
                
                if(criteria.condition === 'has-energy') {
                    // Check if the creature has the specified energy type attached
                    const attachedEnergyByInstance = handlerData.energy?.attachedEnergyByInstance;
                    if(!attachedEnergyByInstance) {
                        return false; 
                    }
                    
                    const fieldInstanceId = getFieldInstanceId(creature);
                    const creatureEnergy = attachedEnergyByInstance[fieldInstanceId];
                    if(!creatureEnergy) {
                        return false; 
                    }
                    
                    // Check if the creature has any energy
                    if(!Object.values(creatureEnergy).some(amount => amount > 0)) {
                        return false;
                    }
                }
                
                if(criteria.condition === 'has-water-energy') {
                    // Check if the creature has water energy attached
                    const attachedEnergyByInstance = handlerData.energy?.attachedEnergyByInstance;
                    if(!attachedEnergyByInstance) {
                        return false; 
                    }
                    
                    const fieldInstanceId = getFieldInstanceId(creature);
                    const creatureEnergy = attachedEnergyByInstance[fieldInstanceId];
                    if(!creatureEnergy || !(creatureEnergy.water > 0)) {
                        return false;
                    }
                }
            }
        }
        
        // Check creature type criteria
        if(criteria.fieldCardType) {
            try {
                const creatureData = cardRepository.getCreature(creature.templateId);
                if(creatureData.type !== criteria.fieldCardType) {
                    return false;
                }
            } catch (error) {
                // If creature not found, criteria doesn't match
                return false;
            }
        }
        
        return true;
    }
    
    apply(controllers: Controllers, effect: EnergyTransferEffect, context: EffectContext): void {
        
        // Get the amount of energy to transfer
        const amount = getEffectValue(effect.amount, controllers, context);

        /*
         * Ensure we have resolved targets
         * DO NOT REMOVE - Keep error handling for debugging target resolution issues
         */
        if(!effect.source || !effect.target) {
            throw new Error(`Expected resolved targets, got source: ${effect.source} target: ${effect.target}`);
        }

        if(effect.source.type !== 'resolved' || effect.target.type !== 'resolved') {
            throw new Error(`Expected resolved targets, got source: ${effect.source?.type} target: ${effect.target?.type}`);
        }

        // Targets are always resolved by EffectApplier
        const sourceTarget = effect.source.targets[0];
        const targetTarget = effect.target.targets[0];
        
        // Get field instance IDs for energy operations
        const sourceFieldInstanceId = controllers.field.getFieldInstanceId(sourceTarget.playerId, sourceTarget.fieldIndex);
        const targetFieldInstanceId = controllers.field.getFieldInstanceId(targetTarget.playerId, targetTarget.fieldIndex);

        // Ensure both creatures exist
        if(!sourceFieldInstanceId || !targetFieldInstanceId) {
            throw new Error('Source or target creature not found');
        }

        // Get the creatures for display names
        const sourceCreature = controllers.field.getCardByPosition(sourceTarget.playerId, sourceTarget.fieldIndex);
        const targetCreature = controllers.field.getCardByPosition(targetTarget.playerId, targetTarget.fieldIndex);

        if(!sourceCreature || !targetCreature) {
            throw new Error('Source or target creature not found');
        }

        // Determine which energy type to transfer
        let energyTypeToTransfer: string | undefined = undefined;
        
        if(effect.energyTypes && effect.energyTypes.length > 0) {
            // Get the attached energy for the source creature
            const attachedEnergy = controllers.energy.getAttachedEnergyByInstance(sourceFieldInstanceId);
            
            // Find the first energy type from the effect's energyTypes array that the source creature has
            for(const energyType of effect.energyTypes) {
                const energyCount = attachedEnergy && attachedEnergy[energyType as keyof typeof attachedEnergy];
                if(energyCount && energyCount > 0) {
                    energyTypeToTransfer = energyType;
                    break;
                }
            }
        }
        
        // If no specific energy type was found, use the first one from the effect
        if(energyTypeToTransfer === undefined && effect.energyTypes && effect.energyTypes.length > 0) {
            energyTypeToTransfer = effect.energyTypes[0];
        }
        
        // Make sure we have a valid energy type to transfer
        if(!energyTypeToTransfer) {
            throw new Error('No valid energy type to transfer!');
        }
        
        // Cap the transfer amount at available energy
        const sourceEnergy = controllers.energy.getAttachedEnergyByInstance(sourceFieldInstanceId);
        const availableEnergy = sourceEnergy?.[energyTypeToTransfer as keyof typeof sourceEnergy] || 0;
        const actualAmount = Math.min(amount, availableEnergy);
        
        // If no energy available to transfer, just return without error
        if(actualAmount <= 0) {
            return;
        }
        
        // Get creature names for the message
        const sourceCreatureName = sourceCreature.data.name || 'a creature';
        const targetCreatureName = targetCreature.data.name || 'a creature';
        
        // Get the energy state before transfer
        const sourceEnergyBefore = controllers.energy.getAttachedEnergyByInstance(sourceFieldInstanceId);
        const targetEnergyBefore = controllers.energy.getAttachedEnergyByInstance(targetFieldInstanceId);
        
        // Transfer energy between the creature
        const success = controllers.energy.transferEnergyBetweenInstances(
            sourceFieldInstanceId,
            targetFieldInstanceId,
            energyTypeToTransfer as AttachableEnergyType,
            actualAmount,
        );
        
        // Get the energy state after transfer
        const sourceEnergyAfter = controllers.energy.getAttachedEnergyByInstance(sourceFieldInstanceId);
        const targetEnergyAfter = controllers.energy.getAttachedEnergyByInstance(targetFieldInstanceId);
        
        if(!success) {
            throw new Error('Failed to transfer energy!');
        }
    }
}

export const energyTransferEffectHandler = new EnergyTransferEffectHandler();
