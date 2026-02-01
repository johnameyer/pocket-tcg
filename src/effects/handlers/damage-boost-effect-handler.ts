import { Controllers } from '../../controllers/controllers.js';
import { DamageBoostEffect } from '../../repository/effect-types.js';
import { EffectContext } from '../effect-context.js';
import { AbstractEffectHandler, ResolutionRequirement } from '../interfaces/effect-handler-interface.js';
import { getEffectValue } from '../effect-utils.js';

/**
 * Handler for damage boost effects that increase the damage dealt by attacks.
 */
export class DamageBoostEffectHandler extends AbstractEffectHandler<DamageBoostEffect> {
    /**
     * Damage boost effects don't have targets to resolve.
     * 
     * @param effect The damage boost effect
     * @returns Empty array as damage boost effects don't have targets
     */
    getResolutionRequirements(effect: DamageBoostEffect): ResolutionRequirement[] {
        return [];
    }
    
    /**
     * Apply a damage boost effect.
     * This adds a damage boost to the player's active creature.
     * 
     * @param controllers Game controllers
     * @param effect The damage boost effect to apply
     * @param context Effect context
     */
    apply(controllers: Controllers, effect: DamageBoostEffect, context: EffectContext): void {
        const amount = getEffectValue(effect.amount, controllers, context);
        const activecreature = controllers.field.getCardByPosition(context.sourcePlayer, 0);
        if(!activecreature) {
            throw new Error(`No active creature found for player ${context.sourcePlayer}`);
        }
        
        controllers.turnState.addDamageBoost(context.sourcePlayer, amount, context.effectName);
        
        const targetText = effect.target ? ' conditionally' : '';
        const conditionText = effect.condition ? ' when condition is met' : '';
        controllers.players.messageAll({
            type: 'status',
            components: [ `${context.effectName} adds ${amount} damage${targetText}${conditionText}!` ],
        });
    }
}

export const damageBoostEffectHandler = new DamageBoostEffectHandler();
