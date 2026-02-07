import { EffectValue } from '../repository/effect-value-types.js';
import { Controllers } from '../controllers/controllers.js';
import { AttachableEnergyType } from '../repository/energy-types.js';
import { FieldCriteria, FieldTargetCriteria } from '../repository/criteria/field-target-criteria.js';
import { EffectContext } from './effect-context.js';
import { FieldTargetResolver } from './target-resolvers/field-target-resolver.js';
import { CardTargetResolver } from './target-resolvers/card-target-resolver.js';
import { CardCriteriaFilter } from './filters/card-criteria-filter.js';
import { AllMatchingFieldTarget } from '../repository/targets/field-target.js';
import { CardCriteria } from '../repository/criteria/card-criteria.js';

// TODO remove
/**
 * Gets the creature instance from a resolved target.
 * 
 * @param controllers Game controllers
 * @param playerId Player ID
 * @param fieldIndex creature index (0 for active, 1+ for bench)
 * @returns The creature instance or undefined if not found
 */
export function getCreatureFromTarget(
    controllers: Controllers,
    playerId: number,
    fieldIndex: number,
) {
    return controllers.field.getCardByPosition(playerId, fieldIndex);
}

/**
 * Gets the resolved target player from context.
 * If targetPlayerId is defined in the context, returns that value.
 * Otherwise, returns the source player as a default.
 */
export function getResolvedTargetPlayer(context: EffectContext): number {
    /*
     * For effects that explicitly require a target but don't have it, throw an error
     * We only check this for contexts that should have a target but don't
     */
    if ('requiresTarget' in context && context.requiresTarget === true 
        && !('targetPlayerId' in context || context.targetPlayerId === undefined)) {
        // For attack contexts, default to opponent's active
        if (context.type === 'attack') {
            return (context.sourcePlayer + 1) % 2; // Opponent player ID
        }
        
        throw new Error(`Missing targetPlayerId in context for ${context.effectName}`);
    }
    
    return context.targetPlayerId !== undefined 
        ? context.targetPlayerId : context.sourcePlayer;
}

/**
 * Gets the resolved target creature index from context.
 * If targetCreatureIndex is defined in the context, returns that value.
 * Otherwise, returns 0 (active creature) as a default.
 */
export function getResolvedTargetCreatureIndex(context: EffectContext): number {
    /*
     * For effects that explicitly require a target but don't have it, throw an error
     * We only check this for contexts that should have a target but don't
     */
    if ('requiresTarget' in context && context.requiresTarget === true 
        && !('targetCreatureIndex' in context || context.targetCreatureIndex === undefined)) {
        // For attack contexts, default to opponent's active (index 0)
        if (context.type === 'attack') {
            return 0; // Active creature
        }
        
        throw new Error(`Missing targetCreatureIndex in context for ${context.effectName}`);
    }
    
    return context.targetCreatureIndex !== undefined 
        ? context.targetCreatureIndex : 0;
}

/**
 * Gets the opponent player ID based on the source player.
 * Useful for effects that target the opponent by default.
 */
export function getOpponentPlayerId(controllers: Controllers, context: EffectContext): number {
    return (context.sourcePlayer + 1) % controllers.players.count;
}

/**
 * Determines if a target is the active creature.
 * Returns true if the target creature index is 0 (active position).
 */
export function isTargetActiveCreature(targetCreatureIndex: number): boolean {
    return targetCreatureIndex === 0;
}

/**
 * Gets the bench index from a creature index.
 * creature index 0 is active, 1+ are bench positions.
 * Returns -1 if the creature is active (not on bench).
 */
export function getBenchIndexFromcreatureIndex(fieldIndex: number): number {
    return fieldIndex > 0 ? fieldIndex - 1 : -1;
}

