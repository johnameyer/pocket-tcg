import { EnergyTarget, EnergyCriteria } from '../../repository/targets/energy-target.js';
import { Controllers } from '../../controllers/controllers.js';
import { EffectContext } from '../effect-context.js';
import { AttachableEnergyType } from '../../repository/energy-types.js';
import { EnergyDictionary } from '../../controllers/energy-controller.js';
import { getCurrentInstanceId } from '../../utils/field-card-utils.js';
import { HandlerData } from '../../game-handler.js';
import { CardRepository } from '../../repository/card-repository.js';
import { FieldTargetResolver } from './field-target-resolver.js';

/**
 * Represents a resolved energy target with specific energy selections from a field card.
 */
export type ResolvedEnergyTarget = {
    type: 'resolved';
    /** Energy location (always 'field' for EnergyTarget) */
    location: 'field';
    /** The creature that has the energy */
    playerId: number;
    fieldIndex: number;
    /** The specific energy amounts to transfer/discard */
    energy: Partial<Record<AttachableEnergyType, number>>;
};

/**
 * Result of energy target resolution.
 */
export type EnergyTargetResolutionResult =
    | ResolvedEnergyTarget
    | { type: 'requires-selection', availableTargets: EnergyOption[] }
    | { type: 'no-valid-targets' };

/**
 * Represents an energy selection option for the player.
 */
export interface EnergyOption {
    /** Field position of the energy */
    playerId: number;
    fieldIndex: number;
    /** Available energy that matches criteria */
    availableEnergy: Partial<Record<AttachableEnergyType, number>>;
    /** Display name for the option */
    displayName: string;
}

/**
 * Centralized class for handling energy target resolution.
 * Resolves energy targets from field cards only.
 */
export class EnergyTargetResolver {
    /**
     * Resolves an energy target, handling field-based energy only.
     * 
     * @param target The energy target to resolve
     * @param controllers Game controllers
     * @param context Effect context
     * @returns An EnergyTargetResolutionResult indicating how the energy target was resolved
     */
    static resolveTarget(
        target: EnergyTarget | undefined,
        controllers: Controllers,
        context: EffectContext,
    ): EnergyTargetResolutionResult {
        if (!target) {
            return { type: 'no-valid-targets' };
        }

        return this.resolveFieldEnergyTarget(target, controllers, context);
    }

    /**
     * Resolves a field-based energy target.
     * 
     * @param target The field energy target
     * @param controllers Game controllers
     * @param context Effect context
     * @returns Resolution result
     */
    private static resolveFieldEnergyTarget(
        target: EnergyTarget,
        controllers: Controllers,
        context: EffectContext,
    ): EnergyTargetResolutionResult {
        // First, resolve the field target to determine which creature(s)
        const fieldResolution = FieldTargetResolver.resolveTarget(target.fieldTarget, controllers, context);

        if (fieldResolution.type === 'no-valid-targets') {
            return { type: 'no-valid-targets' };
        }

        if (fieldResolution.type === 'requires-selection') {
            // Convert field target options to energy target options
            const energyOptions: EnergyOption[] = [];
            
            for (const option of fieldResolution.availableTargets) {
                const creature = controllers.field.getRawCardByPosition(option.playerId, option.fieldIndex);
                if (!creature) {
                    continue;
                }

                const instanceId = getCurrentInstanceId(creature);
                const attachedEnergy = controllers.energy.getAttachedEnergyByInstance(instanceId);
                const availableEnergy = this.filterEnergyByCriteria(attachedEnergy, target.criteria);

                // Only include if there's available energy matching criteria
                if (this.getTotalEnergy(availableEnergy) > 0) {
                    energyOptions.push({
                        playerId: option.playerId,
                        fieldIndex: option.fieldIndex,
                        availableEnergy,
                        displayName: `${option.name} (${option.position})`,
                    });
                }
            }

            if (energyOptions.length === 0) {
                return { type: 'no-valid-targets' };
            }

            // If only one option, auto-resolve it
            if (energyOptions.length === 1) {
                return this.resolveEnergyOption(energyOptions[0], target.count);
            }

            return { type: 'requires-selection', availableTargets: energyOptions };
        }

        // Handle resolved field target
        if (fieldResolution.type === 'resolved' && fieldResolution.targets.length > 0) {
            const fieldTarget = fieldResolution.targets[0];
            const creature = controllers.field.getRawCardByPosition(fieldTarget.playerId, fieldTarget.fieldIndex);
            
            if (!creature) {
                return { type: 'no-valid-targets' };
            }

            const instanceId = getCurrentInstanceId(creature);
            const attachedEnergy = controllers.energy.getAttachedEnergyByInstance(instanceId);
            const availableEnergy = this.filterEnergyByCriteria(attachedEnergy, target.criteria);

            if (this.getTotalEnergy(availableEnergy) === 0) {
                return { type: 'no-valid-targets' };
            }

            // Select energy up to the requested count
            const selectedEnergy = this.selectEnergy(availableEnergy, target.count);

            return {
                type: 'resolved',
                location: 'field',
                playerId: fieldTarget.playerId,
                fieldIndex: fieldTarget.fieldIndex,
                energy: selectedEnergy,
            };
        }

        // Handle all-matching targets
        if (fieldResolution.type === 'all-matching') {
            /*
             * For all-matching, we need to gather energy from all matching creatures
             * This is complex - for now, we'll require selection
             */
            const energyOptions: EnergyOption[] = [];
            
            for (const fieldTarget of fieldResolution.targets) {
                const creature = controllers.field.getRawCardByPosition(fieldTarget.playerId, fieldTarget.fieldIndex);
                if (!creature) {
                    continue;
                }

                const instanceId = getCurrentInstanceId(creature);
                const attachedEnergy = controllers.energy.getAttachedEnergyByInstance(instanceId);
                const availableEnergy = this.filterEnergyByCriteria(attachedEnergy, target.criteria);

                if (this.getTotalEnergy(availableEnergy) > 0) {
                    const cardData = controllers.cardRepository.getCreature(creature.templateId);
                    energyOptions.push({
                        playerId: fieldTarget.playerId,
                        fieldIndex: fieldTarget.fieldIndex,
                        availableEnergy,
                        displayName: cardData?.name || 'Unknown',
                    });
                }
            }

            if (energyOptions.length === 0) {
                return { type: 'no-valid-targets' };
            }

            return { type: 'requires-selection', availableTargets: energyOptions };
        }

        return { type: 'no-valid-targets' };
    }

