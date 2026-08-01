import { Controllers } from '../../controllers/controllers.js';
import { PullToBenchEffect } from '../../repository/effect-types.js';
import { EffectContext } from '../effect-context.js';
import { AbstractEffectHandler, ResolutionRequirement } from '../interfaces/effect-handler-interface.js';
import { CardCriteriaFilter } from '../filters/card-criteria-filter.js';
import { HandlerData } from '../../game-handler.js';
import { CardRepository } from '../../repository/card-repository.js';

export class PullToBenchEffectHandler extends AbstractEffectHandler<PullToBenchEffect> {
    getResolutionRequirements(_effect: PullToBenchEffect): ResolutionRequirement[] {
        return [];
    }

    canApply(handlerData: HandlerData, _effect: PullToBenchEffect, _context: EffectContext, _cardRepository: CardRepository): boolean {
        const { field } = handlerData;
        return field.creatures[0]?.length < 4;
    }

    apply(controllers: Controllers, effect: PullToBenchEffect, context: EffectContext): void {
        const playerId = context.sourcePlayer;
        const deck = controllers.deck.getDeck(playerId);
        const cardRepository = controllers.cardRepository.cardRepository;

        const criteria = { cardType: 'creature' as const, ...effect.criteria };
        const matching = CardCriteriaFilter.filter(deck, criteria, cardRepository);

        if (matching.length === 0) {
            return;
        }

        const shuffled = [...matching].sort(() => Math.random() - 0.5);
        const toPlace = shuffled.slice(0, effect.count);

        for (const card of toPlace) {
            const deckIndex = deck.indexOf(card);
            if (deckIndex === -1) continue;

            const placed = controllers.field.addToBench(playerId, card.templateId);
            if (placed) {
                deck.splice(deckIndex, 1);
            }
        }
    }
}

export const pullToBenchEffectHandler = new PullToBenchEffectHandler();
