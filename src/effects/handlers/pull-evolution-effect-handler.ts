import { Controllers } from '../../controllers/controllers.js';
import { PullEvolutionEffect } from '../../repository/effect-types.js';
import { EffectContext } from '../effect-context.js';
import { AbstractEffectHandler, ResolutionRequirement } from '../interfaces/effect-handler-interface.js';
import { getCreatureFromTarget } from '../effect-utils.js';
import { CardRepository } from '../../repository/card-repository.js';
import { HandlerData } from '../../game-handler.js';
import { FieldTargetResolver } from '../target-resolvers/field-target-resolver.js';

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

            const creatureData = controllers.cardRepository.getCreature(targetCreature.templateId);

            // Find eligible evolution cards in the deck
            const deck = controllers.deck.getDeck(playerId);
            const validEvolutionTemplateIds = controllers.cardRepository.cardRepository.getEvolutionsOf(creatureData.name);

            const eligibleIndices: number[] = [];
            for (let i = 0; i < deck.length; i++) {
                const card = deck[i];
                if (card.type !== 'creature') continue;
                if (!validEvolutionTemplateIds.includes(card.templateId)) continue;
                if (effect.evolutionCriteria && 'isType' in effect.evolutionCriteria) {
                    const evoData = controllers.cardRepository.getCreature(card.templateId);
                    if (effect.evolutionCriteria.isType && evoData.type !== effect.evolutionCriteria.isType) continue;
                }
                eligibleIndices.push(i);
            }

            if (eligibleIndices.length === 0) {
                controllers.players.messageAll({
                    type: 'status',
                    components: [ `${context.effectName}: No valid evolution for ${creatureData.name} found in deck!` ],
                });
                continue;
            }

            // Pick a random eligible card
            const chosenIndex = eligibleIndices[Math.floor(Math.random() * eligibleIndices.length)];
            const chosenCard = deck[chosenIndex];

            // Remove it from the deck
            deck.splice(chosenIndex, 1);

            // Evolve the target creature
            const turnNumber = controllers.turnCounter.getTurnNumber();
            if (fieldIndex === 0) {
                controllers.field.evolveActiveCard(playerId, chosenCard.templateId, chosenCard.instanceId, turnNumber);
            } else {
                controllers.field.evolveBenchedCard(playerId, fieldIndex - 1, chosenCard.templateId, chosenCard.instanceId, turnNumber);
            }

            controllers.players.messageAll({
                type: 'status',
                components: [ `${context.effectName} evolved ${creatureData.name} into ${chosenCard.templateId}!` ],
            });
        }
    }
}

export const pullEvolutionEffectHandler = new PullEvolutionEffectHandler();
