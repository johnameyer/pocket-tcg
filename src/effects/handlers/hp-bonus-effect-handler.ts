import { Controllers } from '../../controllers/controllers.js';
import { HpBonusEffect } from '../../repository/effect-types.js';
import { EffectContext } from '../effect-context.js';
import { AbstractEffectHandler, ResolutionRequirement } from '../effect-handler.js';
import { getEffectValue } from '../effect-utils.js';

/**
 * Handler for HP bonus effects that increase a creature's maximum HP.
 */
export class HpBonusEffectHandler extends AbstractEffectHandler<HpBonusEffect> {
    /**
     * Get the resolution requirements for an HP bonus effect.
     * HP bonus effects don't resolve targets—they match criteria passively.
     * 
     * @param effect The HP bonus effect to get resolution requirements for
     * @returns Empty array (no resolution needed)
     */
    getResolutionRequirements(effect: HpBonusEffect): ResolutionRequirement[] {
        return [];
    }
    
    /**
     * Apply an HP bonus effect.
     * This registers a passive effect that increases the maximum HP of creatures matching the target criteria.
     * 
     * @param controllers Game controllers
     * @param effect The HP bonus effect to apply
     * @param context Effect context
     */
    apply(controllers: Controllers, effect: HpBonusEffect, context: EffectContext): void {
        // Get the amount of HP to add
        const amount = getEffectValue(effect.amount, controllers, context);
        
        // Register as a passive effect with criteria matching
        controllers.effects.registerPassiveEffect(
            context.sourcePlayer,
            context.effectName,
            effect,
            effect.duration,
            controllers.turnCounter.getTurnNumber(),
        );
        
        // Show a message about the HP bonus being applied
        controllers.players.messageAll({
            type: 'status',
            components: [ `${context.effectName} increases creature's HP by ${amount}!` ],
        });
    }
}

export const hpBonusEffectHandler = new HpBonusEffectHandler();