// New context-based function
export function getEffectValue(effectValue: EffectValue, controllers: Controllers, context: EffectContext): number {
    if (effectValue.type === 'constant') {
        return effectValue.value;
    } else if (effectValue.type === 'player-context-resolved') {
        // Determine player ID based on playerContext
        const playerIdToUse = effectValue.playerContext === 'self' 
            ? context.sourcePlayer 
            : (context.sourcePlayer + 1) % controllers.players.count;
        
        switch (effectValue.source) {
            case 'hand-size': {
                const handSize = controllers.hand.getHandSize(playerIdToUse);
                return handSize !== null && handSize !== undefined ? handSize : 0;
            }
            case 'points-to-win': {
                const currentPoints = controllers.points.get(playerIdToUse);
                const pointsValue = currentPoints !== null && currentPoints !== undefined ? currentPoints : 0;
                return Math.max(1, 3 - pointsValue);
            }
            case 'current-points': {
                const currentPoints = controllers.points.get(playerIdToUse);
                return currentPoints !== null && currentPoints !== undefined ? currentPoints : 0;
            }
            default:
                return 0;
        }
    } else if (effectValue.type === 'multiplication') {
        const baseValue = getEffectValue(effectValue.base, controllers, context);
        const multiplierValue = getEffectValue(effectValue.multiplier, controllers, context);
        return baseValue * multiplierValue;
    } else if (effectValue.type === 'coin-flip') {
        const isHeads = controllers.coinFlip.performCoinFlip();
        return isHeads ? effectValue.headsValue : effectValue.tailsValue;
    } else if (effectValue.type === 'addition') {
        return effectValue.values.reduce((sum: number, value: EffectValue) => sum + getEffectValue(value, controllers, context), 0);
    } else if (effectValue.type === 'conditional') {
        const conditionMet = evaluateConditionWithContext(effectValue.condition, controllers, context);
        return conditionMet 
            ? getEffectValue(effectValue.trueValue, controllers, context) 
            : getEffectValue(effectValue.falseValue, controllers, context);
    } else if (effectValue.type === 'count') {
        return getCountValue(effectValue, controllers, context);
    }
    
    return 0;
}

/**
 * Resolves a count value by counting matching cards/energy/damage based on criteria.
 */
function getCountValue(countValue: EffectValue & { type: 'count' }, controllers: Controllers, context: EffectContext): number {
    if (countValue.countType === 'field') {
        // Count field cards matching criteria using FieldTargetResolver
        return countFieldCards(countValue.criteria, controllers, context);
    } else if (countValue.countType === 'energy') {
        // Count energy on field cards matching criteria
        return countEnergy(countValue.fieldCriteria, countValue.energyCriteria, controllers, context);
    } else if (countValue.countType === 'card') {
        // Count cards in hand/deck/discard matching criteria using CardTargetResolver
        return countCards(countValue.player, countValue.location, countValue.criteria, controllers, context);
    } else if (countValue.countType === 'damage') {
        // Count damage on a specific creature
        return countDamage(countValue.fieldCriteria, controllers, context);
    }
    return 0;
}

/**
 * Counts field cards matching the given criteria using FieldTargetResolver.
 */
function countFieldCards(criteria: FieldTargetCriteria, controllers: Controllers, context: EffectContext): number {
    // Use FieldTargetResolver with an all-matching target to get all matching creatures
    const target: AllMatchingFieldTarget = {
        type: 'all-matching',
        criteria: criteria,
    };
    
    const result = FieldTargetResolver.resolveTarget(target, controllers, context);
    
    if (result.type === 'all-matching') {
        return result.targets.length;
    }
    
    return 0;
}

/**
 * Counts energy on field cards matching criteria.
 */
