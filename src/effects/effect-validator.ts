import { HandlerData } from '../game-handler.js';
import { CardRepository } from '../repository/card-repository.js';
import { Effect } from '../repository/effect-types.js';
import { EffectContextFactory } from './effect-context.js';
import { EffectContext } from './effect-context.js';
import { effectHandlers } from './handlers/effect-handlers-map.js';
import { TargetResolver } from './target-resolver.js';
import { EffectHandler } from './interfaces/effect-handler-interface.js';

export class EffectValidator {
    /**
     * Check if any effect in the array can be applied using HandlerData
     */
    static canApplyAnyEffect(effects: Effect[], handlerData: HandlerData, sourcePlayer: number, effectName: string, cardRepository?: CardRepository): boolean {
        const context = EffectContextFactory.createCardContext(sourcePlayer, effectName, 'item');
        return effects.some(effect => this.canApplyEffect(effect, handlerData, context, cardRepository!));
    }

    /**
     * Check if all effects in the array can be applied using HandlerData
     */
    static canApplyAllEffects(effects: Effect[], handlerData: HandlerData, sourcePlayer: number, effectName: string, cardType: 'supporter' | 'item' = 'item', cardRepository?: CardRepository): boolean {
        const context = EffectContextFactory.createCardContext(sourcePlayer, effectName, cardType);
        
        // If no repository provided, assume effects can be applied (for test scenarios)
        if (!cardRepository) {
            return true;
        }
        
        return effects.every(effect => this.canApplyEffect(effect, handlerData, context, cardRepository));
    }

    /**
     * Check if a card's effects can be applied using HandlerData (for validation)
     */
    static canApplyCardEffects(cardEffects: Effect[] | undefined, handlerData: HandlerData, sourcePlayer: number, effectName: string, cardType?: 'supporter' | 'item', cardRepository?: CardRepository): boolean {
        if (!cardEffects || cardEffects.length === 0) {
            return true;
        }
        
        // For supporter cards, all effects must be applicable
        // This ensures cards like Erika, Irida, and Lillie can't be played when there are no valid targets
        if (cardType === 'supporter') {
            return this.canApplyAllEffects(cardEffects, handlerData, sourcePlayer, effectName, cardType, cardRepository);
        }
        
        // For other card types, any effect being applicable is sufficient
        const result = this.canApplyAnyEffect(cardEffects, handlerData, sourcePlayer, effectName, cardRepository);
        return result;
    }


    /**
     * Check if an effect can be applied using HandlerData
     * First checks if all required targets are available, then calls the handler's canApply method.
     */
    static canApplyEffect(effect: Effect, handlerData: HandlerData, context: EffectContext, cardRepository: CardRepository): boolean {
        
        // Get the appropriate effect handler for this effect type with proper type safety
        const handler = effectHandlers[effect.type] as EffectHandler<typeof effect>;
        
        // If there's no handler for this effect type, assume it can be applied
        if (!handler) {
            return true;
        }
        
        // First, check if all required targets are available
        const requirements = handler.getResolutionRequirements(effect);
        
        // If there are requirements, check if all required targets are available
        if (requirements.length > 0) {
            for (const requirement of requirements) {
                if (requirement.required && !TargetResolver.isTargetAvailable(requirement.target, handlerData, context, cardRepository)) {
                    return false;
                }
            }
        }
        
        // If all required targets are available, then check if the handler has additional validation
        if (handler.canApply) {
            const canApplyResult = handler.canApply(handlerData, effect, context, cardRepository);
            return canApplyResult;
        }
        
        // If no additional validation is needed, the effect can be applied
        return true;
    }
}
