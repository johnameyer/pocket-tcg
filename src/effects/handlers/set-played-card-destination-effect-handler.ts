import { Controllers } from '../../controllers/controllers.js';
import { SetPlayedCardDestinationEffect } from '../../repository/effect-types.js';
import { EffectContext } from '../effect-context.js';
import { AbstractEffectHandler, ResolutionRequirement } from '../effect-handler.js';

/**
 * Handler for effects that override where the currently played trainer card ends up.
 */
export class SetPlayedCardDestinationEffectHandler extends AbstractEffectHandler<SetPlayedCardDestinationEffect> {
    getResolutionRequirements(effect: SetPlayedCardDestinationEffect): ResolutionRequirement[] {
        return [];
    }

    apply(controllers: Controllers, effect: SetPlayedCardDestinationEffect, context: EffectContext): void {
        if (context.type !== 'trainer' || (context.cardType !== 'item' && context.cardType !== 'supporter')) {
            return;
        }

        context.playedCardFinalDestination = effect.destination;
    }
}

export const setPlayedCardDestinationEffectHandler = new SetPlayedCardDestinationEffectHandler();
