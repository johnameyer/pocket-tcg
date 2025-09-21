import { HandlerData } from '../game-handler.js';
import { CardRepository } from '../repository/card-repository.js';
import { EnergyController } from '../controllers/energy-controller.js';
import { EffectValidator } from './effect-validator.js';
import { EffectContextFactory } from './effect-context.js';
import { TargetResolver } from './target-resolver.js';
import { Effect } from '../repository/effect-types.js';

/**
 * ActionValidator provides HandlerData-based validation methods for game actions.
 * This centralizes validation logic that was previously duplicated in the intermediary handler.
 */
export class ActionValidator {
    /**
     * Checks if a creature can evolve.
     * 
     * @param handlerData The handler data
     * @param playerId The player ID
     * @param position The position of the creature (0 for active, 1+ for bench)
     * @returns True if the creature can evolve, false otherwise
     */
    static canEvolvecreature(handlerData: HandlerData, cardRepository: CardRepository, playerId: number, position: number): boolean {
        const creature = handlerData.field.creatures[playerId]?.[position];
        if (!creature) return false;
        
        const currentTurn = handlerData.turnCounter.turnNumber;
        
        // Cannot evolve on first turn or if creature was played this turn
        if (currentTurn <= 1 || (creature.turnPlayed !== undefined && creature.turnPlayed >= currentTurn)) return false;
        
        // TODO: Let's add onto the data the controller provides to handlers to fix
        // Check if evolution ability has been used this turn
        // Note: HandlerData doesn't have this method directly, so we'll skip this check
        // This would be handled by the controller in the actual application
        
        // Check if evolution exists
        const allCreatures = cardRepository.getAllCreatureIds();
        return allCreatures.some(id => {
            const data = cardRepository.getCreature(id);
            return data.evolvesFrom === creature.templateId;
        });
    }
    
    /**
     * Checks if energy can be attached.
     * 
     * @param handlerData The handler data
     * @param playerId The player ID
     * @param energyType Optional energy type to check
     * @returns True if energy can be attached, false otherwise
     */
    static canAttachEnergy(handlerData: HandlerData, cardRepository: CardRepository, playerId: number, energyType?: string): boolean {
        // Cannot attach energy if already attached this turn
        if (handlerData.energy.energyAttachedThisTurn[playerId]) return false;
        
        // Cannot attach energy on first turn as first player
        if (handlerData.energy.isAbsoluteFirstTurn) return false;
        
        // Check if energy is available
        const availableTypes = EnergyController.getAvailableEnergyTypes(handlerData.energy, playerId);
        
        // If specific energy type is requested, check if it's available
        if (energyType) {
            return availableTypes.includes(energyType);
        }
        
        // Otherwise, check if any energy is available
        return availableTypes.length > 0;
    }
    
    /**
     * Checks if a creature can retreat.
     * 
     * @param handlerData The handler data
     * @param playerId The player ID
     * @returns True if the creature can retreat, false otherwise
     */
    static canRetreat(handlerData: HandlerData, cardRepository: CardRepository, playerId: number): boolean {
        const activecreature = handlerData.field.creatures[playerId]?.[0]; // Position 0 is active
        if (!activecreature) return false;
        
        // Check if there are bench creature to retreat to
        const benchedcreature = handlerData.field.creatures[playerId].slice(1); // Positions 1+ are benched
        if (benchedcreature.length === 0) return false;
        
        // Check if creature has enough energy to retreat
        const creatureData = cardRepository.getCreature(activecreature.templateId);
        const retreatCost = creatureData.retreatCost || 0;
        const energyCount = EnergyController.getTotalEnergyByInstance(handlerData.energy, activecreature.instanceId);
        
        return energyCount >= retreatCost;
    }
    
    /**
     * Checks if a creature can use an attack.
     * 
     * @param handlerData The handler data
     * @param playerId The player ID
     * @param attackIndex The index of the attack
     * @returns True if the creature can use the attack, false otherwise
     */
    static canUseAttack(handlerData: HandlerData, cardRepository: CardRepository, playerId: number, attackIndex: number): boolean {
        const activecreature = handlerData.field.creatures[playerId]?.[0]; // Position 0 is active
        if (!activecreature) return false;
        
        // Get the creature data
        const creatureData = cardRepository.getCreature(activecreature.templateId);
        
        // Check if attack index is valid
        if (attackIndex < 0 || attackIndex >= creatureData.attacks.length) return false;
        
        // Check if creature has enough energy for the attack
        const attack = creatureData.attacks[attackIndex];
        return EnergyController.canUseAttackByInstance(handlerData.energy, activecreature.instanceId, attack.energyRequirements);
    }
    
