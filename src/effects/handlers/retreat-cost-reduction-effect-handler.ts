import { Controllers } from '../../controllers/controllers.js';
import { RetreatCostReductionEffect } from '../../repository/effect-types.js';
import { EffectContext } from '../effect-context.js';
import { AbstractEffectHandler, ResolutionRequirement } from '../effect-handler.js';
import { getEffectValue } from '../effect-utils.js';

/**
 * Handler for retreat cost reduction effects that reduce the energy cost to retreat.
 */
export class RetreatCostReductionEffectHandler extends AbstractEffectHandler<RetreatCostReductionEffect> {
    /**
     * Get the resolution requirements for a retreat cost reduction effect.
     * Retreat cost reduction effects don't resolve targets—they match criteria passively.
     * 
     * @param effect The retreat cost reduction effect
     * @returns Empty array (no resolution needed)
     */
    getResolutionRequirements(effect: RetreatCostReductionEffect): ResolutionRequirement[] {
        return [];
    }
    
    /**
     * Apply a retreat cost reduction effect.
     * This registers a passive effect that reduces the energy cost required to retreat.
     * 
     * @param controllers Game controllers
     * @param effect The retreat cost reduction effect to apply
     * @param context Effect context
     */
    apply(controllers: Controllers, effect: RetreatCostReductionEffect, context: EffectContext): void {
        // Get the amount of retreat cost reduction
        const reductionAmount = getEffectValue(effect.amount, controllers, context);
        
        // Register as a passive effect with criteria matching
        controllers.effects.registerPassiveEffect(
            context.sourcePlayer,
            context.effectName,
            effect,
            effect.duration,
            controllers.turnCounter.getTurnNumber(),
        );
        
        // Send a message about the retreat cost reduction
        controllers.players.messageAll({
            type: 'status',
            components: [ `${context.effectName} reduces retreat cost by ${reductionAmount}!` ],
        });
    }
}

export const retreatCostReductionEffectHandler = new RetreatCostReductionEffectHandler();
