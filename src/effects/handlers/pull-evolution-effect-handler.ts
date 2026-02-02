import { Controllers } from '../../controllers/controllers.js';
import { PullEvolutionEffect } from '../../repository/effect-types.js';
import { EffectContext } from '../effect-context.js';
import { AbstractEffectHandler, ResolutionRequirement } from '../interfaces/effect-handler-interface.js';
import { TargetResolver } from '../target-resolver.js';
import { getCurrentTemplateId } from '../../utils/field-card-utils.js';

/**
 * Handler for pull evolution effects that pull evolution cards from deck and immediately evolve.
 */
export class PullEvolutionEffectHandler extends AbstractEffectHandler<PullEvolutionEffect> {
    /**
     * Get resolution requirements for pull evolution effect.
     * 
     * @param effect The pull evolution effect
     * @returns Resolution requirements
     */
    getResolutionRequirements(effect: PullEvolutionEffect): ResolutionRequirement[] {
        if (TargetResolver.requiresTargetSelection(effect.target, {} as EffectContext)) {
            return [{ targetProperty: 'target', target: effect.target, required: true }];
        }
        return [];
    }
    
    /**
     * Apply a pull evolution effect.
     * This searches the deck for an evolution card and immediately evolves the target.
     * 
     * @param controllers Game controllers
     * @param effect The pull evolution effect to apply
     * @param context Effect context
     */
    apply(controllers: Controllers, effect: PullEvolutionEffect, context: EffectContext): void {
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
        
        const targetCard = controllers.field.getRawCardByPosition(playerId, fieldIndex);
        if (!targetCard) {
            controllers.players.messageAll({
                type: 'status',
                components: [ `${context.effectName} cannot find target card!` ],
            });
            return;
        }
        
        // Get the current card data
        const currentData = controllers.cardRepository.getCreature(getCurrentTemplateId(targetCard));
        
        // Check evolution restrictions unless skipRestrictions is set
        if (!effect.skipRestrictions) {
            const currentTurn = controllers.turnCounter.getTurnNumber();
            if (targetCard.turnPlayed === currentTurn) {
                controllers.players.messageAll({
                    type: 'status',
                    components: [ `${context.effectName} cannot evolve ${currentData.name} on the turn it was played!` ],
                });
                return;
            }
        }
        
        // Search the deck for a valid evolution
        const deck = controllers.deck.getDeck(playerId);
        let evolutionCard = null;
        let evolutionCardIndex = -1;
        
        // Filter by criteria if provided
        for (let i = 0; i < deck.length; i++) {
            const card = deck[i];
            if (card.type !== 'creature') {
                continue;
            }
            
            try {
                const evolutionData = controllers.cardRepository.getCreature(card.templateId);
                
                // Check if this card evolves from the current card
                if (evolutionData.previousStageName !== currentData.name) {
                    continue;
                }
                
                // Check criteria if provided
                if (effect.evolutionCriteria) {
                    // Only check creature-specific properties if cardType is 'creature'
                    if (effect.evolutionCriteria.cardType === 'creature') {
                        // Check stage
                        if (effect.evolutionCriteria.stage !== undefined) {
                            if (evolutionData.stage !== effect.evolutionCriteria.stage) {
                                continue;
                            }
                        }
                        
                        // Check energy type
                        if (effect.evolutionCriteria.energyType !== undefined) {
                            if (evolutionData.type !== effect.evolutionCriteria.energyType) {
                                continue;
                            }
                        }
                        
                        // Check HP
                        if (effect.evolutionCriteria.hpGreaterThan !== undefined) {
                            if (evolutionData.maxHp <= effect.evolutionCriteria.hpGreaterThan) {
                                continue;
                            }
                        }
                        if (effect.evolutionCriteria.hpLessThan !== undefined) {
                            if (evolutionData.maxHp >= effect.evolutionCriteria.hpLessThan) {
                                continue;
                            }
                        }
                    }
                    
                    // Check specific names (applies to all card types)
                    if (effect.evolutionCriteria.names) {
                        if (!effect.evolutionCriteria.names.includes(evolutionData.name)) {
                            continue;
                        }
                    }
                }
                
                // Found a valid evolution
                evolutionCard = card;
                evolutionCardIndex = i;
                break;
            } catch (error) {
                continue;
            }
        }
        
        if (!evolutionCard) {
            controllers.players.messageAll({
                type: 'status',
                components: [ `${context.effectName} found no valid evolution for ${currentData.name}!` ],
            });
            return;
        }
        
        // Remove the evolution card from the deck
        deck.splice(evolutionCardIndex, 1);
        
        // Evolve the creature based on field position
        if (fieldIndex === 0) {
            controllers.field.evolveActiveCard(playerId, evolutionCard.templateId, evolutionCard.instanceId);
        } else {
            // Bench index is fieldIndex - 1
            controllers.field.evolveBenchedCard(playerId, fieldIndex - 1, evolutionCard.templateId, evolutionCard.instanceId);
        }
        
        // Shuffle the deck
        controllers.deck.shuffle(playerId);
        
        // Send a message
        const evolutionData = controllers.cardRepository.getCreature(evolutionCard.templateId);
        controllers.players.messageAll({
            type: 'status',
            components: [ `${context.effectName} evolves ${currentData.name} into ${evolutionData.name}!` ],
        });
    }
}

export const pullEvolutionEffectHandler = new PullEvolutionEffectHandler();
