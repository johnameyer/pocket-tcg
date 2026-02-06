import { Controllers } from '../controllers/controllers.js';
import { CreatureAttack } from '../repository/card-types.js';
import { FieldCard } from '../controllers/field-controller.js';
import { DamageBoostEffect } from '../repository/effect-types.js';
import { EffectContext, EffectContextFactory } from './effect-context.js';
import { getEffectValue } from './effect-utils.js';
import { FieldTargetCriteriaFilter } from './filters/field-target-criteria-filter.js';
import { PassiveEffectMatcher } from './passive-effect-matcher.js';

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
        playercreatureInstanceId: string,
    ): number | undefined {
        /*
         * TODO: Do we not have a method on the field controller to find by instance id? Can we add one? Or should we change how this is defined to be by player id / bench index
         * Find the creature by instance ID - check active and bench
         */
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
        if (!playercreature) {
            return undefined; 
        }
        
        const creatureData = controllers.cardRepository.getCreature(playercreature.templateId);
        if (!creatureData || !creatureData.attacks || attackIndex >= creatureData.attacks.length) {
            return undefined;
        }
        
        const attack = creatureData.attacks[attackIndex];
        
        // Create context for damage calculation and boost validation
        const context = EffectContextFactory.createAttackContext(
            currentPlayer,
            `${creatureData.name}'s ${attack.name}`,
            playercreature.instanceId,
        );
        
        // Calculate base damage
        let baseDamage: number;
        if (typeof attack.damage === 'number' || attack.damage === undefined) {
            baseDamage = attack.damage || 0;
        } else {
            baseDamage = this.resolveDynamicDamage(attack, controllers, context);
        }
        
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
        
        // Apply damage boosts from passive effects (with condition checking)
        const damageBoostEffects = controllers.effects.getPassiveEffectsByType('damage-boost');
        for (const passiveEffect of damageBoostEffects) {
            const boost = passiveEffect.effect;
            // Check if this boost should apply to the current target using its damageSource criteria
            if (this.shouldApplyDamageBoost(boost, targetcreature, controllers)) {
                const amount = typeof boost.amount === 'object' && 'value' in boost.amount ? boost.amount.value : 0;
                totalDamage += amount;
            }
        }
        
        // Apply damage boosts from attack effects (with condition checking)
        if (attack.effects) {
            for (const effect of attack.effects) {
                if (effect.type === 'damage-boost') {
                    const boostAmount = getEffectValue(effect.amount, controllers, context);
                    totalDamage += boostAmount;
                }
            }
        }
        
        /*
         * Apply damage reductions from passive effects
         * Only apply reductions belonging to the DEFENDING player (opponent of currentPlayer)
         */
        const defendingPlayer = 1 - currentPlayer;
        const damageReductionEffects = controllers.effects.getPassiveEffectsByType('damage-reduction');
        for (const passiveEffect of damageReductionEffects) {
            // Only apply reductions from the defending player
            if (passiveEffect.sourcePlayer !== defendingPlayer) {
                continue;
            }
            
            const reduction = passiveEffect.effect;
            /*
             * Create minimal context for effect value resolution
             * We use the passive effect's stored context information
             */
            const reductionContext = EffectContextFactory.createAbilityContext(
                passiveEffect.sourcePlayer,
                passiveEffect.effectName,
                '', // creatureInstanceId - not needed for point-based values
                0, // fieldPosition - not needed for point-based values
            );
            const amount = getEffectValue(reduction.amount, controllers, reductionContext);
            totalDamage = Math.max(0, totalDamage - amount);
        }
        
        // Check for damage prevention from passive effects
        if (playercreature) {
            // The attacker is always the active creature (position 0)
            const applicablePreventions = PassiveEffectMatcher.getApplicableDamagePreventions(
                controllers,
                playercreature.templateId,
                currentPlayer,
                0, // Active creature is always at position 0
            );
            if (applicablePreventions.length > 0) {
                totalDamage = 0;
            }
        }
        
        // Ensure damage is not negative
        totalDamage = Math.max(0, totalDamage);
        
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
        
        /*
         * TODO can we swap this all for getEffectValue(attack.damage)?
         * Handle different damage calculation types
         */
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
            return attack.damage.values.reduce((sum: number, value) => sum + getEffectValue(value, controllers, context), 0);
        } else if (attack.damage.type === 'conditional') {
            /*
             * Handle conditional damage
             * Get the attacking creature (from source player, active position)
             */
            const attackingCreature = controllers.field.getRawCardByPosition(
                context.sourcePlayer,
                0,
            );
            if (!attackingCreature) {
                return 0;
            }
            
            const attachedEnergy = controllers.energy.getAttachedEnergyByInstance(attackingCreature.instanceId);
            const attachedEnergyMap = { [attackingCreature.instanceId]: attachedEnergy };
            
            const conditionMet = FieldTargetCriteriaFilter.matchesFieldCriteria(
                attack.damage.condition,
                attackingCreature,
                controllers.cardRepository.cardRepository,
                attachedEnergyMap,
            );
            return conditionMet 
                ? getEffectValue(attack.damage.trueValue, controllers, context) : 0;
        } else if (attack.damage.type === 'constant') {
            // Handle constant damage
            return attack.damage.value;
        }
        
        return 0;
    }
    
    /**
     * Check if a damage boost should apply to the current target.
     */
    private static shouldApplyDamageBoost(
        boost: DamageBoostEffect,
        targetcreature: FieldCard | undefined,
        controllers: Controllers,
    ): boolean {
        if (!targetcreature) {
            return false; 
        }
        
        /*
         * Use proper criteria-based evaluation instead of string matching
         * damageSource has both targeting info and fieldCriteria
         */
        const fieldCriteria = boost.damageSource.fieldCriteria;
        if (!fieldCriteria) {
            // No criteria means it applies to all targets
            return true;
        }
        
        return FieldTargetCriteriaFilter.matchesFieldCriteria(
            fieldCriteria,
            targetcreature,
            controllers.cardRepository.cardRepository,
        );
    }
    
    /**
     * Check if damage should be prevented based on the source creature.
     */
    private static shouldPreventDamage(
        prevention: { sourcePlayer: number; effectName: string },
        sourcecreature: FieldCard | undefined,
        controllers: Controllers,
        context: EffectContext,
    ): boolean {
        if (!sourcecreature) {
            return false; 
        }
        
        /*
         * Find the original effect that created this prevention to check its source restrictions
         * For now, we'll use a simple heuristic based on the effect name
         */
        const sourceData = controllers.cardRepository.getCreature(sourcecreature.templateId);
        
        // Check if this prevention only applies to ex sources
        if (prevention.effectName.includes('Prevent Ex')) {
            // Only prevent damage from ex creatures
            return sourceData.attributes?.ex === true;
        }
        
        // Default: prevent all damage (no source restrictions)
        return true;
    }
    
}
