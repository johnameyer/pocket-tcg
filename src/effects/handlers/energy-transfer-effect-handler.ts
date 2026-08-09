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

        // Flatten the resolved source(s) into individual 1-unit energy cards, preserving origin
        // so each unit can be removed correctly (field creature vs. discard pile) when consumed.
        type EnergyUnit = { energyType: AttachableEnergyType; location: 'field' | 'discard'; playerId: number; fieldIndex: number };
        const units: EnergyUnit[] = [];
        for (const sourceTarget of resolvedSource.targets) {
            const location = sourceTarget.location ?? 'field';
            for (const [ energyType, amount ] of Object.entries(sourceTarget.energy) as Array<[ AttachableEnergyType, number ]>) {
                for (let i = 0; i < (amount || 0); i++) {
                    units.push({ energyType, location, playerId: sourceTarget.playerId, fieldIndex: sourceTarget.fieldIndex });
                }
            }
        }

        /*
         * Single destination: move every sourced unit there (e.g. "move energy from X to Y").
         * Multiple destinations: spread 1 unit to each, in order, until either the pool or the
         * destination list is exhausted (e.g. "move 2 Lightning Energy... 1 each to 2 Benched Pokemon").
         */
        const unitsPerDestination = resolvedTarget.targets.length === 1 ? units.length : 1;

        let transferred = 0;
        for (const destination of resolvedTarget.targets) {
            const destInstanceId = controllers.field.getFieldInstanceId(destination.playerId, destination.fieldIndex);
            if (!destInstanceId) {
                continue;
            }

            for (let i = 0; i < unitsPerDestination; i++) {
                const unit = units.shift();
                if (!unit) {
                    break;
                }

                let success: boolean;
                if (unit.location === 'discard') {
                    success = controllers.energy.attachEnergyFromDiscard(unit.playerId, destInstanceId, { [unit.energyType]: 1 });
                } else {
                    const sourceInstanceId = controllers.field.getFieldInstanceId(unit.playerId, unit.fieldIndex);
                    success = !!sourceInstanceId && controllers.energy.transferEnergyBetweenInstances(sourceInstanceId, destInstanceId, unit.energyType, 1);
                }

                if (success) {
                    transferred += 1;
                }
            }
        }

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
