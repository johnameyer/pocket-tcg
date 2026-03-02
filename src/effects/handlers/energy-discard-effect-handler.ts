import { Controllers } from '../../controllers/controllers.js';
import { EnergyDiscardEffect } from '../../repository/effect-types.js';
import { EffectContext } from '../effect-context.js';
import { AbstractEffectHandler, ResolutionRequirement } from '../interfaces/effect-handler-interface.js';
import { HandlerData } from '../../game-handler.js';
import { ResolvedMultiEnergyTarget } from '../target-resolvers/energy-target-resolver.js';
import { EnergyTarget } from '../../repository/targets/energy-target.js';
import { AttachableEnergyType } from '../../repository/energy-types.js';

/**
 * Handler for energy discard effects that discard energy from creatures.
 */
export class EnergyDiscardEffectHandler extends AbstractEffectHandler<EnergyDiscardEffect> {
    /**
     * Validate if an energy discard effect can be applied.
     * 
     * @param handlerData Handler data view
     * @param effect The energy discard effect to validate
     * @param context Effect context
     * @returns True if the effect can be applied, false otherwise
     */
    canApply(handlerData: HandlerData, effect: EnergyDiscardEffect, context: EffectContext): boolean {
        // Always allow discard effects to be applied
        return true;
    }

    /**
     * Get the resolution requirements for an energy discard effect.
     * The EnergyTargetResolver will handle resolving the inner fieldTarget automatically.
     * 
     * @param effect The energy discard effect to get resolution requirements for
     * @returns Array of resolution requirements
     */
    getResolutionRequirements(effect: EnergyDiscardEffect): ResolutionRequirement[] {
        /*
         * EnergyTarget (energySource) is the top-level field
         * The resolver will handle the inner fieldTarget resolution
         */
        return [
            // @ts-ignore - EnergyTarget is not compatible with FieldTarget, but this is validated separately
            { targetProperty: 'energySource', target: effect.energySource as EnergyTarget, required: true },
        ];
    }
    
    /**
     * Apply a fully resolved energy discard effect.
     * EnergyTargetResolver always resolves to ResolvedMultiEnergyTarget so we handle only that type.
     * 
     * @param controllers Game controllers
     * @param effect The energy discard effect to apply (with resolved energy source)
     * @param context Effect context
     */
    apply(controllers: Controllers, effect: EnergyDiscardEffect, context: EffectContext): void {
        const energySource = effect.energySource as ResolvedMultiEnergyTarget | EnergyTarget;

        if (energySource.type !== 'resolved-multi') {
            throw new Error(`Expected resolved-multi energy source, got ${energySource?.type || 'undefined'}`);
        }

        let totalDiscarded = 0;
        for (const target of energySource.targets) {
            totalDiscarded += this.discardEnergyFromTarget(controllers, target.playerId, target.fieldIndex, target.energy, context.effectName);
        }

        if (totalDiscarded === 0) {
            controllers.players.messageAll({
                type: 'status',
                components: [ `${context.effectName} could not discard any energy` ],
            });
        }
    }

    private discardEnergyFromTarget(
        controllers: Controllers,
        playerId: number,
        fieldIndex: number,
        energy: Partial<Record<AttachableEnergyType, number>>,
        effectName: string,
    ): number {
        const sourceInstanceId = controllers.field.getFieldInstanceId(playerId, fieldIndex);
        if (!sourceInstanceId) {
            controllers.players.messageAll({
                type: 'status',
                components: [ `${effectName} source creature not found!` ],
            });
            return 0;
        }
        
        // Discard the specified energy
        let discardedCount = 0;
        for (const [ energyType, count ] of Object.entries(energy)) {
            if (count && count > 0) {
                const success = controllers.energy.discardSpecificEnergyFromInstance(
                    playerId,
                    sourceInstanceId,
                    energyType as AttachableEnergyType,
                    count as number,
                );
                if (success) {
                    discardedCount += count as number;
                }
            }
        }
        
        if (discardedCount > 0) {
            controllers.players.messageAll({
                type: 'status',
                components: [ `${effectName} discarded ${discardedCount} energy!` ],
            });
        }
        return discardedCount;
    }
}

export const energyDiscardEffectHandler = new EnergyDiscardEffectHandler();
