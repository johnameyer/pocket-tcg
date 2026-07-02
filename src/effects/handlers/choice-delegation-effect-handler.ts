import { Controllers } from '../../controllers/controllers.js';
import { ChoiceDelegationEffect } from '../../repository/effect-types.js';
import { EffectContext } from '../effect-context.js';
import { AbstractEffectHandler, ResolutionRequirement } from '../interfaces/effect-handler-interface.js';
import { HandlerData } from '../../game-handler.js';
import { CardRepository } from '../../repository/card-repository.js';
import { EffectApplier } from '../effect-applier.js';

/**
 * Handler for choice delegation effects.
 * Presents the player with a list of named options and sets up a pending
 * choice selection. Once the player responds, the selected option's effects
 * are enqueued by the event handler.
 *
 * Note: This effect should be the last (or only) effect in an effects array
 * because it interrupts further effect processing until the player responds.
 */
export class ChoiceDelegationEffectHandler extends AbstractEffectHandler<ChoiceDelegationEffect> {
    getResolutionRequirements(_effect: ChoiceDelegationEffect): ResolutionRequirement[] {
        return [];
    }

    canApply(handlerData: HandlerData, effect: ChoiceDelegationEffect, context: EffectContext, cardRepository: CardRepository): boolean {
        return effect.options.some(option => option.effects.length > 0 && option.effects.some(e => EffectApplier.canApplyEffect(e, handlerData, context, cardRepository)));
    }

    apply(controllers: Controllers, effect: ChoiceDelegationEffect, context: EffectContext): void {
        controllers.turnState.setPendingSelection({
            selectionType: 'choice',
            effect,
            originalContext: context,
            continuationEffects: context.selectionContinuationEffects,
            choices: effect.options.map(option => ({ name: option.name, value: option.name })),
            count: 1,
        });

        controllers.players.messageAll({
            type: 'status',
            components: [ `${context.effectName} asks you to choose an effect!` ],
        });
    }
}

export const choiceDelegationEffectHandler = new ChoiceDelegationEffectHandler();
