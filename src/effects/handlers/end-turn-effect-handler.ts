import { Controllers } from '../../controllers/controllers.js';
import { EndTurnEffect } from '../../repository/effect-types.js';
import { EffectContext } from '../effect-context.js';
import { AbstractEffectHandler, ResolutionRequirement } from '../effect-handler.js';

/**
 * Handler for end turn effects that immediately end the current player's turn.
 */
export class EndTurnEffectHandler extends AbstractEffectHandler<EndTurnEffect> {
    /**
     * End turn effects don't have targets to resolve.
     * 
     * @param effect The end turn effect
     * @returns Empty array as end turn effects don't have targets
     */
    getResolutionRequirements(effect: EndTurnEffect): ResolutionRequirement[] {
        return [];
    }
    
    /**
     * Apply an end turn effect.
     * This immediately ends the current player's turn.
     * 
     * @param controllers Game controllers
     * @param effect The end turn effect to apply
     * @param context Effect context
     */
    apply(controllers: Controllers, effect: EndTurnEffect, context: EffectContext): void {
        // Signal that the turn should end
        controllers.turnState.setShouldEndTurn(true);

        // Send a message about the turn ending
        controllers.players.messageAll({
            type: 'status',
            components: [`${context.effectName} ends the turn!`]
        });
    }
}

export const endTurnEffectHandler = new EndTurnEffectHandler();
