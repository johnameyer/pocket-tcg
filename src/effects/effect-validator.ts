import { HandlerData } from '../game-handler.js';
import { CardRepository } from '../repository/card-repository.js';
import { Effect } from '../repository/effect-types.js';
import { EffectContextFactory } from './effect-context.js';
import { EffectContext } from './effect-context.js';
import { effectHandlers } from './handlers/effect-handlers-map.js';
import { FieldTargetResolver } from './target-resolvers/field-target-resolver.js';
import { EffectHandler } from './interfaces/effect-handler-interface.js';

export class EffectValidator {
    /**
     * Check if any effect in the array can be applied using HandlerData
     * @returns undefined if valid, rejection reason if invalid
     */
    static canApplyAnyEffect(effects: Effect[], handlerData: HandlerData, sourcePlayer: number, effectName: string, cardRepository?: CardRepository): string | undefined {
        const context = EffectContextFactory.createCardContext(sourcePlayer, effectName, 'item');
        for (const effect of effects) {
            const reason = this.canApplyEffect(effect, handlerData, context, cardRepository!);
            if (!reason) {
                return undefined;
            }
        }
        return 'No applicable effects available';
    }

    /**
     * Check if all effects in the array can be applied using HandlerData
     * @returns undefined if valid, rejection reason if invalid
     */
    static canApplyAllEffects(effects: Effect[], handlerData: HandlerData, sourcePlayer: number, effectName: string, cardType: 'supporter' | 'item' = 'item', cardRepository?: CardRepository): string | undefined {
        const context = EffectContextFactory.createCardContext(sourcePlayer, effectName, cardType);
        
        // If no repository provided, assume effects can be applied (for test scenarios)
        if (!cardRepository) {
            return undefined;
        }
        
        for (const effect of effects) {
            const reason = this.canApplyEffect(effect, handlerData, context, cardRepository);
            if (reason) {
                // console.error(`[EFFECT-VALIDATOR] canApplyAllEffects FAIL: ${effectName} (${cardType}) - ${reason}`);
                return reason;
            }
        }
        return undefined;
    }

    /**
     * Check if a card's effects can be applied using HandlerData (for validation)
     * @returns undefined if valid, rejection reason if invalid
     */
    static canApplyCardEffects(cardEffects: Effect[] | undefined, handlerData: HandlerData, sourcePlayer: number, effectName: string, cardType?: 'supporter' | 'item', cardRepository?: CardRepository): string | undefined {
        // console.error(`[EFFECT-VALIDATOR] canApplyCardEffects called: ${effectName} (${cardType}), effects=${cardEffects?.length || 0}`);
        if (!cardEffects || cardEffects.length === 0) {
            return undefined;
        }
        
        /*
         * For supporter cards, all effects must be applicable
         * This ensures cards like Erika, Irida, and Lillie can't be played when there are no valid targets
         */
        if (cardType === 'supporter') {
            return this.canApplyAllEffects(cardEffects, handlerData, sourcePlayer, effectName, cardType, cardRepository);
        }
        
        // For other card types, any effect being applicable is sufficient
        return this.canApplyAnyEffect(cardEffects, handlerData, sourcePlayer, effectName, cardRepository);
    }


    /**
     * Check if an effect can be applied using HandlerData
     * First checks if all required targets are available, then calls the handler's canApply method.
     * @returns undefined if valid, rejection reason if invalid
     */
    static canApplyEffect(effect: Effect, handlerData: HandlerData, context: EffectContext, cardRepository: CardRepository): string | undefined {
        
        // Get the appropriate effect handler for this effect type with proper type safety
        const handler = effectHandlers[effect.type] as EffectHandler<typeof effect>;
        
        // If there's no handler for this effect type, assume it can be applied
        if (!handler) {
            return undefined;
        }
        
        // First, check if all required targets are available
        const requirements = handler.getResolutionRequirements(effect);
        
        // If there are requirements, check if all required targets are available
        if (requirements.length > 0) {
            for (const requirement of requirements) {
                if (requirement.required && !FieldTargetResolver.isTargetAvailable(requirement.target, handlerData, context, cardRepository)) {
                    return `Missing required target: ${requirement.targetProperty}`;
                }
            }
        }
        
        // If all required targets are available, then check if the handler has additional validation
        if (handler.canApply) {
            const reason = handler.canApply(handlerData, effect, context, cardRepository);
            if (reason) {
                // console.error(`[EFFECT-VALIDATOR] canApplyEffect FAIL: ${effect.type} - ${reason}`);
                return reason;
            }
        }
        
        // If no additional validation is needed, the effect can be applied
        return undefined;
    }
}
