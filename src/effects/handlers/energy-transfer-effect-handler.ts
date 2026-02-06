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
 * Handler for energy transfer effects that move energy from one location to a field card.
 * Source can be field cards or discard pile; target is always a field card.
 */
export class EnergyTransferEffectHandler extends AbstractEffectHandler<EnergyTransferEffect> {
    /**
     * Get the resolution requirements for an energy transfer effect.
     * Energy transfer effects don't use automatic resolution - they handle it themselves.
     * 
     * @param effect The energy transfer effect to get resolution requirements for
     * @returns Empty array - resolution is handled in apply()
     */
    getResolutionRequirements(effect: EnergyTransferEffect): ResolutionRequirement[] {
        /*
         * We handle resolution ourselves in the apply method
         * because EnergyTarget wraps FieldTarget and needs custom handling
         */
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
        // Check if source field target requires selection
        if (effect.source.type === 'field') {
            if (FieldTargetResolver.handleTargetSelection(controllers, effect, context, effect.source.fieldTarget)) {
                return; // Pending selection for source
            }
        }

        // Check if target field target requires selection
        if (FieldTargetResolver.handleTargetSelection(controllers, effect, context, effect.target)) {
            return; // Pending selection for target
        }

        // Resolve source energy target
        const sourceResolution = EnergyTargetResolver.resolveTarget(effect.source, controllers, context);
        
        if (sourceResolution.type !== 'resolved') {
            throw new Error(`Expected resolved source energy target, got ${sourceResolution.type}`);
        }

        // Resolve target field target
        const targetResolution = FieldTargetResolver.resolveTarget(effect.target, controllers, context);
        
        if (targetResolution.type !== 'resolved') {
            throw new Error(`Expected resolved target field target, got ${targetResolution.type}`);
        }

        if (targetResolution.targets.length === 0) {
            throw new Error(`${context.effectName} target resolved to no valid targets`);
        }

        const source = sourceResolution;
        const targetFieldTarget = targetResolution.targets[0];

        // Get the target creature
        const targetCreature = controllers.field.getRawCardByPosition(targetFieldTarget.playerId, targetFieldTarget.fieldIndex);
        
        if (!targetCreature) {
            controllers.players.messageAll({
                type: 'status',
                components: [ `${context.effectName} target creature not found!` ],
            });
            return;
        }

        const targetInstanceId = getCurrentInstanceId(targetCreature);

        // Handle field-to-field energy transfer
        if (source.location === 'field') {
            if (source.playerId === undefined || source.fieldIndex === undefined) {
                throw new Error(`${context.effectName} source field location not specified`);
            }

            const sourceCreature = controllers.field.getRawCardByPosition(source.playerId, source.fieldIndex);
            
            if (!sourceCreature) {
                controllers.players.messageAll({
                    type: 'status',
                    components: [ `${context.effectName} source creature not found!` ],
                });
                return;
            }

            const sourceInstanceId = getCurrentInstanceId(sourceCreature);

            // Transfer each energy type specified in the resolved energy
            let transferred = 0;
            for (const energyType of Object.keys(source.energy) as AttachableEnergyType[]) {
                const amount = source.energy[energyType];
                if (amount && amount > 0) {
                    if (controllers.energy.transferEnergyBetweenInstances(
                        sourceInstanceId,
                        targetInstanceId,
                        energyType,
                        amount,
                    )) {
                        transferred += amount;
                    }
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
            return;
        }

        // Handle discard-to-field energy transfer
        if (source.location === 'discard') {
            if (source.discardPlayerId === undefined) {
                throw new Error(`${context.effectName} source discard player not specified`);
            }

            // Transfer each energy type from discard to field
            let transferred = 0;
            for (const energyType of Object.keys(source.energy) as AttachableEnergyType[]) {
                const amount = source.energy[energyType];
                if (amount && amount > 0) {
                    // Remove from discard pile
                    if (controllers.energy.removeDiscardedEnergy(source.discardPlayerId, energyType, amount)) {
                        // Attach to target
                        controllers.energy.attachSpecificEnergyToInstance(targetInstanceId, energyType, amount);
                        transferred += amount;
                    }
                }
            }

            if (transferred > 0) {
                controllers.players.messageAll({
                    type: 'status',
                    components: [ `${context.effectName} transferred ${transferred} energy from discard!` ],
                });
            } else {
                controllers.players.messageAll({
                    type: 'status',
                    components: [ `${context.effectName} could not transfer energy from discard!` ],
                });
            }
            return;
        }

        // Other combinations not yet supported
        controllers.players.messageAll({
            type: 'status',
            components: [ `${context.effectName} unsupported energy transfer configuration!` ],
        });
    }
}

export const energyTransferEffectHandler = new EnergyTransferEffectHandler();
