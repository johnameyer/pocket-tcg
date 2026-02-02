import { Controllers } from '../../controllers/controllers.js';
import { MoveCardsEffect } from '../../repository/effect-types.js';
import { EffectContext } from '../effect-context.js';
import { AbstractEffectHandler, ResolutionRequirement } from '../interfaces/effect-handler-interface.js';
import { TargetResolver } from '../target-resolver.js';
import { GameCard } from '../../controllers/card-types.js';

/**
 * Handler for move cards effects that move cards (with tools/evolution) to deck/hand.
 */
export class MoveCardsEffectHandler extends AbstractEffectHandler<MoveCardsEffect> {
    /**
     * Get resolution requirements for move cards effect.
     * 
     * @param effect The move cards effect
     * @returns Resolution requirements
     */
    getResolutionRequirements(effect: MoveCardsEffect): ResolutionRequirement[] {
        const requirements: ResolutionRequirement[] = [];
        
        if (TargetResolver.requiresTargetSelection(effect.target, {} as EffectContext)) {
            requirements.push({ targetProperty: 'target', target: effect.target, required: true });
        }
        
        if (effect.switchWith && TargetResolver.requiresTargetSelection(effect.switchWith, {} as EffectContext)) {
            requirements.push({ targetProperty: 'switchWith', target: effect.switchWith, required: true });
        }
        
        return requirements;
    }
    
    /**
     * Apply a move cards effect.
     * This moves cards (possibly with tools and evolution stack) to deck or hand.
     * 
     * Note: This is a simplified implementation. Full implementation would require
     * more controller methods for moving cards with tools and evolution stacks.
     * 
     * @param controllers Game controllers
     * @param effect The move cards effect to apply
     * @param context Effect context
     */
    apply(controllers: Controllers, effect: MoveCardsEffect, context: EffectContext): void {
        // Resolve the target - use resolveTarget instead of resolveSingleTarget
        const resolution = TargetResolver.resolveTarget(effect.target, controllers, context);
        
        if (resolution.type === 'no-valid-targets') {
            controllers.players.messageAll({
                type: 'status',
                components: [ `${context.effectName} has no valid targets!` ],
            });
            return;
        }
        
        if (resolution.type === 'requires-selection') {
            // Target selection is handled by the effect applier
            return;
        }
        
        // Get the first target
        let playerId: number;
        let fieldIndex: number;
        
        if (resolution.type === 'resolved') {
            playerId = resolution.targets[0].playerId;
            fieldIndex = resolution.targets[0].fieldIndex;
        } else if (resolution.type === 'auto-resolved') {
            playerId = resolution.playerId;
            fieldIndex = resolution.fieldIndex;
        } else {
            // all-matching - just take the first one
            playerId = resolution.targets[0].playerId;
            fieldIndex = resolution.targets[0].fieldIndex;
        }
        
        // Get the card data for messaging
        const targetCard = controllers.field.getCardByPosition(playerId, fieldIndex);
        if (!targetCard) {
            controllers.players.messageAll({
                type: 'status',
                components: [ `${context.effectName} cannot find target card!` ],
            });
            return;
        }
        
        // For now, just send a message indicating this effect is not fully implemented
        // Full implementation would require:
        // 1. New controller methods to properly handle card removal with tools/evolution
        // 2. Switch handling for active cards
        // 3. Proper discard/deck/hand management for evolution stacks
        controllers.players.messageAll({
            type: 'status',
            components: [ 
                `${context.effectName} would move ${targetCard.data.name} to ${effect.destination}` +
                `${effect.includeTools ? ' with tools' : ''}` +
                `${effect.includeEvolutionStack ? ' with evolution stack' : ''} (not yet fully implemented)`,
            ],
        });
    }
}

export const moveCardsEffectHandler = new MoveCardsEffectHandler();
