import { Controllers } from '../../controllers/controllers.js';
import { AttackEnergyCostModifierEffect } from '../../repository/effect-types.js';
import { EffectContext } from '../effect-context.js';
import { AbstractEffectHandler, ResolutionRequirement } from '../interfaces/effect-handler-interface.js';

/**
 * Handler for attack energy cost modifier effects that modify attack energy costs.
 */
export class AttackEnergyCostModifierEffectHandler extends AbstractEffectHandler<AttackEnergyCostModifierEffect> {
    /**
     * Get the resolution requirements for an attack energy cost modifier effect.
     * Attack energy cost modifier effects don't resolve targets—they match criteria passively.
     * 
     * @param effect The attack energy cost modifier effect to get resolution requirements for
     * @returns Empty array (no resolution needed)
     */
    getResolutionRequirements(effect: AttackEnergyCostModifierEffect): ResolutionRequirement[] {
        return [];
    }
    
    /**
     * Apply an attack energy cost modifier effect.
     * This registers a passive effect that modifies attack energy costs.
     * 
     * @param controllers Game controllers
     * @param effect The attack energy cost modifier effect to apply
     * @param context Effect context
     */
    apply(controllers: Controllers, effect: AttackEnergyCostModifierEffect, context: EffectContext): void {
        // Register as a passive effect with criteria matching
        controllers.effects.registerPassiveEffect(
            context.sourcePlayer,
            context.effectName,
            effect,
            effect.duration,
            controllers.turnCounter.getTurnNumber(),
        );
        
        // Show a message about the attack energy cost modification
        const amount = typeof effect.amount === 'object' && 'value' in effect.amount ? effect.amount.value : 0;
        const changeStr = amount < 0 ? `reduced by ${-amount}` : `increased by ${amount}`;
        controllers.players.messageAll({
            type: 'status',
            components: [ `${context.effectName} modifies attack energy costs (${changeStr})!` ],
        });
    }
}

export const attackEnergyCostModifierEffectHandler = new AttackEnergyCostModifierEffectHandler();
