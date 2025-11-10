import { Controllers } from '../../controllers/controllers.js';
import { EvolutionFlexibilityEffect } from '../../repository/effect-types.js';
import { EffectContext } from '../effect-context.js';
import { AbstractEffectHandler, ResolutionRequirement } from '../interfaces/effect-handler-interface.js';
import { HandlerData } from '../../game-handler.js';

/**
 * Handler for evolution flexibility effects that allow more flexible evolution options.
 */
export class EvolutionFlexibilityEffectHandler extends AbstractEffectHandler<EvolutionFlexibilityEffect> {
    /**
     * Get the resolution requirements for an evolution flexibility effect.
     * Evolution flexibility effects don't require any targets as they apply globally to the player.
     * 
     * @param effect The evolution flexibility effect to get resolution requirements for
     * @returns Empty array as evolution flexibility effects don't have targets
     */
    getResolutionRequirements(effect: EvolutionFlexibilityEffect): ResolutionRequirement[] {
        return []; // Evolution flexibility effects don't have targets, they apply globally to the player
    }
    
    /**
     * Optional validation method to check if an evolution flexibility effect can be applied.
     * 
     * @param handlerData Handler data view
     * @param effect The evolution flexibility effect to validate
     * @param context Effect context
     * @returns True if the effect can be applied, false otherwise
     */
    canApply(handlerData: HandlerData, effect: EvolutionFlexibilityEffect, context: EffectContext): boolean {
        // Evolution flexibility effects can always be applied
        return true;
    }
    
    /**
     * Apply a fully resolved evolution flexibility effect.
     * This allows more flexible evolution options for certain creature.
     * 
     * @param controllers Game controllers
     * @param effect The evolution flexibility effect to apply
     * @param context Effect context
     */
    apply(controllers: Controllers, effect: EvolutionFlexibilityEffect, context: EffectContext): void {
        // Register the evolution flexibility effect with the turn state controller
        controllers.turnState.registerEvolutionFlexibility(context.sourcePlayer, effect.baseForm);
        
        // Show a message about the evolution flexibility
        controllers.players.messageAll({
            type: 'status',
            components: [`${context.effectName} allows more flexible evolution!`]
        });
    }
}

export const evolutionFlexibilityEffectHandler = new EvolutionFlexibilityEffectHandler();
