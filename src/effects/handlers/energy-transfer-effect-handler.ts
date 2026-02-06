import { Controllers } from '../../controllers/controllers.js';
import { HandlerData } from '../../game-handler.js';
import { EnergyTransferEffect } from '../../repository/effect-types.js';
import { EffectContext } from '../effect-context.js';
import { AbstractEffectHandler, ResolutionRequirement } from '../interfaces/effect-handler-interface.js';
import { CardRepository } from '../../repository/card-repository.js';
import { AttachableEnergyType } from '../../repository/energy-types.js';
import { EnergyTargetResolver } from '../target-resolvers/energy-target-resolver.js';
import { FieldTargetResolver } from '../target-resolvers/field-target-resolver.js';
import { getCurrentInstanceId } from '../../utils/field-card-utils.js';

/**
 * Handler for energy transfer effects that move energy from one field card to another.
 * Source specifies which energy to take from a field card; target is the destination field card.
 */
export class EnergyTransferEffectHandler extends AbstractEffectHandler<EnergyTransferEffect> {
    /**
     * Get the resolution requirements for an energy transfer effect.
     * Returns empty because EnergyTarget wraps FieldTarget in a nested structure,
     * and the framework's property setter doesn't support nested paths.
     * Resolution is handled manually in apply().
     * 
     * @param effect The energy transfer effect to get resolution requirements for
     * @returns Empty array - resolution is handled manually in apply()
     */
    getResolutionRequirements(effect: EnergyTransferEffect): ResolutionRequirement[] {
        // Manual resolution in apply() because source.fieldTarget is a nested property
        // that the framework's resolvedEffect[targetProperty] = value doesn't support
        return [];
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
        // Use EnergyTargetResolver to check if source is available
        const sourceAvailable = EnergyTargetResolver.isTargetAvailable(effect.source, handlerData, context, cardRepository);
        // Use FieldTargetResolver to check if target is available
        const targetAvailable = FieldTargetResolver.isTargetAvailable(effect.target, handlerData, context, cardRepository);
        
        return sourceAvailable && targetAvailable;
    }
    
    apply(controllers: Controllers, effect: EnergyTransferEffect, context: EffectContext): void {
        // Manually handle target selection for both source.fieldTarget and target
        if (FieldTargetResolver.handleTargetSelection(controllers, effect, context, effect.source.fieldTarget)) {
            return; // Pending selection for source
        }

        if (FieldTargetResolver.handleTargetSelection(controllers, effect, context, effect.target)) {
            return; // Pending selection for target
        }

        // Resolve source.fieldTarget
        const sourceFieldResolution = FieldTargetResolver.resolveTarget(effect.source.fieldTarget, controllers, context);
        if (sourceFieldResolution.type !== 'resolved' || sourceFieldResolution.targets.length === 0) {
            throw new Error(`Expected resolved source field target`);
        }

        // Resolve target
        const targetResolution = FieldTargetResolver.resolveTarget(effect.target, controllers, context);
        if (targetResolution.type !== 'resolved' || targetResolution.targets.length === 0) {
            throw new Error(`Expected resolved target field target`);
        }

        const sourceFieldTarget = sourceFieldResolution.targets[0];
        const targetFieldTarget = targetResolution.targets[0];

        // Get the source creature
        const sourceCreature = controllers.field.getRawCardByPosition(sourceFieldTarget.playerId, sourceFieldTarget.fieldIndex);
        
        if (!sourceCreature) {
            controllers.players.messageAll({
                type: 'status',
                components: [ `${context.effectName} source creature not found!` ],
            });
            return;
        }

        // Get the target creature
        const targetCreature = controllers.field.getRawCardByPosition(targetFieldTarget.playerId, targetFieldTarget.fieldIndex);
        
        if (!targetCreature) {
            controllers.players.messageAll({
                type: 'status',
                components: [ `${context.effectName} target creature not found!` ],
            });
            return;
        }

        const sourceInstanceId = getCurrentInstanceId(sourceCreature);
        const targetInstanceId = getCurrentInstanceId(targetCreature);

        // Get attached energy and filter by criteria
        const attachedEnergy = controllers.energy.getAttachedEnergyByInstance(sourceInstanceId);
        const energyTypes = effect.source.criteria?.energyTypes;
        const count = effect.source.count;

        // Determine which energy types to transfer
        const typesToTransfer = energyTypes && energyTypes.length > 0 
            ? energyTypes 
            : Object.keys(attachedEnergy).filter(type => attachedEnergy[type as AttachableEnergyType] > 0) as AttachableEnergyType[];

        let transferred = 0;
        let remainingCount = count;

        // Transfer energy of specified types
        for (const energyType of typesToTransfer) {
            if (remainingCount <= 0) {
                break;
            }

            const available = attachedEnergy[energyType] || 0;
            const toTransfer = Math.min(available, remainingCount);

            if (toTransfer > 0 && controllers.energy.transferEnergyBetweenInstances(
                sourceInstanceId,
                targetInstanceId,
                energyType,
                toTransfer,
            )) {
                transferred += toTransfer;
                remainingCount -= toTransfer;
            }
        }

        // Send a message about the transfer
        if (transferred > 0) {
            controllers.players.messageAll({
                type: 'status',
                components: [ `${context.effectName} transferred ${transferred} energy!` ],
            });
        } else {
            controllers.players.messageAll({
                type: 'status',
                components: [ `${context.effectName} could not transfer energy!` ],
            });
        }
    }
}

export const energyTransferEffectHandler = new EnergyTransferEffectHandler();
