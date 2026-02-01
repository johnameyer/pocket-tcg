import { Controllers } from '../../controllers/controllers.js';
import { SwitchEffect } from '../../repository/effect-types.js';
import { EffectContext } from '../effect-context.js';
import { AbstractEffectHandler, ResolutionRequirement } from '../interfaces/effect-handler-interface.js';
import { HandlerData } from '../../game-handler.js';
import { CardRepository } from '../../repository/card-repository.js';
import { TargetResolver } from '../target-resolver.js';

/**
 * Handler for switch effects that move a creature from the bench to the active position
 */
export class SwitchEffectHandler extends AbstractEffectHandler<SwitchEffect> {
    /**
     * Validate if a switch effect can be applied.
     * Checks if there are valid targets for switching.
     * 
     * @param handlerData Handler data view
     * @param effect The switch effect to validate
     * @param context Effect context
     * @returns True if the effect can be applied, false otherwise
     */
    canApply(handlerData: HandlerData, effect: SwitchEffect, context: EffectContext, cardRepository: CardRepository): boolean {
        // If there's no switchWith target, we can't apply the effect
        if(!effect.switchWith) {
            return false;
        }
        
        // Use TargetResolver to check if the target is available
        return TargetResolver.isTargetAvailable(effect.switchWith, handlerData, context, cardRepository);
    }

    getResolutionRequirements(effect: SwitchEffect): ResolutionRequirement[] {
        return [{ targetProperty: 'switchWith', target: effect.switchWith, required: true }];
    }

    apply(controllers: Controllers, effect: SwitchEffect, context: EffectContext): void {
        // Check if we have a valid target
        if(!effect.switchWith) {
            return;
        }

        // Targets are always resolved by EffectApplier
        if(effect.switchWith.type !== 'resolved') {
            throw new Error(`Expected resolved target, got ${effect.switchWith?.type || effect.switchWith}`);
        }
        
        const targets = effect.switchWith.targets;
        
        if(targets.length === 0) {
            controllers.players.messageAll({
                type: 'status',
                components: [ `${context.effectName} found no valid targets!` ],
            });
            return;
        }
        
        for(const target of targets) {
            const { playerId, fieldIndex } = target;

            // Only proceed if we're switching with a bench creature (index > 0)
            if(fieldIndex > 0) {
                /*
                 * For SelectTargetResponseMessage and throughout the codebase, we now use consistent indexing:
                 * 0 = active, 1-3 = bench positions
                 * The forceSwitch method expects a 0-based bench index (0, 1, 2)
                 */
                const benchIndex = fieldIndex - 1;
                
                controllers.field.forceSwitch(playerId, benchIndex);

                // Get the active creature after the switch
                const newActivecreature = controllers.field.getCardByPosition(playerId, 0);
                
                this.notifySwitch(controllers, playerId);
            } else {
                throw new Error(`Invalid creature index ${fieldIndex}`);
            }
        }
    }

    // Helper method to notify about the switch
    private notifySwitch(controllers: Controllers, playerId: number): void {
        const newActivecreature = controllers.field.getCardByPosition(playerId, 0);

        if(!newActivecreature) {
            return;
        }

        try {
            // Get the creature data
            const pokemonName = controllers.cardRepository.getCreature(newActivecreature.templateId).name;

            controllers.players.messageAll({
                type: 'status',
                components: [ `${pokemonName} was switched to active position!` ],
            });
        } catch (error) {
            // Error handling for notification
        }
    }
}

export const switchEffectHandler = new SwitchEffectHandler();
