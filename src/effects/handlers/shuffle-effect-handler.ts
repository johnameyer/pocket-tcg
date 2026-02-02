import { Controllers } from '../../controllers/controllers.js';
import { ShuffleEffect } from '../../repository/effect-types.js';
import { PlayerTarget } from '../../repository/targets/player-target.js';
import { EffectContext } from '../effect-context.js';
import { AbstractEffectHandler, ResolutionRequirement } from '../interfaces/effect-handler-interface.js';
import { getEffectValue } from '../effect-utils.js';
import { HandlerData } from '../../game-handler.js';

/**
 * Handler for shuffle effects that shuffle a player's deck.
 * This handler supports shuffling the deck directly or shuffling the hand into the deck.
 */
export class ShuffleEffectHandler extends AbstractEffectHandler<ShuffleEffect> {
    /**
     * Optional validation method to check if a shuffle effect can be applied.
     * 
     * @param handlerData Handler data view
     * @param effect The shuffle effect to validate
     * @param context Effect context
     * @returns True if the effect can be applied, false otherwise
     */
    canApply(handlerData: HandlerData, effect: ShuffleEffect, context: EffectContext): boolean {
        // Shuffle effects can always be applied
        return true;
    }

    /**
     * Shuffle effects don't have targets to resolve.
     * 
     * @param effect The shuffle effect
     * @returns Empty array as shuffle effects don't have targets
     */
    getResolutionRequirements(effect: ShuffleEffect): ResolutionRequirement[] {
        return [];
    }
    
    /**
     * Apply a shuffle effect.
     * This shuffles the specified player's deck and optionally draws cards afterward.
     * 
     * @param controllers Game controllers
     * @param effect The shuffle effect to apply
     * @param context Effect context
     */
    apply(controllers: Controllers, effect: ShuffleEffect, context: EffectContext): void {
        // Handle 'both' target specially
        if (effect.target === 'both') {
            // Apply the effect to both players
            for (let playerId = 0; playerId < controllers.players.count; playerId++) {
                if (effect.shuffleHand) {
                    this.handleHandToDeckShuffle(controllers, effect, context, playerId);
                } else {
                    this.handleDeckShuffle(controllers, effect, context, playerId);
                }
            }
            return;
        }
        
        // Determine which player's deck to shuffle
        const playerId = effect.target === 'self' ? context.sourcePlayer : 1 - context.sourcePlayer;
        
        // Check if this effect should shuffle the hand into the deck
        if (effect.shuffleHand) {
            this.handleHandToDeckShuffle(controllers, effect, context, playerId);
        } else {
            // Standard deck shuffle
            this.handleDeckShuffle(controllers, effect, context, playerId);
        }
    }
    
    /**
     * Handle shuffling the hand into the deck.
     * 
     * @param controllers Game controllers
     * @param effect The shuffle effect
     * @param context Effect context
     * @param playerId The player ID
     */
    private handleHandToDeckShuffle(
        controllers: Controllers,
        effect: ShuffleEffect,
        context: EffectContext,
        playerId: number,
    ): void {
        // Calculate draw amount BEFORE shuffling if specified
        let drawAmount = 0;
        if (effect.drawAfter) {
            drawAmount = getEffectValue(effect.drawAfter, controllers, context);
        }
        
        // Shuffle the hand into the deck
        const hand = [ ...controllers.hand.getHand(playerId) ];
        controllers.hand.removeCards(playerId, hand);
        
        for (const card of hand) {
            controllers.deck.addCard(playerId, card);
        }
        
        // Shuffle the deck
        controllers.deck.shuffle(playerId);
        
        // Send a message about the shuffle
        controllers.players.messageAll({
            type: 'status',
            components: [ `${context.effectName} shuffles the ${effect.target === 'self' ? 'hand' : 'opponent\'s hand'} into the deck!` ],
        });
        
        // Draw cards if specified
        if (effect.drawAfter && drawAmount > 0) {
            this.drawCards(controllers, playerId, drawAmount, context, effect.target as PlayerTarget);
        }
    }
    
    /**
     * Handle shuffling the deck.
     * 
     * @param controllers Game controllers
     * @param effect The shuffle effect
     * @param context Effect context
     * @param playerId The player ID
     */
    private handleDeckShuffle(
        controllers: Controllers,
        effect: ShuffleEffect,
        context: EffectContext,
        playerId: number,
    ): void {
        // Shuffle the deck
        controllers.deck.shuffle(playerId);
        
        // Send a message about the shuffle
        controllers.players.messageAll({
            type: 'status',
            components: [ `${context.effectName} shuffles the deck!` ],
        });
        
        // Draw cards if specified
        if (effect.drawAfter) {
            const drawAmount = getEffectValue(effect.drawAfter, controllers, context);
            this.drawCards(controllers, playerId, drawAmount, context, effect.target as PlayerTarget);
        }
    }
    
    /**
     * Draw cards after shuffling.
     * 
     * @param controllers Game controllers
     * @param playerId The player ID
     * @param drawAmount The number of cards to draw
     * @param context Effect context
     * @param target The target player ('self', 'opponent', or 'both')
     */
    private drawCards(
        controllers: Controllers,
        playerId: number,
        drawAmount: number,
        context: EffectContext,
        target?: PlayerTarget,
    ): void {
        if (drawAmount <= 0) {
            return;
        }
        
        // Get the current deck size
        const deckSize = controllers.deck.getDeckSize(playerId);
        
        // If the deck is empty, show a message and return
        if (deckSize === 0) {
            controllers.players.messageAll({
                type: 'status',
                components: [ `${context.effectName} couldn't draw any cards because the deck is empty!` ],
            });
            return;
        }
        
        // Calculate the actual number of cards to draw (limited by deck size)
        const actualDrawAmount = Math.min(drawAmount, deckSize);
        
        // Draw cards one by one
        for (let i = 0; i < actualDrawAmount; i++) {
            controllers.hand.drawCard(playerId);
        }
        
        // Send a message about the draw
        controllers.players.messageAll({
            type: 'status',
            components: [
                `${context.effectName} ${target === 'self' ? 'draws' : 'makes the opponent draw'} ${actualDrawAmount} card${actualDrawAmount !== 1 ? 's' : ''}!`,
            ],
        });
        
        // If we couldn't draw all the requested cards, show a message
        if (actualDrawAmount < drawAmount) {
            controllers.players.messageAll({
                type: 'status',
                components: [ `${context.effectName} couldn't draw all ${drawAmount} cards because the deck only had ${deckSize} cards!` ],
            });
        }
    }
}

export const shuffleEffectHandler = new ShuffleEffectHandler();
