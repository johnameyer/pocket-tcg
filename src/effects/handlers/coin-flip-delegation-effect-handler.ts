import { Controllers } from '../../controllers/controllers.js';
import { CoinFlipDelegationEffect } from '../../repository/effect-types.js';
import { EffectContext } from '../effect-context.js';
import { AbstractEffectHandler, ResolutionRequirement } from '../interfaces/effect-handler-interface.js';

/**
 * Handler for coin flip delegation effects.
 * Flips one or more coins and enqueues the headsEffects if the minimum heads
 * threshold is met, otherwise enqueues the tailsEffects.
 */
export class CoinFlipDelegationEffectHandler extends AbstractEffectHandler<CoinFlipDelegationEffect> {
    getResolutionRequirements(_effect: CoinFlipDelegationEffect): ResolutionRequirement[] {
        return [];
    }

    apply(controllers: Controllers, effect: CoinFlipDelegationEffect, context: EffectContext): void {
        const { flipCount, minHeads, headsEffects, tailsEffects } = effect;

        let headsCount = 0;
        const results: boolean[] = [];
        for (let i = 0; i < flipCount; i++) {
            const isHeads = controllers.coinFlip.performCoinFlip();
            results.push(isHeads);
            if (isHeads) {
                headsCount++;
            }
        }

        const flipSummary = results.map(result => result ? 'heads' : 'tails').join(', ');
        const conditionMet = headsCount >= minHeads;

        if (flipCount === 1) {
            controllers.players.messageAll({
                type: 'status',
                components: [ `${context.effectName} flips a coin... ${flipSummary}!` ],
            });
        } else {
            controllers.players.messageAll({
                type: 'status',
                components: [ `${context.effectName} flips ${flipCount} coins... ${flipSummary} (${headsCount} heads)!` ],
            });
        }

        const effectsToApply = conditionMet ? headsEffects : tailsEffects;
        if (effectsToApply.length > 0) {
            controllers.effects.pushPendingEffect(effectsToApply, context);
        }
    }
}

export const coinFlipDelegationEffectHandler = new CoinFlipDelegationEffectHandler();
