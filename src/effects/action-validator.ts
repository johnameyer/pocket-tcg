import { HandlerData } from '../game-handler.js';
import { CardRepository } from '../repository/card-repository.js';
import { EnergyController, AttachableEnergyType } from '../controllers/energy-controller.js';
import { StatusEffect } from '../controllers/status-effect-controller.js';
import { getCurrentTemplateId, getFieldInstanceId } from '../utils/field-card-utils.js';
import { EffectValidator } from './effect-validator.js';

/**
 * ActionValidator provides HandlerData-based validation methods for game actions.
 * This centralizes validation logic that was previously duplicated in the intermediary handler.
 * 
 * Return pattern: undefined = valid, string = rejection reason
 */
export class ActionValidator {
    /**
     * Checks if a creature can evolve.
     * @returns undefined if valid, rejection reason if invalid
     */
    static canEvolveCreature(handlerData: HandlerData, cardRepository: CardRepository, playerId: number, position: number): string | undefined {
        const creature = handlerData.field.creatures[playerId]?.[position];
        if (!creature) {
            return 'No creature at that position';
        }
        
        const currentTurn = handlerData.turnCounter.turnNumber;
        
        if (currentTurn <= 1) {
            return 'Cannot evolve on turn 1';
        }
        
        if (creature.turnLastPlayed !== undefined && creature.turnLastPlayed >= currentTurn) {
            return 'Cannot evolve on the turn creature was played';
        }
        
        const creatureData = cardRepository.getCreature(getCurrentTemplateId(creature));
        const allCreatures = cardRepository.getAllCreatureIds();
        const canEvolve = allCreatures.some(id => {
            const data = cardRepository.getCreature(id);
            return data.previousStageName === creatureData.name;
        });
        
        return canEvolve ? undefined : 'No valid evolutions available';
    }
    
    /**
     * Checks if energy can be attached.
     * @returns undefined if valid, rejection reason if invalid
     */
    static canAttachEnergy(handlerData: HandlerData, cardRepository: CardRepository, playerId: number, energyType?: string): string | undefined {
        // Check if energy is available (currentEnergy is not null)
        if (handlerData.energy.currentEnergy[playerId] === null) {
            return 'No energy available to attach';
        }
        
        if (handlerData.energy.isAbsoluteFirstTurn) {
            return 'Cannot attach energy on first turn';
        }
        
        const availableTypes = EnergyController.getAvailableEnergyTypes(handlerData.energy, playerId);
        
        if (energyType) {
            return availableTypes.includes(energyType as AttachableEnergyType) ? undefined : `No ${energyType} energy available`;
        }
        
        return availableTypes.length > 0 ? undefined : 'No energy available to attach';
    }
    
    /**
     * Checks if a creature can retreat.
     * @returns undefined if valid, rejection reason if invalid
     */
    static canRetreat(handlerData: HandlerData, cardRepository: CardRepository, playerId: number): string | undefined {
        const activeCreature = handlerData.field.creatures[playerId]?.[0];
        if (!activeCreature) {
            return 'No active creature to retreat';
        }
        
        const benchedCreatures = handlerData.field.creatures[playerId].slice(1);
        if (benchedCreatures.length === 0) {
            return 'No benched creatures available to retreat to';
        }
        
        /*
         * No retreat prevention system currently implemented
         * const retreatPreventions = handlerData.turnState.retreatPreventions || [];
         * if (retreatPreventions.includes(activeCreature.instanceId)) {
         *     return 'Creature is prevented from retreating';
         * }
         */
        
        const creatureData = cardRepository.getCreature(getCurrentTemplateId(activeCreature));
        const retreatCost = creatureData.retreatCost || 0;
        const energyCount = EnergyController.getTotalEnergyByInstance(handlerData.energy, getFieldInstanceId(activeCreature));
        
        const statusEffects = (handlerData.statusEffects?.activeStatusEffects[playerId] as unknown as StatusEffect[]) || [];
        const isAsleep = statusEffects.some((e: StatusEffect) => e.type === 'sleep');
        const isParalyzed = statusEffects.some((e: StatusEffect) => e.type === 'paralysis');
        
        if (isAsleep) {
            return 'Creature is asleep and cannot retreat';
        }
        
        if (isParalyzed) {
            return 'Creature is paralyzed and cannot retreat';
        }
        
        if (energyCount < retreatCost) {
            return `Insufficient energy to retreat (have ${energyCount}, need ${retreatCost})`;
        }
        
        return undefined;
    }
    
    /**
     * Checks if a creature can use an attack.
     * @returns undefined if valid, rejection reason if invalid
     */
    static canUseAttack(handlerData: HandlerData, cardRepository: CardRepository, playerId: number, attackIndex: number): string | undefined {
        const activeCreature = handlerData.field.creatures[playerId]?.[0];
        if (!activeCreature) {
            return 'No active creature to attack with';
        }
        
        const statusEffects = (handlerData.statusEffects?.activeStatusEffects[playerId] as unknown as StatusEffect[]) || [];
        const isAsleep = statusEffects.some((e: StatusEffect) => e.type === 'sleep');
        const isParalyzed = statusEffects.some((e: StatusEffect) => e.type === 'paralysis');
        
        if (isAsleep) {
            return 'Creature is asleep and cannot attack';
        }
        
        if (isParalyzed) {
            return 'Creature is paralyzed and cannot attack';
        }
        
        const creatureData = cardRepository.getCreature(getCurrentTemplateId(activeCreature));
        
        if (attackIndex < 0 || attackIndex >= creatureData.attacks.length) {
            return 'Invalid attack index';
        }
        
        const attack = creatureData.attacks[attackIndex];
        const canUse = EnergyController.canUseAttackByInstance(handlerData.energy, getFieldInstanceId(activeCreature), attack.energyRequirements);
        return canUse ? undefined : 'Insufficient energy for this attack';
    }
    
