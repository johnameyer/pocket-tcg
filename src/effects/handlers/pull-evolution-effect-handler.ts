import { Controllers } from '../../controllers/controllers.js';
import { PullEvolutionEffect } from '../../repository/effect-types.js';
import { EffectContext } from '../effect-context.js';
import { AbstractEffectHandler, ResolutionRequirement } from '../interfaces/effect-handler-interface.js';
import { getCreatureFromTarget } from '../effect-utils.js';
import { CardRepository } from '../../repository/card-repository.js';
import { HandlerData } from '../../game-handler.js';
import { FieldTargetResolver } from '../target-resolvers/field-target-resolver.js';
import { CardCriteriaFilter } from '../filters/card-criteria-filter.js';
import { CreatureCardCriteria } from '../../repository/criteria/card-criteria.js';
import { GameCard } from '../../controllers/card-types.js';

/**
 * Handler for pull evolution effects that pull an evolution from deck and immediately evolve the target.
 */
export class PullEvolutionEffectHandler extends AbstractEffectHandler<PullEvolutionEffect> {
    getResolutionRequirements(effect: PullEvolutionEffect): ResolutionRequirement[] {
        return [
            { targetProperty: 'target', target: effect.target, required: true },
        ];
    }

    canApply(handlerData: HandlerData, effect: PullEvolutionEffect, context: EffectContext, cardRepository: CardRepository): boolean {
        if (!effect.target) {
            return false;
        }
        // HandlerData only exposes deck sizes (not card contents), so we only check target availability here.
        // apply() handles the case where no matching evolution is found in the deck.
        return FieldTargetResolver.isTargetAvailable(effect.target, handlerData, context, cardRepository);
    }

    apply(controllers: Controllers, effect: PullEvolutionEffect, context: EffectContext): void {
        if (effect.target.type !== 'resolved') {
            throw new Error(`Expected resolved target, got ${effect.target?.type || effect.target}`);
        }

        const targets = effect.target.targets;

        if (targets.length === 0) {
            throw new Error(`${context.effectName} resolved to no valid targets`);
        }

        for (const targetInfo of targets) {
            const { playerId, fieldIndex } = targetInfo;

            const targetCreature = getCreatureFromTarget(controllers, playerId, fieldIndex);
            if (!targetCreature) {
                continue;
            }

            const targetData = controllers.cardRepository.getCreature(targetCreature.templateId);

            // Search the source player's deck for a matching evolution card
            const deck = controllers.deck.getDeck(context.sourcePlayer);
            const evolutionIndex = this.findEvolutionIndex(
                deck,
                targetData.name,
                targetCreature.templateId,
                effect.evolutionCriteria as CreatureCardCriteria | undefined,
                controllers.cardRepository.cardRepository,
            );

            if (evolutionIndex === -1) {
                controllers.players.messageAll({
                    type: 'status',
                    components: [ `${context.effectName} found no valid evolution in deck for ${targetData.name}!` ],
                });
                continue;
            }

            // Remove evolution card from deck and evolve target
            const [ evolutionCard ] = deck.splice(evolutionIndex, 1);
            const turnNumber = controllers.turnCounter.getTurnNumber();

            if (fieldIndex === 0) {
                controllers.field.evolveActiveCard(playerId, evolutionCard.templateId, evolutionCard.instanceId, turnNumber);
            } else {
                controllers.field.evolveBenchedCard(playerId, fieldIndex - 1, evolutionCard.templateId, evolutionCard.instanceId, turnNumber);
            }

            const evolutionData = controllers.cardRepository.getCreature(evolutionCard.templateId);
            controllers.players.messageAll({
                type: 'status',
                components: [ `${context.effectName} evolved ${targetData.name} into ${evolutionData.name}!` ],
            });
        }
    }

    private findEvolutionIndex(
        deck: GameCard[],
        targetName: string,
        targetTemplateId: string,
        evolutionCriteria: CreatureCardCriteria | undefined,
        cardRepository: CardRepository,
    ): number {
        return deck.findIndex((card: GameCard) => {
            if (card.type !== 'creature') {
                return false;
            }
            let cardData;
            try {
                cardData = cardRepository.getCreature(card.templateId);
            } catch {
                return false;
            }
            // Must be a direct evolution of the target (matching by name or templateId)
            if (cardData.previousStageName !== targetName
                && cardData.previousStageName !== targetTemplateId) {
                return false;
            }
            // Apply additional evolution criteria if specified (e.g. isType: 'water')
            if (evolutionCriteria) {
                if (!CardCriteriaFilter.evaluateCardCriteria(evolutionCriteria, card, cardRepository)) {
                    return false;
                }
            }
            return true;
        });
    }
}

export const pullEvolutionEffectHandler = new PullEvolutionEffectHandler();
