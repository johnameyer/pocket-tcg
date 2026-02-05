import { Controllers } from '../../controllers/controllers.js';
import { HandlerData } from '../../game-handler.js';
import { EnergyTransferEffect } from '../../repository/effect-types.js';
import { EffectContext } from '../effect-context.js';
import { AbstractEffectHandler, ResolutionRequirement } from '../interfaces/effect-handler-interface.js';
import { getEffectValue } from '../effect-utils.js';
import { CardRepository } from '../../repository/card-repository.js';
import { AttachableEnergyType } from '../../repository/energy-types.js';
import { FieldTargetResolver } from '../target-resolvers/field-target-resolver.js';
import { FieldCard } from '../../controllers/field-controller.js';
import { getCurrentInstanceId } from '../../utils/field-card-utils.js';

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
        const requirements: ResolutionRequirement[] = [];
        
        if (effect.source) {
            requirements.push({ targetProperty: 'source', target: effect.source, required: true });
        }
        if (effect.target) {
            requirements.push({ targetProperty: 'target', target: effect.target, required: true });
        }
        
        return requirements;
    }
    
    /**
     * Check if an energy transfer effect can be applied.
     * Validates that source has required energy available and target is available.
     * 
     * @param handlerData Handler data view
     * @param effect The energy transfer effect to validate
     * @param context Effect context
     * @param cardRepository Card repository
     * @returns True if the effect can be applied, false otherwise
     */
    canApply(handlerData: HandlerData, effect: EnergyTransferEffect, context: EffectContext, cardRepository: CardRepository): boolean {
        // Create validation function to check if creature has required energy
        const hasRequiredEnergy = (creature: FieldCard): boolean => {
            if (!effect.energyTypes || effect.energyTypes.length === 0) {
                return true; // No specific energy requirement
            }
            
            const instanceId = getCurrentInstanceId(creature);
            const attachedEnergy = handlerData.energy?.attachedEnergyByInstance?.[instanceId];
            if (!attachedEnergy) {
                return false; 
            }
            
            // Check if the creature has any of the required energy types
            for (const energyType of effect.energyTypes) {
                const energyCount = attachedEnergy[energyType];
                if (energyCount && energyCount > 0) {
                    return true;
                }
            }
            
            return false;
        };
        
        // Use FieldTargetResolver with validation function
        const sourceAvailable = FieldTargetResolver.isTargetAvailable(effect.source, handlerData, context, cardRepository, hasRequiredEnergy);
        const targetAvailable = FieldTargetResolver.isTargetAvailable(effect.target, handlerData, context, cardRepository);
        
        return sourceAvailable && targetAvailable;
    }
    
    apply(controllers: Controllers, effect: EnergyTransferEffect, context: EffectContext): void {
        // Get the amount of energy to transfer
        const amount = getEffectValue(effect.amount, controllers, context);

        // Get resolved source and target
        if (effect.source.type !== 'resolved') {
            throw new Error(`Expected resolved source target, got ${effect.source?.type || effect.source}`);
        }
        
        if (effect.target.type !== 'resolved') {
            throw new Error(`Expected resolved target, got ${effect.target?.type || effect.target}`);
        }

        if (effect.source.targets.length === 0) {
            throw new Error(`${context.effectName} source resolved to no valid targets`);
        }

        if (effect.target.targets.length === 0) {
            throw new Error(`${context.effectName} target resolved to no valid targets`);
        }

        // Get the source creature
        const sourceTarget = effect.source.targets[0];
        const sourceCreature = controllers.field.getRawCardByPosition(sourceTarget.playerId, sourceTarget.fieldIndex);
        
        if (!sourceCreature) {
            controllers.players.messageAll({
                type: 'status',
                components: [ `${context.effectName} source creature not found!` ],
            });
            return;
        }

        // Get the target creature
        const targetTarget = effect.target.targets[0];
        const targetCreature = controllers.field.getRawCardByPosition(targetTarget.playerId, targetTarget.fieldIndex);
        
        if (!targetCreature) {
            controllers.players.messageAll({
                type: 'status',
                components: [ `${context.effectName} target creature not found!` ],
            });
            return;
        }

        // Get instance IDs
        const sourceInstanceId = sourceCreature.instanceId;
        const targetInstanceId = targetCreature.instanceId;

        // @ts-expect-error state is protected but needed for energy lookup - this is a framework limitation
        const attachedEnergy = controllers.energy.state?.attachedEnergyByInstance?.[sourceInstanceId];
        if (!attachedEnergy) {
            controllers.players.messageAll({
                type: 'status',
                components: [ `${context.effectName} source has no energy!` ],
            });
            return;
        }

        // Determine which energy types to transfer
        const energyTypesToTransfer = effect.energyTypes && effect.energyTypes.length > 0 
            ? effect.energyTypes 
            : undefined;

        let transferred = 0;

        // If specific energy types are specified, transfer from those types
        if (energyTypesToTransfer) {
            let remainingAmount = amount;
            for (const energyType of energyTypesToTransfer) {
                if (remainingAmount <= 0) {
                    break; 
                }
                
                // Check how much energy is available of this type
                const available = attachedEnergy[energyType] || 0;
                const toTransfer = Math.min(available, remainingAmount);
                
                if (toTransfer > 0 && controllers.energy.transferEnergyBetweenInstances(
                    sourceInstanceId,
                    targetInstanceId,
                    energyType,
                    toTransfer,
                )) {
                    transferred += toTransfer;
                    remainingAmount -= toTransfer;
                }
            }
        } else {
            // Transfer any available energy (up to amount)
            let remainingAmount = amount;
            for (const energyType of Object.keys(attachedEnergy) as AttachableEnergyType[]) {
                if (remainingAmount <= 0) {
                    break; 
                }
                
                const available = attachedEnergy[energyType] || 0;
                const toTransfer = Math.min(available, remainingAmount);
                
                if (toTransfer > 0 && controllers.energy.transferEnergyBetweenInstances(
                    sourceInstanceId,
                    targetInstanceId,
                    energyType,
                    toTransfer,
                )) {
                    transferred += toTransfer;
                    remainingAmount -= toTransfer;
                }
            }
        }

        // Send a message about the transfer
        controllers.players.messageAll({
            type: 'status',
            components: [ `${context.effectName} transferred ${transferred} energy!` ],
        });
    }
}

export const energyTransferEffectHandler = new EnergyTransferEffectHandler();
