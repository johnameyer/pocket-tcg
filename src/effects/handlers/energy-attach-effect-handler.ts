import { Controllers } from '../../controllers/controllers.js';
import { EnergyAttachEffect } from '../../repository/effect-types.js';
import { EffectContext } from '../effect-context.js';
import { AbstractEffectHandler, ResolutionRequirement } from '../interfaces/effect-handler-interface.js';
import { getEffectValue, getCreatureFromTarget } from '../effect-utils.js';
import { HandlerData } from '../../game-handler.js';
import { TriggerProcessor } from '../trigger-processor.js';

/**
 * Handler for energy attach effects that attach energy to creatures.
 */
export class EnergyAttachEffectHandler extends AbstractEffectHandler<EnergyAttachEffect> {
    /**
     * Validate if an energy attach effect can be applied.
     * Energy attach effects can always be applied, even if there are no energy cards available.
     * 
     * @param handlerData Handler data view
     * @param effect The energy attach effect to validate
     * @param context Effect context
     * @returns True if the effect can be applied, false otherwise
     */
    canApply(handlerData: HandlerData, effect: EnergyAttachEffect, context: EffectContext): boolean {
        /*
         * Always allow energy attach effects to be applied
         * The effect will attach as many energy cards as possible (or none if none are available)
         */
        return true;
    }

    /**
     * Get the resolution requirements for an energy attach effect.
     * 
     * @param effect The energy attach effect to get resolution requirements for
     * @returns Array of resolution requirements
     */
    getResolutionRequirements(effect: EnergyAttachEffect): ResolutionRequirement[] {
        return [
            { targetProperty: 'target', target: effect.target, required: true },
        ];
    }
    
    /**
     * Apply a fully resolved energy attach effect.
     * This is called after all targets have been resolved.
     * 
     * @param controllers Game controllers
     * @param effect The energy attach effect to apply (with resolved targets)
     * @param context Effect context
     */
    apply(controllers: Controllers, effect: EnergyAttachEffect, context: EffectContext): void {
        const amount = getEffectValue(effect.amount, controllers, context);
        const energyType = effect.energyType;

        if (effect.target.type !== 'resolved') {
            throw new Error(`Expected resolved target, got ${effect.target?.type || 'undefined'}`);
        }
        
        const targets = effect.target.targets;
        
        if (targets.length === 0) {
            controllers.players.messageAll({
                type: 'status',
                components: [ `${context.effectName} has no valid targets` ],
            });
            return;
        }
        
        for (const target of targets) {
            const { playerId, fieldIndex } = target;
            
            const fieldInstanceId = controllers.field.getFieldInstanceId(playerId, fieldIndex);
            if (!fieldInstanceId) {
                controllers.players.messageAll({
                    type: 'status',
                    components: [ `${context.effectName} target creature not found!` ],
                });
                continue;
            }
            
            const targetCreature = getCreatureFromTarget(controllers, playerId, fieldIndex);
            if (!targetCreature) {
                continue;
            }
            
            const creatureName = targetCreature.data.name;
            
            const success = controllers.energy.attachSpecificEnergyToInstance(
                fieldInstanceId, 
                energyType, 
                amount,
            );
            
            if (success) {
                controllers.players.messageAll({
                    type: 'status',
                    components: [ `${context.effectName} attached ${amount} ${energyType} energy to ${creatureName}!` ],
                });
                
                TriggerProcessor.processEnergyAttachment(
                    controllers,
                    playerId,
                    targetCreature.instanceId,
                    targetCreature.templateId,
                    energyType,
                );
            }
        }
    }
}

export const energyAttachEffectHandler = new EnergyAttachEffectHandler();
