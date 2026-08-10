import { Controllers } from '../../controllers/controllers.js';
import { CardRepository } from '../../repository/card-repository.js';
import { EvolutionSkipEffect } from '../../repository/effect-types.js';
import { CreatureData } from '../../repository/card-types.js';
import { ResolvedFieldTarget } from '../../repository/targets/field-target.js';
import { EffectContext } from '../effect-context.js';
import { AbstractEffectHandler, ResolutionRequirement } from '../interfaces/effect-handler-interface.js';
import { HandlerData } from '../../game-handler.js';
import { GameCard } from '../../controllers/card-types.js';
import { FieldCard } from '../../controllers/field-controller.js';
import { getCurrentTemplateId, toFieldCard } from '../../utils/field-card-utils.js';

/**
 * Handler for the "Rare Candy"-style evolution-skip effect: evolve a Basic creature
 * directly to a matching Stage 2 card from hand, skipping Stage 1. Always self-only.
 *
 * Resolution is fully declarative via getResolutionRequirements(): `fieldBase` (the Basic
 * creature) resolves first with a self-contained filter that scans the acting player's hand
 * for a matching Stage 2 card; `handEvolution` (the Stage 2 card) then resolves with
 * `dependsOn: ['fieldBase']`, narrowing hand candidates to ones that actually evolve from
 * whichever creature was chosen. The framework (effect-applier.ts) builds any
 * PendingFieldSelection/PendingCardSelection needed - apply() only ever sees fully resolved
 * targets.
 */
export class EvolutionSkipEffectHandler extends AbstractEffectHandler<EvolutionSkipEffect> {
    canApply(handlerData: HandlerData, effect: EvolutionSkipEffect, context: EffectContext, cardRepository: CardRepository): boolean {
        const creatures = handlerData.field.creatures[context.sourcePlayer] ?? [];
        const hand = handlerData.hand.hand;
        const currentTurn = handlerData.turnCounter.turnNumber;

        return creatures.some(creature => {
            if (!creature) {
                return false;
            }
            const basicData = this.isEligibleBase(toFieldCard(creature), currentTurn, cardRepository);
            return basicData !== undefined && this.findMatchingStage2Card(basicData, hand, cardRepository) !== undefined;
        });
    }

    getResolutionRequirements(effect: EvolutionSkipEffect): ResolutionRequirement[] {
        return [
            {
                targetProperty: 'fieldBase',
                target: effect.fieldBase,
                required: true,
                // Self-contained: scans the owning player's hand directly, no dependsOn needed.
                filter: (candidate, _resolved, controllers) => {
                    const fieldCard = candidate as FieldCard;
                    const currentTurn = controllers.turnCounter.getTurnNumber();
                    const basicData = this.isEligibleBase(fieldCard, currentTurn, controllers.cardRepository.cardRepository);
                    if (!basicData) {
                        return false;
                    }
                    const ownerId = this.findFieldCardOwner(controllers, fieldCard.instanceId);
                    const hand = controllers.hand.getHand(ownerId);
                    return this.findMatchingStage2Card(basicData, hand, controllers.cardRepository.cardRepository) !== undefined;
                },
            },
            {
                targetProperty: 'handEvolution',
                target: effect.handEvolution,
                required: true,
                dependsOn: [ 'fieldBase' ],
                filter: (candidate, resolved, controllers) => {
                    const fieldBase = resolved.fieldBase as ResolvedFieldTarget | undefined;
                    if (!fieldBase || fieldBase.targets.length === 0) {
                        return false;
                    }
                    const { playerId, fieldIndex } = fieldBase.targets[0];
                    const raw = controllers.field.getRawCardByPosition(playerId, fieldIndex);
                    if (!raw) {
                        return false;
                    }
                    const basicData = controllers.cardRepository.getCreature(getCurrentTemplateId(raw));
                    return this.isMatchingStage2Card(candidate as GameCard, basicData, controllers.cardRepository.cardRepository);
                },
            },
        ];
    }

    apply(controllers: Controllers, effect: EvolutionSkipEffect, context: EffectContext): void {
        if (effect.fieldBase.type !== 'resolved') {
            throw new Error(`Expected resolved fieldBase, got ${effect.fieldBase?.type}`);
        }
        if (effect.handEvolution.type !== 'resolved') {
            throw new Error(`Expected resolved handEvolution, got ${effect.handEvolution?.type}`);
        }

        const fieldTargets = effect.fieldBase.targets;
        const handCards = effect.handEvolution.cards;

        if (fieldTargets.length === 0 || handCards.length === 0) {
            return;
        }

        const { playerId, fieldIndex } = fieldTargets[0];
        const raw = controllers.field.getRawCardByPosition(playerId, fieldIndex);
        const stage2Card = controllers.hand.getHand(playerId).find(card => card.instanceId === handCards[0].instanceId);

        if (!raw || !stage2Card) {
            return;
        }

        const currentData = controllers.cardRepository.getCreature(getCurrentTemplateId(raw));

        if (fieldIndex === 0) {
            controllers.field.evolveActiveCard(playerId, stage2Card.templateId);
        } else {
            controllers.field.evolveBenchedCard(playerId, fieldIndex - 1, stage2Card.templateId);
        }

        controllers.hand.removeCards(playerId, [ stage2Card ]);

        controllers.players.messageAll({
            type: 'status',
            components: [ `${context.effectName} evolved ${currentData.name} directly to ${controllers.cardRepository.getCreature(stage2Card.templateId).name}!` ],
        });
    }

    /** Returns the field card's creature data if it's a Basic eligible to evolve this turn, otherwise undefined. */
    private isEligibleBase(fieldCard: FieldCard, currentTurn: number, cardRepository: CardRepository): CreatureData | undefined {
        if (fieldCard.turnPlayed === currentTurn) {
            return undefined; // Can't evolve a creature played this turn
        }
        const cardData = cardRepository.getCreature(getCurrentTemplateId(fieldCard));
        return cardData.previousStageName ? undefined : cardData;
    }

    /** Finds a Stage 2 card in hand that evolves (skipping Stage 1) from the given Basic creature. */
    private findMatchingStage2Card(basicData: CreatureData, hand: GameCard[], cardRepository: CardRepository): GameCard | undefined {
        return hand.find(card => this.isMatchingStage2Card(card, basicData, cardRepository));
    }

    private isMatchingStage2Card(card: GameCard, basicData: CreatureData, cardRepository: CardRepository): boolean {
        if (card.type !== 'creature') {
            return false;
        }
        const cardData = cardRepository.getCreature(card.templateId);
        if (!cardData.previousStageName) {
            return false;
        }
        try {
            const stage1Data = cardRepository.getCreatureByName(cardData.previousStageName);
            if (!stage1Data.previousStageName) {
                return false;
            }
            return stage1Data.previousStageName === basicData.name;
        } catch {
            return false;
        }
    }

    /** Finds which player owns the field card with the given instance ID. */
    private findFieldCardOwner(controllers: Controllers, instanceId: string): number {
        for (let playerId = 0; playerId < controllers.players.count; playerId++) {
            const cards = controllers.field.getCards(playerId) ?? [];
            if (cards.some(card => card && card.instanceId === instanceId)) {
                return playerId;
            }
        }
        throw new Error(`Could not find owning player for field card instance ${instanceId}`);
    }
}

export const evolutionSkipEffectHandler = new EvolutionSkipEffectHandler();
