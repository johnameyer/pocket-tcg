import { Controllers } from '../../controllers/controllers.js';
import { EnergyEffect } from '../../repository/effect-types.js';
import { EffectContext } from '../effect-context.js';
import { AbstractEffectHandler, ResolutionRequirement } from '../interfaces/effect-handler-interface.js';
import { getEffectValue, getCreatureFromTarget } from '../effect-utils.js';
import { HandlerData } from '../../game-handler.js';
import { TriggerProcessor } from '../trigger-processor.js';
import { FieldTargetResolver } from '../target-resolvers/field-target-resolver.js';
import { getCurrentInstanceId } from '../../utils/field-card-utils.js';
import { AttachableEnergyType } from '../../repository/energy-types.js';

/**
 * Handler for energy effects that attach or discard energy cards.
 */
export class EnergyEffectHandler extends AbstractEffectHandler<EnergyEffect> {
    /**
     * Validate if an energy effect can be applied.
     * Energy effects can always be applied, even if there are no energy cards in the deck.
     * 
     * @param handlerData Handler data view
     * @param effect The energy effect to validate
     * @param context Effect context
     * @returns True if the effect can be applied, false otherwise
     */
    canApply(handlerData: HandlerData, effect: EnergyEffect, context: EffectContext): boolean {
        /*
         * Always allow energy effects to be applied
         * The effect will attach as many energy cards as possible (or none if none are available)
         */
        return true;
    }

    /**
     * Get the resolution requirements for an energy effect.
     * For attach operations, requires target resolution.
     * For discard operations, manual resolution is needed due to nested field targets in energySource.
     * 
     * @param effect The energy effect to get resolution requirements for
     * @returns Array of resolution requirements
     */
    getResolutionRequirements(effect: EnergyEffect): ResolutionRequirement[] {
        const requirements: ResolutionRequirement[] = [];
        
        // For attach operations or legacy discard operations, resolve the target
        if (effect.target) {
            requirements.push({ targetProperty: 'target', target: effect.target, required: true });
        }
        
        /*
         * For discard operations with energySource, we can't use automatic resolution
         * because energySource.fieldTarget is a nested property that the framework doesn't support
         * Resolution will be handled manually in apply()
         */
        
        return requirements;
    }
    
    /**
     * Apply a fully resolved energy effect.
     * This is called after all targets have been resolved.
     * 
     * @param controllers Game controllers
     * @param effect The energy effect to apply (with resolved targets)
     * @param context Effect context
     */
    apply(controllers: Controllers, effect: EnergyEffect, context: EffectContext): void {
        const operation = effect.operation;
        
        // Handle attach operation (uses target field)
        if (operation === 'attach') {
            this.applyAttach(controllers, effect, context);
            return;
        }
        
        // Handle discard operation
        if (operation === 'discard') {
            // Check if using new energySource style
            if (effect.energySource) {
                this.applyDiscardWithEnergySource(controllers, effect, context);
            } else {
                // Legacy style: uses target, energyType, amount
                this.applyLegacyDiscard(controllers, effect, context);
            }
            return;
        }
    }
    
    /**
     * Apply attach operation using target, energyType, and amount fields.
     */
    private applyAttach(controllers: Controllers, effect: EnergyEffect, context: EffectContext): void {
        if (!effect.target || !effect.energyType || effect.amount === undefined) {
            throw new Error('Attach operation requires target, energyType, and amount');
        }
        
        const amount = getEffectValue(effect.amount, controllers, context);
        const energyType = effect.energyType;

        if (effect.target.type !== 'resolved') {
            throw new Error(`Expected resolved target, got ${effect.target?.type || effect.target}`);
        }
        
        const targets = effect.target.targets;
        
        if (targets.length === 0) {
            throw new Error(`${context.effectName} resolved to no valid targets`);
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
    
    /**
     * Apply discard operation using energySource field (new style).
     */
    private applyDiscardWithEnergySource(controllers: Controllers, effect: EnergyEffect, context: EffectContext): void {
        if (!effect.energySource) {
            return;
        }
        
        const energySource = effect.energySource;
        
        // Manually handle field target resolution
        if (FieldTargetResolver.handleTargetSelection(controllers, effect, context, energySource.fieldTarget)) {
            return; // Pending selection
        }
        
        const fieldResolution = FieldTargetResolver.resolveTarget(energySource.fieldTarget, controllers, context);
        if (fieldResolution.type !== 'resolved' || fieldResolution.targets.length === 0) {
            throw new Error('Expected resolved field target for energySource');
        }
        
        const sourceTarget = fieldResolution.targets[0];
        const sourceCreature = controllers.field.getRawCardByPosition(sourceTarget.playerId, sourceTarget.fieldIndex);
        
        if (!sourceCreature) {
            controllers.players.messageAll({
                type: 'status',
                components: [ `${context.effectName} source creature not found!` ],
            });
            return;
        }
        
        const sourceInstanceId = getCurrentInstanceId(sourceCreature);
        const attachedEnergy = controllers.energy.getAttachedEnergyByInstance(sourceInstanceId);
        
        // Determine which energy types to discard
        const energyTypes = energySource.criteria?.energyTypes;
        const count = energySource.count;
        
        const typesToDiscard = energyTypes && energyTypes.length > 0 
            ? energyTypes 
            : Object.keys(attachedEnergy).filter(type => attachedEnergy[type as AttachableEnergyType] > 0) as AttachableEnergyType[];
        
        let discarded = 0;
        let remainingCount = count;
        
        // Discard energy of specified types
        for (const energyType of typesToDiscard) {
            if (remainingCount <= 0) {
                break;
            }
            
            const available = attachedEnergy[energyType] || 0;
            const toDiscard = Math.min(available, remainingCount);
            
            if (toDiscard > 0 && controllers.energy.discardSpecificEnergyFromInstance(
                sourceTarget.playerId,
                sourceInstanceId,
                energyType,
                toDiscard,
            )) {
                discarded += toDiscard;
                remainingCount -= toDiscard;
            }
        }
        
        if (discarded > 0) {
            controllers.players.messageAll({
                type: 'status',
                components: [ `${context.effectName} discarded ${discarded} energy!` ],
            });
        }
    }
    
    /**
     * Apply legacy discard operation using target, energyType, and amount fields.
     */
    private applyLegacyDiscard(controllers: Controllers, effect: EnergyEffect, context: EffectContext): void {
        if (!effect.target || !effect.energyType || effect.amount === undefined) {
            throw new Error('Legacy discard operation requires target, energyType, and amount');
        }
        
        const amount = getEffectValue(effect.amount, controllers, context);
        const energyType = effect.energyType;

        // Handle target resolution check - could be already resolved or need to check
        if (!effect.target || effect.target.type !== 'resolved') {
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
                continue;
            }
            
            const success = controllers.energy.discardSpecificEnergyFromInstance(
                playerId,
                fieldInstanceId, 
                energyType, 
                amount,
            );
            
            if (success) {
                const targetCreature = getCreatureFromTarget(controllers, playerId, fieldIndex);
                const creatureName = targetCreature?.data.name || 'creature';
                controllers.players.messageAll({
                    type: 'status',
                    components: [ `${context.effectName} discarded ${amount} ${energyType} energy from ${creatureName}!` ],
                });
            }
        }
    }
}

export const energyEffectHandler = new EnergyEffectHandler();