    /**
     * Checks if a card can be played.
     * @returns undefined if valid, rejection reason if invalid
     */
    static canPlayCard(handlerData: HandlerData, cardRepository: CardRepository, cardId: string, playerId: number): string | undefined {
        const hand = handlerData.hand;
        const cardIndex = hand.findIndex(card => card.templateId === cardId);
        
        if (cardIndex === -1) {
            return 'Card not found in hand';
        }
        
        const card = hand[cardIndex];
        
        switch (card.type) {
            case 'creature':
                return this.canPlayCreatureCard(handlerData, cardRepository, cardId, playerId);
            case 'item':
                return this.canPlayItemCard(handlerData, cardRepository, cardId, playerId);
            case 'supporter':
                return this.canPlaySupporterCard(handlerData, cardRepository, cardId, playerId);
            case 'stadium':
                return this.canPlayStadiumCard(handlerData, cardRepository, cardId, playerId);
            default:
                return 'Unknown card type';
        }
    }
    
    /**
     * Checks if a creature card can be played.
     * @returns undefined if valid, rejection reason if invalid
     */
    private static canPlayCreatureCard(handlerData: HandlerData, cardRepository: CardRepository, cardId: string, playerId: number): string | undefined {
        const creatureData = cardRepository.getCreature(cardId);
        
        if (creatureData.previousStageName) {
            return 'Cannot play evolution directly';
        }
        
        const benchSize = handlerData.field.creatures[playerId].length - 1;
        return benchSize < 3 ? undefined : 'Bench is full';
    }
    
    /**
     * Checks if an item card can be played.
     * @returns undefined if valid, rejection reason if invalid
     */
    private static canPlayItemCard(handlerData: HandlerData, cardRepository: CardRepository, cardId: string, playerId: number): string | undefined {
        const itemData = cardRepository.getItem(cardId);
        if (!itemData) {
            return 'Item not found in repository';
        }
        
        if (itemData.effects && itemData.effects.length > 0) {
            const result = EffectValidator.canApplyCardEffects(itemData.effects, handlerData, playerId, itemData.name, 'item', cardRepository);
            if (result) {
                return result;
            }
        }
        
        return undefined;
    }
    
    /**
     * Checks if a supporter card can be played.
     * @returns undefined if valid, rejection reason if invalid
     */
    private static canPlaySupporterCard(handlerData: HandlerData, cardRepository: CardRepository, cardId: string, playerId: number): string | undefined {
        if (handlerData.turnState.supporterPlayedThisTurn) {
            return 'Supporter already played this turn';
        }
        
        const supporterData = cardRepository.getSupporter(cardId);
        if (!supporterData) {
            return 'Supporter not found in repository';
        }
        
        if (supporterData.effects && supporterData.effects.length > 0) {
            const result = EffectValidator.canApplyCardEffects(supporterData.effects, handlerData, playerId, supporterData.name, 'supporter', cardRepository);
            if (result) {
                return result;
            }
        }
        
        return undefined;
    }
    
    /**
     * Checks if a stadium card can be played.
     * @returns undefined if valid, rejection reason if invalid
     */
    private static canPlayStadiumCard(handlerData: HandlerData, cardRepository: CardRepository, cardId: string, playerId: number): string | undefined {
        if (handlerData.turnState.stadiumPlayedThisTurn) {
            return 'Stadium already played this turn';
        }
        
        const stadiumData = cardRepository.getStadium(cardId);
        if (!stadiumData) {
            return 'Stadium not found in repository';
        }
        
        // Check if there's already a stadium with the same name
        const activeStadium = handlerData.stadium?.activeStadium;
        if (activeStadium && activeStadium.name === stadiumData.name) {
            return 'Duplicate stadium already in play';
        }
        
        /*
         * Stadiums can always be played regardless of whether their effects can currently be applied
         * since they have persistent effects that may become relevant later
         */
        return undefined;
    }
    
    /**
     * Checks if a creature can use an ability.
     * @returns undefined if valid, rejection reason if invalid
     */
    static canUseAbility(handlerData: HandlerData, cardRepository: CardRepository, playerId: number, position: number): string | undefined {
        const creature = handlerData.field.creatures[playerId]?.[position];
        if (!creature) {
            return 'No creature at that position';
        }
        
        const creatureData = cardRepository.getCreature(getCurrentTemplateId(creature));
        if (!creatureData.ability) {
            return 'Creature has no ability';
        }
        
        const ability = creatureData.ability;
        
        if (ability.effects && ability.effects.length > 0) {
            return EffectValidator.canApplyCardEffects(ability.effects, handlerData, playerId, `${creatureData.name}'s ${ability.name}`, undefined, cardRepository);
        }
        
        return undefined;
    }
}
