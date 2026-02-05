import { Controllers } from '../../controllers/controllers.js';
import { RetreatCostIncreaseEffect } from '../../repository/effect-types.js';
import { EffectContext } from '../effect-context.js';
import { AbstractEffectHandler, ResolutionRequirement } from '../interfaces/effect-handler-interface.js';

/**
 * Handler for retreat cost increase effects that increase the energy cost of retreating.
 */
export class RetreatCostIncreaseEffectHandler extends AbstractEffectHandler<RetreatCostIncreaseEffect> {
    /**
     * Get the resolution requirements for a retreat cost increase effect.
     * Retreat cost increase effects don't resolve targets—they match criteria passively.
     * 
     * @param effect The retreat cost increase effect to get resolution requirements for
     * @returns Empty array (no resolution needed)
     */
    getResolutionRequirements(effect: RetreatCostIncreaseEffect): ResolutionRequirement[] {
        return [];
    }
    
    /**
     * Apply a retreat cost increase effect.
     * This registers a passive effect that increases retreat costs.
     * 
     * @param controllers Game controllers
     * @param effect The retreat cost increase effect to apply
     * @param context Effect context
     */
    apply(controllers: Controllers, effect: RetreatCostIncreaseEffect, context: EffectContext): void {
        // Register as a passive effect with criteria matching
        controllers.effects.registerPassiveEffect(
            context.sourcePlayer,
            context.effectName,
            effect,
            effect.duration,
            controllers.turnCounter.getTurnNumber(),
        );
        
        // Show a message about the retreat cost increase
        const amount = typeof effect.amount === 'object' && 'value' in effect.amount ? effect.amount.value : 0;
        controllers.players.messageAll({
            type: 'status',
            components: [ `${context.effectName} increases retreat cost by ${amount}!` ],
        });
    }
}

export const retreatCostIncreaseEffectHandler = new RetreatCostIncreaseEffectHandler();
