import { Controllers } from '../../controllers/controllers.js';
import { PeekAndPullEffect } from '../../repository/effect-types.js';
import { EffectContext } from '../effect-context.js';
import { AbstractEffectHandler, ResolutionRequirement } from '../interfaces/effect-handler-interface.js';
import { CardCriteriaFilter } from '../filters/card-criteria-filter.js';
import { HandlerData } from '../../game-handler.js';

export class PeekAndPullEffectHandler extends AbstractEffectHandler<PeekAndPullEffect> {
    getResolutionRequirements(_effect: PeekAndPullEffect): ResolutionRequirement[] {
        return [];
    }

    canApply(handlerData: HandlerData, _effect: PeekAndPullEffect, context: EffectContext): boolean {
        return handlerData.deck.sizes[context.sourcePlayer] > 0;
    }

    apply(controllers: Controllers, effect: PeekAndPullEffect, context: EffectContext): void {
        const playerId = context.sourcePlayer;
        const deck = controllers.deck.getDeck(playerId);
        const topCards = deck.slice(-effect.n);

        const cardRepository = controllers.cardRepository.cardRepository;
        const matching = CardCriteriaFilter.filter(topCards, effect.criteria, cardRepository);

        if (matching.length === 0) {
            controllers.players.messageAll({
                type: 'status',
                components: [ `${context.effectName} found no matching cards in the top ${effect.n}!` ],
            });
        } else {
            for (const card of matching) {
                const idx = deck.findIndex(c => c.instanceId === card.instanceId);
                if (idx >= 0) {
                    deck.splice(idx, 1);
                    controllers.hand.getHand(playerId).push(card);
                }
            }
            controllers.players.messageAll({
                type: 'status',
                components: [ `${context.effectName} put ${matching.length} card${matching.length !== 1 ? 's' : ''} into hand!` ],
            });
        }

        controllers.deck.shuffle(playerId);
        controllers.players.messageAll({
            type: 'status',
            components: [ `${context.effectName} shuffles the deck!` ],
        });
    }
}

export const peekAndPullEffectHandler = new PeekAndPullEffectHandler();