function countEnergy(
    fieldCriteria: FieldTargetCriteria,
    energyCriteria: { energyTypes?: AttachableEnergyType[] } | undefined,
    controllers: Controllers,
    context: EffectContext,
): number {
    // First, get all matching field cards using FieldTargetResolver
    const target: AllMatchingFieldTarget = {
        type: 'all-matching',
        criteria: fieldCriteria,
    };
    
    const result = FieldTargetResolver.resolveTarget(target, controllers, context);
    
    if (result.type !== 'all-matching') {
        return 0;
    }
    
    // Count energy on each matching creature
    let totalEnergy = 0;
    for (const { playerId, fieldIndex } of result.targets) {
        const fieldInstanceId = controllers.field.getFieldInstanceId(playerId, fieldIndex);
        if (fieldInstanceId) {
            const energyState = controllers.energy.getAttachedEnergyByInstance(fieldInstanceId);
            if (energyState) {
                if (energyCriteria?.energyTypes) {
                    // Count only specific energy types
                    for (const energyType of energyCriteria.energyTypes) {
                        totalEnergy += energyState[energyType] || 0;
                    }
                } else {
                    // Count all energy
                    totalEnergy += Object.values(energyState).reduce((sum: number, count: number) => sum + count, 0);
                }
            }
        }
    }
    
    return totalEnergy;
}

/**
 * Counts cards in a specific location matching criteria using CardTargetResolver.
 */
function countCards(
    player: 'self' | 'opponent',
    location: 'hand' | 'deck' | 'discard' | 'field',
    criteria: CardCriteria | undefined,
    controllers: Controllers,
    context: EffectContext,
): number {
    const playerId = player === 'self' ? context.sourcePlayer : (context.sourcePlayer + 1) % controllers.players.count;
    
    // Use CardTargetResolver to get cards at location
    const cards = CardTargetResolver.getCardsAtLocation(playerId, location, controllers);
    
    // Filter by criteria if provided
    if (criteria) {
        const filtered = CardCriteriaFilter.filter(cards, criteria, controllers.cardRepository.cardRepository);
        return filtered.length;
    }
    
    return cards.length;
}

/**
 * Counts damage on a creature matching criteria.
 */
function countDamage(fieldCriteria: FieldTargetCriteria, controllers: Controllers, context: EffectContext): number {
    // Use FieldTargetResolver to find the matching creature
    const target: AllMatchingFieldTarget = {
        type: 'all-matching',
        criteria: fieldCriteria,
    };
    
    const result = FieldTargetResolver.resolveTarget(target, controllers, context);
    
    if (result.type === 'all-matching' && result.targets.length > 0) {
        // For damage counting, typically we want the first matching creature
        const { playerId, fieldIndex } = result.targets[0];
        const card = controllers.field.getCardByPosition(playerId, fieldIndex);
        if (card) {
            return card.damageTaken || 0;
        }
    }
    
    return 0;
}

// TODO: Consider unifying this with ConditionEvaluator class to eliminate duplication
export function evaluateConditionWithContext(condition: FieldCriteria, controllers: Controllers, context: EffectContext): boolean {
    const fieldCondition = condition as FieldCriteria;
    if (fieldCondition.hasEnergy) {
        let creatureInstanceId = '';
        
        if (context.type === 'ability') {
            creatureInstanceId = context.creatureInstanceId;
        } else if (context.type === 'attack') {
            creatureInstanceId = context.attackerInstanceId;
        }
        
        if (!creatureInstanceId) {
            return false; 
        }
        
        // Get the energy type and required count
        const energyType = Object.keys(fieldCondition.hasEnergy)[0] as AttachableEnergyType;
        const requiredCount = fieldCondition.hasEnergy[energyType] || 1; // Default to 1 if undefined
        // TODO rather than a single energy type support comparing each
        
        // Check if the creature has enough energy of the specified type
        const energyCount = controllers.energy.countEnergyTypeByInstance(
            creatureInstanceId, 
            energyType,
        );
        
        return energyCount >= requiredCount;
    } else if (fieldCondition.hasDamage) {
        // For attack context, check if the attacker has damage
        if (context.type === 'attack') {
            // Get the active creature for the source player (attacker)
            const activecreature = controllers.field.getCardByPosition(context.sourcePlayer, 0);
            if (!activecreature) {
                return false; 
            }
            
            // Check if the creature has any damage
            return activecreature.damageTaken > 0;
        } else if (context.type === 'ability') {
            // TODO: We should pass the creature with the ability in the context from upstream
            return false;
        }
    }
    return false;
}
