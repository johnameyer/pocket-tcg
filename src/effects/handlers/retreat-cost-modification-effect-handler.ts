import { Controllers } from '../../controllers/controllers.js';
import { RetreatCostModificationEffect } from '../../repository/effect-types.js';
import { EffectContext } from '../effect-context.js';
import { AbstractEffectHandler, ResolutionRequirement } from '../interfaces/effect-handler-interface.js';
import { getEffectValue } from '../effect-utils.js';

/**
 * Handler for retreat cost modification effects that modify the energy cost to retreat.
 */
export class RetreatCostModificationEffectHandler extends AbstractEffectHandler<RetreatCostModificationEffect> {
    /**
     * Get the resolution requirements for a retreat cost modification effect.
     * Retreat cost modification effects don't resolve targets—they match criteria passively.
     * 
     * @param effect The retreat cost modification effect
     * @returns Empty array (no resolution needed)
     */
    getResolutionRequirements(effect: RetreatCostModificationEffect): ResolutionRequirement[] {
        return [];
    }
    
    /**
     * Apply a retreat cost modification effect.
     * This registers a passive effect that modifies the energy cost required to retreat.
     * 
     * @param controllers Game controllers
     * @param effect The retreat cost modification effect to apply
     * @param context Effect context
     */
    apply(controllers: Controllers, effect: RetreatCostModificationEffect, context: EffectContext): void {
        // Get the amount of retreat cost modification
        const modificationAmount = getEffectValue(effect.amount, controllers, context);
        
        // Determine operation from unified effect type
        const operation = effect.operation;
        
        // Register as a passive effect with criteria matching
        controllers.effects.registerPassiveEffect(
            context.sourcePlayer,
            context.effectName,
            effect,
            effect.duration,
            controllers.turnCounter.getTurnNumber(),
        );
        
        // Send a message about the retreat cost modification
        const changeText = operation === 'decrease' 
            ? `reduces retreat cost by ${modificationAmount}` 
            : `increases retreat cost by ${modificationAmount}`;
        controllers.players.messageAll({
            type: 'status',
            components: [ `${context.effectName} ${changeText}!` ],
        });
    }
}

export const retreatCostModificationEffectHandler = new RetreatCostModificationEffectHandler();
