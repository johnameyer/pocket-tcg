import { Controllers } from '../controllers/controllers.js';
import { CardRepository } from '../repository/card-repository.js';
import { EffectContext, EffectContextFactory } from './effect-context.js';
import { getEffectValue, evaluateConditionWithContext } from './effect-utils.js';
import { CreatureAttack } from '../repository/card-types.js';
import { Target } from '../repository/target-types.js';
import { Condition } from '../repository/condition-types.js';
import { FieldCard } from '../controllers/field-controller.js';

/**
 * Utility class for resolving attack damage based on various damage calculation types.
 * This centralizes the attack damage resolution logic that was previously in the event handler.
 */
export class AttackDamageResolver {
    /**
     * Resolves the damage for an attack based on its damage calculation type.
     * 
     * @param controllers Game controllers
     * @param currentPlayer Current player ID
     * @param attackIndex Index of the attack being used
     * @param playercreature The creature using the attack
     * @returns The resolved damage amount or undefined if no damage calculation is needed
     */
    static resolveDamage(
        controllers: Controllers,
        currentPlayer: number,
        attackIndex: number,
        playercreatureInstanceId: string
    ): number | undefined {
        // TODO: Do we not have a method on the field controller to find by instance id? Can we add one? Or should we change how this is defined to be by player id / bench index
        // Find the creature by instance ID - check active and bench
        let playercreature = controllers.field.getCardByPosition(currentPlayer, 0);
        
        // If not the active creature, check the bench
        if (playercreature?.instanceId !== playercreatureInstanceId) {
            const benchedcreature = controllers.field.getCards(currentPlayer);
            const benchedMatch = benchedcreature.find(p => p?.instanceId === playercreatureInstanceId);
            
            // If found on bench, use that creature
            if (benchedMatch) {
                playercreature = benchedMatch;
            }
        }
        
        // If creature not found at all, return undefined
        if (!playercreature) return undefined;
        
        const creatureData = controllers.cardRepository.getCreature(playercreature.templateId);
        if (!creatureData || !creatureData.attacks || attackIndex >= creatureData.attacks.length) {
            return undefined;
        }
        
        const attack = creatureData.attacks[attackIndex];
        
        // Create context for damage calculation and boost validation
        const context = EffectContextFactory.createAttackContext(
            currentPlayer,
            `${creatureData.name}'s ${attack.name}`,
            playercreature.instanceId
        );
        
        // Calculate base damage
        let baseDamage: number;
        if (typeof attack.damage === 'number' || attack.damage === undefined) {
            baseDamage = attack.damage || 0;
        } else {
            baseDamage = this.resolveDynamicDamage(attack, controllers, context);
        }
        
        // Damage boosts removed
        
        let totalDamage = baseDamage;
        
        // Apply weakness bonus (+20 damage if target is weak to attacker's type)
        const targetId = (currentPlayer + 1) % controllers.players.count;
        const targetcreature = controllers.field.getCardByPosition(targetId, 0);
        if (targetcreature && totalDamage > 0) {
            const attackerData = controllers.cardRepository.getCreature(playercreature.templateId);
            const targetData = controllers.cardRepository.getCreature(targetcreature.templateId);
            if (targetData.weakness === attackerData.type) {
                totalDamage += 20; // +20 weakness damage
            }
        }
        
        // Apply damage reductions removed
        
        return totalDamage;
    }
    
    /**
     * Resolves dynamic damage based on the attack's damage calculation type.
     * 
     * @param attack The attack with dynamic damage
     * @param context Effect context for the attack
     * @returns The resolved damage amount
     */
    static resolveDynamicDamage(attack: CreatureAttack, controllers: Controllers, context: EffectContext): number {
        if (typeof attack.damage === 'number' || attack.damage === undefined) {
            return attack.damage || 0;
        }
        
        // TODO can we swap this all for getEffectValue(attack.damage)?
        // Handle different damage calculation types
        if (attack.damage.type === 'multiplication') {
            const subValue = getEffectValue(attack.damage.base, controllers, context);
            const multiplierValue = getEffectValue(attack.damage.multiplier, controllers, context);
            return multiplierValue * subValue;
        } else if (attack.damage.type === 'coin-flip') {
            // Handle coin flip damage
            const isHeads = controllers.coinFlip.performCoinFlip();
            return isHeads ? attack.damage.headsValue : attack.damage.tailsValue;
        } else if (attack.damage.type === 'addition') {
            // Handle addition damage (like Poipole's 2-Step)
            return attack.damage.values.reduce((sum: number, value) => 
                sum + getEffectValue(value, controllers, context), 0);
        } else if (attack.damage.type === 'conditional') {
            // Handle conditional damage
            const conditionMet = evaluateConditionWithContext(attack.damage.condition, controllers, context);
            return conditionMet ? 
                getEffectValue(attack.damage.trueValue, controllers, context) : 0;
        } else if (attack.damage.type === 'constant') {
            // Handle constant damage
            return attack.damage.value;
        }
        
        return 0;
    }
    
    // Damage boost validation removed
}
