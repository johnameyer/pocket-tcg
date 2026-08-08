import { Controllers } from '../../controllers/controllers.js';
import { RemoveFieldCardEffect } from '../../repository/effect-types.js';
import { EffectContext } from '../effect-context.js';
import { AbstractEffectHandler, ResolutionRequirement } from '../interfaces/effect-handler-interface.js';
import { CardRepository } from '../../repository/card-repository.js';
import { HandlerData } from '../../game-handler.js';
import { FieldTargetResolver } from '../target-resolvers/field-target-resolver.js';

/**
 * Handler for remove field card effects that remove field cards to deck, hand, or discard.
 * Always includes all attached tools and evolution stack.
 *
 * When destination is 'hand':
 *   - Each card in the evolution stack is returned as a creature GameCard to the owner's hand.
 *   - Attached energy is discarded.
 *   - Attached tools are discarded.
 *   - Passive effects tied to this field slot are cleared.
 *
 * When destination is 'deck':
 *   - Same as 'hand' but cards are shuffled into the deck instead.
 *
 * When destination is 'discard':
 *   - Same behaviour as a knockout discard (mirrors removeActiveCard / removeBenchCard).
 */
export class RemoveFieldCardEffectHandler extends AbstractEffectHandler<RemoveFieldCardEffect> {
    /**
     * Get the resolution requirements for a remove field card effect.
     *
     * @param effect The remove field card effect to get resolution requirements for
     * @returns Array of resolution requirements
     */
    getResolutionRequirements(effect: RemoveFieldCardEffect): ResolutionRequirement[] {
        return [
            { targetProperty: 'target', target: effect.target, required: true },
        ];
    }

    /**
     * Optional validation method to check if a remove field card effect can be applied.
     *
     * @param handlerData Handler data view
     * @param effect The remove field card effect to validate
     * @param context Effect context
     * @returns True if the effect can be applied, false otherwise
     */
    canApply(handlerData: HandlerData, effect: RemoveFieldCardEffect, context: EffectContext, cardRepository: CardRepository): boolean {
        // If there's no target, we can't apply the effect
        if (!effect.target) {
            return false;
        }

        // Use TargetResolver to check if the target is available
        return FieldTargetResolver.isTargetAvailable(effect.target, handlerData, context, cardRepository);
    }

    /**
     * Apply a fully resolved remove field card effect.
     * This is called after all targets have been resolved.
     *
     * @param controllers Game controllers
     * @param effect The remove field card effect to apply (with resolved targets)
     * @param context Effect context
     */
    apply(controllers: Controllers, effect: RemoveFieldCardEffect, context: EffectContext): void {
        if (effect.target.type !== 'resolved') {
            throw new Error(`Expected resolved target, got ${effect.target?.type || effect.target}`);
        }

        const targets = effect.target.targets;

        if (targets.length === 0) {
            throw new Error(`${context.effectName} resolved to no valid targets`);
        }

        for (const targetInfo of targets) {
            const { playerId, fieldIndex } = targetInfo;

            // Read the full InstancedFieldCard so we can access the evolution stack
            const instancedCard = controllers.field.getInstancedCardByPosition(playerId, fieldIndex);
            if (!instancedCard) {
                continue;
            }

            const fieldInstanceId = instancedCard.fieldInstanceId;

            // Clean up energy (always discarded regardless of destination)
            controllers.energy.removeAllEnergyFromInstance(playerId, fieldInstanceId);

            // Clean up passive effects from the card's ability
            controllers.effects.clearEffectsForInstance(fieldInstanceId);

            // Clean up attached tool
            const attachedTool = controllers.tools.getAttachedTool(fieldInstanceId);
            if (attachedTool) {
                controllers.effects.clearEffectsForTool(attachedTool.instanceId, fieldInstanceId);
                // Tools are always discarded when the creature leaves the field
                controllers.discard.discardCard(playerId, {
                    instanceId: attachedTool.instanceId,
                    templateId: attachedTool.templateId,
                    type: 'tool',
                });
                controllers.tools.detachTool(fieldInstanceId);
            }

            // Remove the field card without auto-discarding
            controllers.field.removeFieldCardWithoutDiscard(playerId, fieldIndex);

            // Convert each card in the evolution stack to a GameCard for the destination
            const gameCards = instancedCard.evolutionStack.map(stackCard => ({
                instanceId: stackCard.instanceId,
                templateId: stackCard.templateId,
                type: 'creature' as const,
            }));

            // Get the name of the top-most form for messaging
            const topCard = instancedCard.evolutionStack[instancedCard.evolutionStack.length - 1];
            const creatureData = controllers.cardRepository.getCreature(topCard.templateId);

            if (effect.destination === 'hand') {
                // Add all evolution stack cards to the owner's hand
                const hand = controllers.hand.getHand(playerId);
                for (const gameCard of gameCards) {
                    hand.push(gameCard);
                }
                controllers.players.messageAll({
                    type: 'status',
                    components: [ `${context.effectName} returned ${creatureData.name} to hand!` ],
                });
            } else if (effect.destination === 'deck') {
                // Shuffle each card into the owner's deck
                for (const gameCard of gameCards) {
                    controllers.deck.addCard(playerId, gameCard);
                }
                controllers.deck.shuffle(playerId);
                controllers.players.messageAll({
                    type: 'status',
                    components: [ `${context.effectName} shuffled ${creatureData.name} into the deck!` ],
                });
            } else {
                // destination === 'discard'
                controllers.discard.discardFieldCard(playerId, instancedCard);
                controllers.players.messageAll({
                    type: 'status',
                    components: [ `${context.effectName} discarded ${creatureData.name}!` ],
                });
            }
        }
    }
}

export const removeFieldCardEffectHandler = new RemoveFieldCardEffectHandler();
