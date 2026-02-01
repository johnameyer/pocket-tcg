import { Controllers } from '../../controllers/controllers.js';
import { CoinFlipManipulationEffect } from '../../repository/effect-types.js';
import { EffectContext } from '../effect-context.js';
import { AbstractEffectHandler, ResolutionRequirement } from '../effect-handler.js';

/**
 * Handler for coin flip manipulation effects that guarantee the next coin flip result.
 * TODO: Why do all effects need to extend from an abstract class? Why can they not just implement an interface?
 * // TODO: Why do all effects need to extend from an abstract class? Why can they not just implement an interface?
 * This architectural decision should be reviewed for better flexibility and testability.
 */
export class CoinFlipManipulationEffectHandler extends AbstractEffectHandler<CoinFlipManipulationEffect> {
    /**
     * Coin flip manipulation effects don't have targets to resolve.
     * 
     * @param effect The coin flip manipulation effect
     * @returns Empty array as coin flip manipulation effects don't have targets
     */
    getResolutionRequirements(effect: CoinFlipManipulationEffect): ResolutionRequirement[] {
        return [];
    }
    
    /**
     * Apply a coin flip manipulation effect.
     * This guarantees the next coin flip result.
     * 
     * @param controllers Game controllers
     * @param effect The coin flip manipulation effect to apply
     * @param context Effect context
     */
    apply(controllers: Controllers, effect: CoinFlipManipulationEffect, context: EffectContext): void {
        // Set the next coin flip result
        if(effect.guaranteeNextHeads) {
            controllers.coinFlip.setNextFlipGuaranteedHeads();
        }
        
        // Send a message about the coin flip manipulation
        controllers.players.messageAll({
            type: 'status',
            components: [ `${context.effectName} guarantees the next coin flip will be ${effect.guaranteeNextHeads ? 'heads' : 'tails'}!` ],
        });
    }
}

export const coinFlipManipulationEffectHandler = new CoinFlipManipulationEffectHandler();
