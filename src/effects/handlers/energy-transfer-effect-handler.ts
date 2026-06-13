import { Controllers } from '../../controllers/controllers.js';
import { HandlerData } from '../../game-handler.js';
import { EnergyTransferEffect } from '../../repository/effect-types.js';
import { EffectContext } from '../effect-context.js';
import { AbstractEffectHandler, ResolutionRequirement } from '../interfaces/effect-handler-interface.js';
import { CardRepository } from '../../repository/card-repository.js';
import { AttachableEnergyType } from '../../repository/energy-types.js';
import { EnergyTargetResolver, ResolvedMultiEnergyTarget } from '../target-resolvers/energy-target-resolver.js';
import { FieldTargetResolver } from '../target-resolvers/field-target-resolver.js';
import { ResolvedFieldTarget } from '../../repository/targets/field-target.js';

/**
 * Handler for energy transfer effects that move energy from one field card to another.
 * Source specifies which energy to take from a field card; target is the destination field card.
 */
export class EnergyTransferEffectHandler extends AbstractEffectHandler<EnergyTransferEffect> {
    /**
     * Get the resolution requirements for an energy transfer effect.
     * Source uses EnergyTargetResolver (for source creature + energy choice),
     * then target uses FieldTargetResolver for destination creature.
     * 
     * @param effect The energy transfer effect to get resolution requirements for
     * @returns Resolution requirements for source and target
     */
    getResolutionRequirements(effect: EnergyTransferEffect): ResolutionRequirement[] {
        return [
            { targetProperty: 'source', target: effect.source, required: true },
            { targetProperty: 'target', target: effect.target, required: true },
        ];
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
        const resolvedSource = effect.source as unknown as ResolvedMultiEnergyTarget;
        if (resolvedSource.type !== 'resolved-multi' || resolvedSource.targets.length === 0) {
            throw new Error(`Expected resolved-multi source, got ${resolvedSource?.type || 'undefined'}`);
        }

        const resolvedTarget = effect.target as ResolvedFieldTarget;
        if (resolvedTarget.type !== 'resolved' || resolvedTarget.targets.length === 0) {
            throw new Error(`Expected resolved target, got ${resolvedTarget?.type || 'undefined'}`);
        }

        const sourceFieldTarget = resolvedSource.targets[0];
        const targetFieldTarget = resolvedTarget.targets[0];

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

        const sourceInstanceId = controllers.field.getFieldInstanceId(sourceFieldTarget.playerId, sourceFieldTarget.fieldIndex);
        const targetInstanceId = controllers.field.getFieldInstanceId(targetFieldTarget.playerId, targetFieldTarget.fieldIndex);

        if (!sourceInstanceId || !targetInstanceId) {
            controllers.players.messageAll({
                type: 'status',
                components: [ `${context.effectName} could not resolve transfer targets!` ],
            });
            return;
        }

        const selectedEnergy = resolvedSource.targets[0].energy;
        let transferred = 0;
        for (const [ energyType, amount ] of Object.entries(selectedEnergy) as Array<[ AttachableEnergyType, number ]>) {
            if (amount > 0 && controllers.energy.transferEnergyBetweenInstances(
                sourceInstanceId,
                targetInstanceId,
                energyType,
                amount,
            )) {
                transferred += amount;
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
