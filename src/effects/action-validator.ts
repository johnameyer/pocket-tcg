import { HandlerData } from '../game-handler.js';
import { CardRepository } from '../repository/card-repository.js';
import { EnergyController } from '../controllers/energy-controller.js';
import { EffectValidator } from './effect-validator.js';
import { EffectContextFactory } from './effect-context.js';
import { TargetResolver } from './target-resolver.js';
import { Effect } from '../repository/effect-types.js';
import { StatusEffect } from '../controllers/status-effect-controller.js';
import { getCurrentTemplateId, getCurrentInstanceId } from '../utils/field-card-utils.js';

/**
 * ActionValidator provides HandlerData-based validation methods for game actions.
 * This centralizes validation logic that was previously duplicated in the intermediary handler.
 */
export class ActionValidator {
    /**
     * Checks if a creature can evolve.
     */
    static canEvolveCreature(handlerData: HandlerData, cardRepository: CardRepository, playerId: number, position: number): boolean {
        const creature = handlerData.field.creatures[playerId]?.[position];
        if (!creature) return false;
        
        const currentTurn = handlerData.turnCounter.turnNumber;
        
        if (currentTurn <= 1 || (creature.turnLastPlayed !== undefined && creature.turnLastPlayed >= currentTurn)) return false;
        
        const allCreatures = cardRepository.getAllCreatureIds();
        return allCreatures.some(id => {
            const data = cardRepository.getCreature(id);
            return data.evolvesFrom === getCurrentTemplateId(creature);
        });
    }
    
    /**
     * Checks if energy can be attached.
     */
    static canAttachEnergy(handlerData: HandlerData, cardRepository: CardRepository, playerId: number, energyType?: string): boolean {
        if (handlerData.energy.energyAttachedThisTurn[playerId]) return false;
        
        if (handlerData.energy.isAbsoluteFirstTurn) return false;
        
        const availableTypes = EnergyController.getAvailableEnergyTypes(handlerData.energy, playerId);
        
        if (energyType) {
            return availableTypes.includes(energyType);
        }
        
        return availableTypes.length > 0;
    }
    
    /**
     * Checks if a creature can retreat.
     */
    static canRetreat(handlerData: HandlerData, cardRepository: CardRepository, playerId: number): boolean {
        const activeCreature = handlerData.field.creatures[playerId]?.[0];
        if (!activeCreature) return false;
        
        const benchedCreatures = handlerData.field.creatures[playerId].slice(1);
        if (benchedCreatures.length === 0) return false;
        
        // No retreat prevention system currently implemented
        // const retreatPreventions = handlerData.turnState.retreatPreventions || [];
        // if (retreatPreventions.includes(activeCreature.instanceId)) {
        //     return false;
        // }
        
        const creatureData = cardRepository.getCreature(getCurrentTemplateId(activeCreature));
        const retreatCost = creatureData.retreatCost || 0;
        const energyCount = EnergyController.getTotalEnergyByInstance(handlerData.energy, getCurrentInstanceId(activeCreature));
        
        const statusEffects = (handlerData.statusEffects?.activeStatusEffects[playerId] as unknown as StatusEffect[]) || [];
        const isAsleep = statusEffects.some((e: StatusEffect) => e.type === 'sleep');
        const isParalyzed = statusEffects.some((e: StatusEffect) => e.type === 'paralysis');
        
        if (isAsleep || isParalyzed) {
            return false;
        }
        
        return energyCount >= retreatCost;
    }
    
    /**
     * Checks if a creature can use an attack.
     */
    static canUseAttack(handlerData: HandlerData, cardRepository: CardRepository, playerId: number, attackIndex: number): boolean {
        const activeCreature = handlerData.field.creatures[playerId]?.[0];
        if (!activeCreature) return false;
        
        const statusEffects = (handlerData.statusEffects?.activeStatusEffects[playerId] as unknown as StatusEffect[]) || [];
        const isAsleep = statusEffects.some((e: StatusEffect) => e.type === 'sleep');
        const isParalyzed = statusEffects.some((e: StatusEffect) => e.type === 'paralysis');
        
        if (isAsleep || isParalyzed) {
            return false;
        }
        
        const creatureData = cardRepository.getCreature(getCurrentTemplateId(activeCreature));
        
        if (attackIndex < 0 || attackIndex >= creatureData.attacks.length) return false;
        
        const attack = creatureData.attacks[attackIndex];
        return EnergyController.canUseAttackByInstance(handlerData.energy, getCurrentInstanceId(activeCreature), attack.energyRequirements);
    }
    
    /**
     * Checks if a card can be played.
     */
    static canPlayCard(handlerData: HandlerData, cardRepository: CardRepository, cardId: string, playerId: number): boolean {
        const hand = handlerData.hand;
        const cardIndex = hand.findIndex(card => card.templateId === cardId);
        
        if (cardIndex === -1) return false;
        
        const card = hand[cardIndex];
        
        switch (card.type) {
            case 'creature':
                return this.canPlayCreatureCard(handlerData, cardRepository, cardId, playerId);
            case 'item':
                return this.canPlayItemCard(handlerData, cardRepository, cardId, playerId);
            case 'supporter':
                return this.canPlaySupporterCard(handlerData, cardRepository, cardId, playerId);
            default:
                return false;
        }
    }
    
    /**
     * Checks if a creature card can be played.
     */
    private static canPlayCreatureCard(handlerData: HandlerData, cardRepository: CardRepository, cardId: string, playerId: number): boolean {
        const creatureData = cardRepository.getCreature(cardId);
        
        if (creatureData.evolvesFrom) return false;
        
        const benchSize = handlerData.field.creatures[playerId].length - 1;
        return benchSize < 3;
    }
    
    /**
     * Checks if an item card can be played.
     */
    private static canPlayItemCard(handlerData: HandlerData, cardRepository: CardRepository, cardId: string, playerId: number): boolean {
        const itemData = cardRepository.getItem(cardId);
        if (!itemData) return false;
        
        if (itemData.effects && itemData.effects.length > 0) {
            const context = EffectContextFactory.createCardContext(playerId, itemData.name, 'item');
            
            return EffectValidator.canApplyCardEffects(itemData.effects, handlerData, playerId, itemData.name, 'item', cardRepository);
        }
        
        return true;
    }
    
    /**
     * Checks if a supporter card can be played.
     */
    private static canPlaySupporterCard(handlerData: HandlerData, cardRepository: CardRepository, cardId: string, playerId: number): boolean {
        if (handlerData.turnState.supporterPlayedThisTurn) return false;
        
        const supporterData = cardRepository.getSupporter(cardId);
        if (!supporterData) return false;
        
        if (supporterData.effects && supporterData.effects.length > 0) {
            return EffectValidator.canApplyCardEffects(supporterData.effects, handlerData, playerId, supporterData.name, 'supporter', cardRepository);
        }
        
        return true;
    }
    
    /**
     * Checks if a creature can use an ability.
     */
    static canUseAbility(handlerData: HandlerData, cardRepository: CardRepository, playerId: number, position: number): boolean {
        const creature = handlerData.field.creatures[playerId]?.[position];
        if (!creature) return false;
        
        const creatureData = cardRepository.getCreature(getCurrentTemplateId(creature));
        if (!creatureData.ability) return false;
        
        const ability = creatureData.ability;
        
        if (ability.effects && ability.effects.length > 0) {
            return EffectValidator.canApplyCardEffects(ability.effects, handlerData, playerId, `${creatureData.name}'s ${ability.name}`, undefined, cardRepository);
        }
        
        return true;
    }
}