    /**
     * Filters energy dictionary by criteria (energy types).
     * 
     * @param energy The energy dictionary to filter
     * @param criteria Optional criteria to filter by
     * @returns Filtered energy dictionary
     */
    private static filterEnergyByCriteria(
        energy: EnergyDictionary,
        criteria?: EnergyCriteria,
    ): Partial<Record<AttachableEnergyType, number>> {
        if (!criteria || !criteria.energyTypes || criteria.energyTypes.length === 0) {
            // No criteria means all energy types
            return { ...energy };
        }

        const filtered: Partial<Record<AttachableEnergyType, number>> = {};
        for (const type of criteria.energyTypes) {
            if (energy[type] > 0) {
                filtered[type] = energy[type];
            }
        }
        return filtered;
    }

    /**
     * Selects energy from available energy up to the requested count.
     * Distributes evenly across available types.
     * 
     * @param availableEnergy Available energy to select from
     * @param count Maximum count to select
     * @returns Selected energy
     */
    private static selectEnergy(
        availableEnergy: Partial<Record<AttachableEnergyType, number>>,
        count: number,
    ): Partial<Record<AttachableEnergyType, number>> {
        const selected: Partial<Record<AttachableEnergyType, number>> = {};
        let remaining = count;

        // First pass: take at least 1 of each type if available
        const types = Object.keys(availableEnergy) as AttachableEnergyType[];
        for (const type of types) {
            const available = availableEnergy[type] || 0;
            if (available > 0 && remaining > 0) {
                const take = Math.min(1, available, remaining);
                selected[type] = take;
                remaining -= take;
            }
        }

        // Second pass: distribute remaining count across types
        if (remaining > 0) {
            for (const type of types) {
                const available = availableEnergy[type] || 0;
                const alreadySelected = selected[type] || 0;
                const canTake = available - alreadySelected;
                
                if (canTake > 0 && remaining > 0) {
                    const take = Math.min(canTake, remaining);
                    selected[type] = alreadySelected + take;
                    remaining -= take;
                }
            }
        }

        return selected;
    }

    /**
     * Resolves a single energy option to a resolved target.
     * 
     * @param option The energy option to resolve
     * @param count The number of energy to select
     * @returns Resolved energy target
     */
    private static resolveEnergyOption(
        option: EnergyOption,
        count: number,
    ): ResolvedEnergyTarget {
        const selectedEnergy = this.selectEnergy(option.availableEnergy, count);

        return {
            type: 'resolved',
            location: 'field',
            playerId: option.playerId,
            fieldIndex: option.fieldIndex,
            energy: selectedEnergy,
        };
    }

    /**
     * Gets the total number of energy in an energy dictionary.
     * 
     * @param energy Energy dictionary
     * @returns Total energy count
     */
    private static getTotalEnergy(energy: Partial<Record<AttachableEnergyType, number>>): number {
        return Object.values(energy).reduce((sum, count) => sum + (count || 0), 0);
    }

    /**
     * Checks if an energy target is available (has valid targets).
     * 
     * @param target The energy target to check
     * @param handlerData Handler data view
     * @param context Effect context
     * @param cardRepository Card repository
     * @returns True if the target is available, false otherwise
     */
    static isTargetAvailable(
        target: EnergyTarget | undefined,
        handlerData: HandlerData,
        context: EffectContext,
        cardRepository: CardRepository,
    ): boolean {
        if (!target) {
            return false;
        }

        // Check if field target has any creatures with matching energy
        const fieldTarget = target.fieldTarget;
        
        // Use FieldTargetResolver to check if field target is available
        const isFieldAvailable = FieldTargetResolver.isTargetAvailable(
            fieldTarget,
            handlerData,
            context,
            cardRepository,
            (creature) => {
                // Custom validator: check if creature has energy matching criteria
                const instanceId = getCurrentInstanceId(creature);
                const attachedEnergy = handlerData.energy?.attachedEnergyByInstance?.[instanceId];
                
                if (!attachedEnergy) {
                    return false;
                }

                const filtered = this.filterEnergyByCriteria(attachedEnergy, target.criteria);
                return this.getTotalEnergy(filtered) > 0;
            },
        );

        return isFieldAvailable;
    }
}
