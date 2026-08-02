import { Controllers } from '../../controllers/controllers.js';
import { RemoveFieldCardEffect } from '../../repository/effect-types.js';
import { EffectContext } from '../effect-context.js';
import { AbstractEffectHandler, ResolutionRequirement } from '../interfaces/effect-handler-interface.js';
import { getFieldInstanceId } from '../../utils/field-card-utils.js';
import { CardRepository } from '../../repository/card-repository.js';
import { HandlerData } from '../../game-handler.js';
import { FieldTargetResolver } from '../target-resolvers/field-target-resolver.js';

/**
 * Handler for remove field card effects that remove field cards to deck, hand, or discard.
 * Always includes all attached tools and evolution stack.
 *
 * All three destinations are supported:
 *   - `discard`: discards all evolution stack cards, energy, and tools.
 *   - `hand`: returns all evolution stack cards to the owner's hand; energy and tools are discarded.
 *   - `deck`: shuffles all evolution stack cards into the owner's deck; energy and tools are discarded.
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
     * For all destinations, energy is removed and any attached tool is discarded and detached.
     * The evolution stack is then sent to the specified destination:
     *   - `discard`: all stack cards go to the discard pile.
     *   - `hand`: all stack cards are added to the owner's hand.
     *   - `deck`: all stack cards are shuffled into the owner's deck.
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

            // Get the InstancedFieldCard directly (needed for evolution stack / tool cleanup)
            const instancedCard = controllers.field.getInstancedCardByPosition(playerId, fieldIndex);
            if (!instancedCard) {
                continue;
            }

            const fieldInstanceId = getFieldInstanceId(instancedCard);

            // 1. Remove all energy from the instance (always discarded regardless of destination)
            controllers.energy.removeAllEnergyFromInstance(playerId, fieldInstanceId);

            // 2. Clear passive effects tied to this instance
            controllers.effects.clearEffectsForInstance(fieldInstanceId);

            // 3. Handle attached tool: clear its effects, discard it, then detach
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

            // 4. Remove from field without auto-discarding (we handle the destination ourselves)
            controllers.field.removeFieldCardWithoutDiscard(playerId, fieldIndex);

            // 5. Convert each card in the evolution stack to a GameCard for the destination
            const gameCards = instancedCard.evolutionStack.map(stackCard => ({
                instanceId: stackCard.instanceId,
                templateId: stackCard.templateId,
                type: 'creature' as const,
            }));

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
                    components: [ `${context.effectName} discards ${creatureData.name} with all tools and evolutions!` ],
                });
            }
        }
    }
}

export const removeFieldCardEffectHandler = new RemoveFieldCardEffectHandler();
