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
     * This registers a passive effect that increases damage dealt by attacks.
     * 
     * @param controllers Game controllers
     * @param effect The damage boost effect to apply
     * @param context Effect context
     */
    apply(controllers: Controllers, effect: DamageBoostEffect, context: EffectContext): void {
        const amount = getEffectValue(effect.amount, controllers, context);
        const activecreature = controllers.field.getCardByPosition(context.sourcePlayer, 0);
        if (!activecreature) {
            throw new Error(`No active creature found for player ${context.sourcePlayer}`);
        }
        
        // Register as a passive effect
        controllers.effects.registerPassiveEffect(
            context.sourcePlayer,
            context.effectName,
            {
                type: 'damage-boost',
                amount: effect.amount,
                target: effect.target,
                condition: effect.condition,
                duration: effect.duration,
            },
            effect.duration,
            controllers.turnCounter.getTurnNumber(),
            effect.condition
        );
        
        const targetText = effect.target ? ' conditionally' : '';
        const conditionText = effect.condition ? ' when condition is met' : '';
        controllers.players.messageAll({
            type: 'status',
            components: [ `${context.effectName} adds ${amount} damage${targetText}${conditionText}!` ],
        });
    }
}

export const damageBoostEffectHandler = new DamageBoostEffectHandler();
