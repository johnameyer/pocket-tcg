import { Effect } from '../repository/effect-types.js';
import { EffectValue } from '../repository/effect-value-types.js';
import { Target, FixedTarget } from '../repository/target-types.js';
import { Condition } from '../repository/condition-types.js';
import { EffectContext } from './effect-context.js';
import { Controllers } from '../controllers/controllers.js';
import { TargetResolver } from './target-resolver.js';
import { AttachableEnergyType } from '../repository/energy-types.js';

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
    fieldIndex: number
) {
    return controllers.field.getCardByPosition(playerId, fieldIndex);
}

/**
 * Gets the resolved target player from context.
 * If targetPlayerId is defined in the context, returns that value.
 * Otherwise, returns the source player as a default.
 */
export function getResolvedTargetPlayer(context: EffectContext): number {
    // For effects that explicitly require a target but don't have it, throw an error
    // We only check this for contexts that should have a target but don't
    if ('requiresTarget' in context && context.requiresTarget === true && 
        !('targetPlayerId' in context || context.targetPlayerId === undefined)) {
        // For attack contexts, default to opponent's active
        if (context.type === 'attack') {
            return (context.sourcePlayer + 1) % 2; // Opponent player ID
        }
        
        throw new Error(`Missing targetPlayerId in context for ${context.effectName}`);
    }
    
    return context.targetPlayerId !== undefined ? 
        context.targetPlayerId : context.sourcePlayer;
}

/**
 * Gets the resolved target creature index from context.
 * If targetCreatureIndex is defined in the context, returns that value.
 * Otherwise, returns 0 (active creature) as a default.
 */
export function getResolvedTargetCreatureIndex(context: EffectContext): number {
    // For effects that explicitly require a target but don't have it, throw an error
    // We only check this for contexts that should have a target but don't
    if ('requiresTarget' in context && context.requiresTarget === true && 
        !('targetCreatureIndex' in context || context.targetCreatureIndex === undefined)) {
        // For attack contexts, default to opponent's active (index 0)
        if (context.type === 'attack') {
            return 0; // Active creature
        }
        
        throw new Error(`Missing targetCreatureIndex in context for ${context.effectName}`);
    }
    
    return context.targetCreatureIndex !== undefined ? 
        context.targetCreatureIndex : 0;
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
    } else if (effectValue.type === 'resolved') {
        const resolvedTargetPlayer = getResolvedTargetPlayer(context);
        
        switch (effectValue.source) {
            case 'creature-count': {
                // Count Creatures on field for the resolved target player
                let count = 0;
                let fieldIndex = 0;
                while (true) {
                    const creature = controllers.field.getCardByPosition(resolvedTargetPlayer, fieldIndex);
                    if (!creature) break;
                    count++;
                    fieldIndex++;
                }
                return count;
            }
            case 'benched-creature-count': {
                // Count only benched Creatures (excluding active) for the resolved target player
                let count = 0;
                let fieldIndex = 1; // Start from index 1 to skip active creature
                while (true) {
                    const creature = controllers.field.getCardByPosition(resolvedTargetPlayer, fieldIndex);
                    if (!creature) break;
                    count++;
                    fieldIndex++;
                }
                return count;
            }
            case 'energy-count': {
                // Count total energy attached to all creatures for the resolved target player
                let totalEnergy = 0;
                let fieldIndex = 0;
                while (true) {
                    // Get fieldInstanceId for energy lookup
                    const fieldInstanceId = controllers.field.getFieldInstanceId(resolvedTargetPlayer, fieldIndex);
                    if (!fieldInstanceId) break;
                    const energyState = controllers.energy.getAttachedEnergyByInstance(fieldInstanceId);
                    if (energyState) {
                        totalEnergy += Object.values(energyState).reduce((sum: number, count: number) => sum + count, 0);
                    }
                    fieldIndex++;
                }
                return totalEnergy;
            }
            case 'damage-taken': {
                // Get damage taken by the target creature (active creature)
                const targetCreature = getCreatureFromTarget(controllers, resolvedTargetPlayer, 0);
                return targetCreature ? targetCreature.damageTaken : 0;
            }
            case 'cards-in-hand': {
                const handSize = controllers.hand.getHandSize(resolvedTargetPlayer);
                return handSize !== null && handSize !== undefined ? handSize : 0;
            }
            default:
                return 0;
        }
    } else if (effectValue.type === 'player-context-resolved') {
        // Determine player ID based on playerContext
        const playerIdToUse = effectValue.playerContext === 'self' ? 
            context.sourcePlayer : 
            (context.sourcePlayer + 1) % controllers.players.count;
        
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
        return conditionMet ? 
            getEffectValue(effectValue.trueValue, controllers, context) : 
            getEffectValue(effectValue.falseValue, controllers, context);
    }
    
    return 0;
}

// TODO: Consider unifying this with ConditionEvaluator class to eliminate duplication
export function evaluateConditionWithContext(condition: Condition, controllers: Controllers, context: EffectContext): boolean {
    if (condition.hasEnergy) {
        let creatureInstanceId = '';
        
        if (context.type === 'ability') {
            creatureInstanceId = context.creatureInstanceId;
        } else if (context.type === 'attack') {
            creatureInstanceId = context.attackerInstanceId;
        }
        
        if (!creatureInstanceId) return false;
        
        // Get the energy type and required count
        const energyType = Object.keys(condition.hasEnergy)[0] as AttachableEnergyType;
        const requiredCount = condition.hasEnergy[energyType] || 1; // Default to 1 if undefined
        // TODO rather than a single energy type support comparing each
        
        // Check if the creature has enough energy of the specified type
        const energyCount = controllers.energy.countEnergyTypeByInstance(
            creatureInstanceId, 
            energyType
        );
        
        return energyCount >= requiredCount;
    } else if (condition.hasDamage) {
        // For attack context, check if the attacker has damage
        if (context.type === 'attack') {
            // Get the active creature for the source player (attacker)
            const activecreature = controllers.field.getCardByPosition(context.sourcePlayer, 0);
            if (!activecreature) return false;
            
            // Check if the creature has any damage
            return activecreature.damageTaken > 0;
        } else if (context.type === 'ability') {
            // TODO: We should pass the creature with the ability in the context from upstream
            return false;
        }
    }
    return false;
}