    /**
     * Checks if a card can be played.
     * 
     * @param handlerData The handler data
     * @param cardId The card ID
     * @param playerId The player ID
     * @returns True if the card can be played, false otherwise
     */
    static canPlayCard(handlerData: HandlerData, cardRepository: CardRepository, cardId: string, playerId: number): boolean {
        // Find the card in the player's hand
        const hand = handlerData.hand;
        const cardIndex = hand.findIndex(card => card.templateId === cardId);
        
        if (cardIndex === -1) return false; // Card not in hand
        
        const card = hand[cardIndex];
        
        // Check card type-specific validation
        switch (card.type) {
            case 'creature':
                return this.canPlaycreatureCard(handlerData, cardRepository, cardId, playerId);
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
     * 
     * @param handlerData The handler data
     * @param cardId The card ID
     * @param playerId The player ID
     * @returns True if the creature card can be played, false otherwise
     */
    private static canPlaycreatureCard(handlerData: HandlerData, cardRepository: CardRepository, cardId: string, playerId: number): boolean {
        const creatureData = cardRepository.getCreature(cardId);
        
        // Cannot play evolved creature directly
        if (creatureData.evolvesFrom) return false;
        
        // Check if bench is full
        const benchSize = handlerData.field.creatures[playerId].length - 1; // Subtract 1 for active creature
        return benchSize < 3; // Maximum 3 bench creature
    }
    
    /**
     * Checks if an item card can be played.
     * 
     * @param handlerData The handler data
     * @param cardId The card ID
     * @param playerId The player ID
     * @returns True if the item card can be played, false otherwise
     */
    private static canPlayItemCard(handlerData: HandlerData, cardRepository: CardRepository, cardId: string, playerId: number): boolean {
        const itemData = cardRepository.getItem(cardId);
        if (!itemData) return false;
        
        // Check if item has effects that can be applied
        if (itemData.effects && itemData.effects.length > 0) {
            // Create a context for validation using the actual item name
            const context = EffectContextFactory.createCardContext(playerId, itemData.name, 'item');
            
            // Use EffectValidator for all items - no special cases
            return EffectValidator.canApplyCardEffects(itemData.effects, handlerData, playerId, itemData.name, 'item', cardRepository);
        }
        
        return true;
    }
    
    // TODO: Can we re-work this to use our new effect helper methods and only that no custom overrides for specific trainers?
    /**
     * Checks if a supporter card can be played.
     * 
     * @param handlerData The handler data
     * @param cardId The card ID
     * @param playerId The player ID
     * @returns True if the supporter card can be played, false otherwise
     */
    private static canPlaySupporterCard(handlerData: HandlerData, cardRepository: CardRepository, cardId: string, playerId: number): boolean {
        // Check if a supporter has already been played this turn
        if (handlerData.turnState.supporterPlayedThisTurn) return false;
        
        const supporterData = cardRepository.getSupporter(cardId);
        if (!supporterData) return false;
        
        // For supporters with effects, check if any effect can be applied
        if (supporterData.effects && supporterData.effects.length > 0) {
            // Use EffectValidator to check if supporter effects can be applied
            return EffectValidator.canApplyCardEffects(supporterData.effects, handlerData, playerId, supporterData.name, 'supporter', cardRepository);
        }
        
        return true;
    }
    
    /**
     * Checks if a creature can use an ability.
     * 
     * @param handlerData The handler data
     * @param playerId The player ID
     * @param position The position of the creature (0 for active, 1+ for bench)
     * @param abilityIndex The index of the ability
     * @returns True if the creature can use the ability, false otherwise
     */
    static canUseAbility(handlerData: HandlerData, cardRepository: CardRepository, playerId: number, position: number, abilityIndex: number): boolean {
        const creature = handlerData.field.creatures[playerId]?.[position];
        if (!creature) return false;
        
        // Get the creature data
        const creatureData = cardRepository.getCreature(creature.templateId);
        if (!creatureData.abilities || abilityIndex >= creatureData.abilities.length) return false;
        
        const ability = creatureData.abilities[abilityIndex];
        
        // Check if ability has already been used this turn
        // Note: HandlerData doesn't have this method directly, so we'll skip this check
        // This would be handled by the controller in the actual application
        
        // Check if ability effects can be applied
        if (ability.effects && ability.effects.length > 0) {
            // Use EffectValidator to check if ability effects can be applied (treat as supporter-like)
            return EffectValidator.canApplyCardEffects(ability.effects, handlerData, playerId, `${creatureData.name}'s ${ability.name}`, undefined, cardRepository);
        }
        
        return true;
    }
}
