import { Controllers } from '../../controllers/controllers.js';
import { ChoiceDelegationEffect } from '../../repository/effect-types.js';
import { EffectContext } from '../effect-context.js';
import { AbstractEffectHandler, ResolutionRequirement } from '../interfaces/effect-handler-interface.js';
import { HandlerData } from '../../game-handler.js';
import { CardRepository } from '../../repository/card-repository.js';
import { EffectApplier } from '../effect-applier.js';
import { EffectQueueProcessor } from '../effect-queue-processor.js';

/**
 * Handler for choice delegation effects.
 * Declares a `ChoiceTarget` requirement (`choice`) built from `options`; the generic
 * ResolutionRequirement pipeline in effect-applier.ts resolves it - auto-resolving if
 * there's only one option, otherwise pausing on a `PendingChoiceSelection` until the player
 * responds. apply() only ever sees the fully-resolved choice and enqueues the matching
 * option's effects.
 *
 * Note: This effect should be the last (or only) effect in an effects array
 * because it interrupts further effect processing until the player responds.
 */
export class ChoiceDelegationEffectHandler extends AbstractEffectHandler<ChoiceDelegationEffect> {
    getResolutionRequirements(effect: ChoiceDelegationEffect): ResolutionRequirement[] {
        return [
            {
                targetProperty: 'choice',
                target: {
                    type: 'single-choice',
                    chooser: 'self',
                    choices: effect.options.map(option => ({ name: option.name, value: option.name })),
                },
                required: true,
            },
        ];
    }

    canApply(handlerData: HandlerData, effect: ChoiceDelegationEffect, context: EffectContext, cardRepository: CardRepository): boolean {
        return effect.options.some(option => option.effects.length > 0 && option.effects.some(e => EffectApplier.canApplyEffect(e, handlerData, context, cardRepository)));
    }

    apply(controllers: Controllers, effect: ChoiceDelegationEffect, context: EffectContext): void {
        const { choice } = effect;
        if (choice.type !== 'resolved') {
            throw new Error(`Expected resolved choice, got ${choice?.type}`);
        }

        const selectedOption = effect.options.find(option => option.name === choice.value);
        if (!selectedOption) {
            console.warn(`Choice delegation: no option found matching selected value '${choice.value}'`);
            return;
        }

        controllers.players.messageAll({
            type: 'status',
            components: [ `${context.effectName} chose ${selectedOption.name}!` ],
        });

        if (selectedOption.effects.length > 0) {
            controllers.effects.pushPendingEffect(selectedOption.effects, context);
            EffectQueueProcessor.processQueue(controllers);
        }
    }
}

export const choiceDelegationEffectHandler = new ChoiceDelegationEffectHandler();
