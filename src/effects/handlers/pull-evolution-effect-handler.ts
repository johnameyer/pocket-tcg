import { Controllers } from '../../controllers/controllers.js';
import { PullEvolutionEffect } from '../../repository/effect-types.js';
import { EffectContext } from '../effect-context.js';
import { AbstractEffectHandler, ResolutionRequirement } from '../interfaces/effect-handler-interface.js';
import { getCreatureFromTarget } from '../effect-utils.js';
import { CardRepository } from '../../repository/card-repository.js';
import { HandlerData } from '../../game-handler.js';
import { FieldTargetResolver } from '../target-resolvers/field-target-resolver.js';
import { GameCard } from '../../controllers/card-types.js';
import { CardCriteriaFilter } from '../filters/card-criteria-filter.js';
import { satisfiesEvolutionRestrictions } from '../restrictions/evolution-restrictions.js';

/**
 * Handler for pull evolution effects that pull an evolution from deck and immediately evolve the target.
 */
export class PullEvolutionEffectHandler extends AbstractEffectHandler<PullEvolutionEffect> {
    /**
     * Get the resolution requirements for a pull evolution effect.
     * 
     * @param effect The pull evolution effect to get resolution requirements for
     * @returns Array of resolution requirements
     */
    getResolutionRequirements(effect: PullEvolutionEffect): ResolutionRequirement[] {
        return [
            { targetProperty: 'target', target: effect.target, required: true },
        ];
    }
    
    /**
     * Optional validation method to check if a pull evolution effect can be applied.
     * 
     * @param handlerData Handler data view
     * @param effect The pull evolution effect to validate
     * @param context Effect context
     * @returns True if the effect can be applied, false otherwise
     */
    canApply(handlerData: HandlerData, effect: PullEvolutionEffect, context: EffectContext, cardRepository: CardRepository): boolean {
        // If there's no target, we can't apply the effect
        if (!effect.target) {
            return false;
        }

        if (!effect.skipRestrictions && !satisfiesEvolutionRestrictions(effect.restrictions, {
            isBasicCreature: true,
            isFirstTurn: handlerData.energy.isAbsoluteFirstTurn || handlerData.turnCounter.turnNumber <= 1,
            playedThisTurn: false,
        })) {
            return false;
        }
        
        // Use TargetResolver to check if the target is available
        return FieldTargetResolver.isTargetAvailable(effect.target, handlerData, context, cardRepository);
    }

    /**
     * Apply a fully resolved pull evolution effect.
     * This is called after all targets have been resolved.
     * 
     * @param controllers Game controllers
     * @param effect The pull evolution effect to apply (with resolved targets)
     * @param context Effect context
     */
    apply(controllers: Controllers, effect: PullEvolutionEffect, context: EffectContext): void {
        if (effect.target.type !== 'resolved') {
            throw new Error(`Expected resolved target, got ${effect.target?.type || effect.target}`);
        }
        
        // Get resolved targets directly
        const targets = effect.target.targets;
        
        if (targets.length === 0) {
            throw new Error(`${context.effectName} resolved to no valid targets`);
        }
        
        // Process each target
        for (const targetInfo of targets) {
            const playerId = targetInfo.playerId;
            const fieldIndex = targetInfo.fieldIndex;
            
            // Get the target creature
            const targetCreature = getCreatureFromTarget(controllers, playerId, fieldIndex);
            if (!targetCreature) {
                continue;
            }

            const targetTemplateId = targetCreature.templateId;
            const targetData = controllers.cardRepository.getCreature(targetTemplateId);
            const currentTurn = controllers.turnCounter.getTurnNumber();
            const sourceDeck = controllers.deck.getDeck(context.sourcePlayer);
            const selectedEvolution = this.findMatchingEvolutionInDeck(
                sourceDeck,
                targetTemplateId,
                effect,
                controllers.cardRepository.cardRepository,
                (count) => controllers.random.pickIndex(count),
            );
            if (!selectedEvolution) {
                continue;
            }

            if (!effect.skipRestrictions && !satisfiesEvolutionRestrictions(effect.restrictions, {
                isBasicCreature: !targetData.previousStageName,
                isFirstTurn: controllers.energy.isFirstTurnRestricted() || currentTurn <= 1,
                playedThisTurn: targetCreature.turnPlayed === currentTurn,
            })) {
                continue;
            }

            // Remove the selected evolution card from deck before evolving.
            const selectedIndex = sourceDeck.findIndex((card) => card.instanceId === selectedEvolution.instanceId);
            if (selectedIndex === -1) {
                continue;
            }
            sourceDeck.splice(selectedIndex, 1);

            const evolved = fieldIndex === 0
                ? controllers.field.evolveActiveCard(playerId, selectedEvolution.templateId, selectedEvolution.instanceId, currentTurn)
                : controllers.field.evolveBenchedCard(playerId, fieldIndex - 1, selectedEvolution.templateId, selectedEvolution.instanceId, currentTurn);
            if (!evolved) {
                continue;
            }

            const baseData = controllers.cardRepository.getCreature(targetTemplateId);
            const evolutionData = controllers.cardRepository.getCreature(selectedEvolution.templateId);
            controllers.players.messageAll({
                type: 'status',
                components: [ `${context.effectName} evolved ${baseData.name} into ${evolutionData.name}!` ],
            });
        }
    }

    private findMatchingEvolutionInDeck(
        deck: GameCard[],
        targetTemplateId: string,
        effect: PullEvolutionEffect,
        cardRepository: CardRepository,
        pickRandomIndex: (count: number) => number,
    ): GameCard | undefined {
        const targetData = cardRepository.getCreature(targetTemplateId);
        const candidates = deck.filter((card): card is GameCard & { type: 'creature' } => {
            if (card.type !== 'creature') {
                return false;
            }

            const candidateData = cardRepository.getCreature(card.templateId);
            if (!candidateData.previousStageName || candidateData.previousStageName !== targetData.name) {
                return false;
            }

            if (!effect.evolutionCriteria) {
                return true;
            }
            return CardCriteriaFilter.filter([ card ], effect.evolutionCriteria, cardRepository).length > 0;
        });

        if (candidates.length === 0) {
            return undefined;
        }

        const selectedIndex = pickRandomIndex(candidates.length);
        return candidates[selectedIndex];
    }

}

export const pullEvolutionEffectHandler = new PullEvolutionEffectHandler();
