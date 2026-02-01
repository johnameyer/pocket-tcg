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
     * Retreat cost reduction effects don't have targets to resolve.
     * 
     * @param effect The retreat cost reduction effect
     * @returns Empty array as retreat cost reduction effects don't have targets
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
        
        // Get the active creature
        const activecreature = controllers.field.getCardByPosition(context.sourcePlayer, 0);
        if (!activecreature) {
            return;
        }
        
        // Determine duration - default to until-end-of-turn if not specified
        const duration = effect.duration || { type: 'until-end-of-turn' as const };
        
        // Register as a passive effect
        controllers.passiveEffects.registerPassiveEffect(
            context.sourcePlayer,
            context.effectName,
            {
                type: 'retreat-cost-reduction',
                amount: effect.amount,
            },
            duration,
            controllers.turnCounter.getTurnNumber()
        );
        
        // Send a message about the retreat cost reduction
        controllers.players.messageAll({
            type: 'status',
            components: [ `${context.effectName} reduces retreat cost by ${reductionAmount}!` ],
        });
    }
}

export const retreatCostReductionEffectHandler = new RetreatCostReductionEffectHandler();
