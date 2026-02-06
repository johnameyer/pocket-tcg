import { Controllers } from '../controllers/controllers.js';
import { PassiveEffect } from '../controllers/effect-controller.js';
import { RetreatPreventionEffect, PreventDamageEffect } from '../repository/effect-types.js';
import { ControllerUtils } from '../utils/controller-utils.js';
import { FieldTargetCriteriaFilter } from './filters/field-target-criteria-filter.js';

/**
 * Utility class for finding and filtering applicable passive effects.
 * Centralizes the logic for checking if passive effects apply to specific targets.
 */
export class PassiveEffectMatcher {
    /**
     * Check if a retreat-prevention effect applies to a specific player and field position.
     * 
     * @param effect The passive effect to check
     * @param playerId The player ID to check
     * @param fieldIndex The field position to check (0 = active, 1+ = bench)
     * @returns True if the effect prevents retreat for the specified target
     */
    static isRetreatPreventedFor(
        effect: PassiveEffect,
        playerId: number,
        fieldIndex: number,
    ): boolean {
        // Check if this is a retreat-prevention effect
        if (effect.effect.type !== 'retreat-prevention') {
            return false;
        }
        
        const retreatEffect = effect.effect as RetreatPreventionEffect;
        
        // Check if this effect applies to the specified creature
        if (retreatEffect.target.type === 'resolved') {
            for (const target of retreatEffect.target.targets) {
                if (target.playerId === playerId && target.fieldIndex === fieldIndex) {
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * Check if a damage-prevention effect applies to a specific attacker.
     * 
     * @param controllers Game controllers for accessing card repository and field state
     * @param effect The passive effect to check
     * @param attackerTemplateId The template ID of the attacking creature
     * @param attackerPlayerId The player ID of the attacking creature
     * @param attackerFieldIndex The field position of the attacking creature
     * @returns True if the effect prevents damage from the specified attacker
     */
    static isDamagePreventedFrom(
        controllers: Controllers,
        effect: PassiveEffect,
        attackerTemplateId: string,
        attackerPlayerId: number,
        attackerFieldIndex: number,
    ): boolean {
        // Check if this is a prevent-damage effect
        if (effect.effect.type !== 'prevent-damage') {
            return false;
        }
        
        const prevention = effect.effect as PreventDamageEffect;
        
        // Use FieldTargetCriteriaFilter to check if attacker matches criteria
        const attackerCard = controllers.field.getRawCardByPosition(attackerPlayerId, attackerFieldIndex);
        if (!attackerCard) {
            return false;
        }
        
        // Create a handler data view for the attacker's side
        const handlerData = ControllerUtils.createPlayerView(controllers, attackerPlayerId);
        
        // Check if the attacker matches the damageSource criteria
        const matchesCriteria = FieldTargetCriteriaFilter.matchesFieldCriteria(
            prevention.damageSource.fieldCriteria || {},
            attackerCard,
            controllers.cardRepository.cardRepository,
            handlerData.energy?.attachedEnergyByInstance,
        );
        
        if (!matchesCriteria) {
            return false;
        }
        
        // Also check player criteria if specified
        if (prevention.damageSource.player) {
            /*
             * The prevention effect's 'opponent' player refers to the player attacking the defended creature
             * Since the effect is registered by the defending player, we just need to accept all attackers
             */
            return true;
        }
        
        return true;
    }

    /**
     * Get all retreat-prevention effects that apply to a specific player and field position.
     * 
     * @param controllers Game controllers
     * @param playerId The player ID to check
     * @param fieldIndex The field position to check (0 = active, 1+ = bench)
     * @returns Array of applicable retreat-prevention effects
     */
    static getApplicableRetreatPreventions(
        controllers: Controllers,
        playerId: number,
        fieldIndex: number,
    ): PassiveEffect[] {
        const allEffects = controllers.effects.getPassiveEffectsByType('retreat-prevention');
        return allEffects.filter(effect => this.isRetreatPreventedFor(effect, playerId, fieldIndex),
        );
    }

    /**
     * Get all damage-prevention effects that apply to a specific attacker.
     * 
     * @param controllers Game controllers
     * @param attackerTemplateId The template ID of the attacking creature
     * @param attackerPlayerId The player ID of the attacking creature
     * @param attackerFieldIndex The field position of the attacking creature
     * @returns Array of applicable damage-prevention effects
     */
    static getApplicableDamagePreventions(
        controllers: Controllers,
        attackerTemplateId: string,
        attackerPlayerId: number,
        attackerFieldIndex: number,
    ): PassiveEffect[] {
        const allEffects = controllers.effects.getPassiveEffectsByType('prevent-damage');
        return allEffects.filter(effect => this.isDamagePreventedFrom(
            controllers,
            effect,
            attackerTemplateId,
            attackerPlayerId,
            attackerFieldIndex,
        ),
        );
    }

    /**
     * Calculate the effective retreat cost for a creature, considering all retreat cost modifiers.
     * 
     * @param controllers Game controllers
     * @param playerId The player ID of the creature
     * @param fieldIndex The field position of the creature (0 = active, 1+ = bench)
     * @param baseRetreatCost The base retreat cost from the creature card
     * @returns The effective retreat cost after applying all modifiers
     */
    static calculateEffectiveRetreatCost(
        controllers: Controllers,
        playerId: number,
        fieldIndex: number,
        baseRetreatCost: number,
    ): number {
        let effectiveRetreatCost = baseRetreatCost;
        
        const creature = controllers.field.getRawCardByPosition(playerId, fieldIndex);
        if (!creature) {
            return effectiveRetreatCost;
        }
        
        // Create a handler data view for criteria matching
        const handlerData = ControllerUtils.createPlayerView(controllers, playerId);
        
        // Apply retreat cost modification effects
        const modificationEffects = controllers.effects.getPassiveEffectsByType('retreat-cost-modification');
        for (const passiveEffect of modificationEffects) {
            const effect = passiveEffect.effect;
            // Check if this effect applies to the creature
            const matchesCriteria = FieldTargetCriteriaFilter.matchesFieldCriteria(
                effect.target.fieldCriteria || {},
                creature,
                controllers.cardRepository.cardRepository,
                handlerData.energy?.attachedEnergyByInstance,
            );
            
            if (matchesCriteria) {
                const amount = typeof effect.amount === 'object' && 'value' in effect.amount ? effect.amount.value : 0;
                if (effect.operation === 'decrease') {
                    effectiveRetreatCost -= amount;
                } else {
                    effectiveRetreatCost += amount;
                }
            }
        }
        
        // Retreat cost cannot be negative
        return Math.max(0, effectiveRetreatCost);
    }

    /**
     * Check if a player is prevented from attaching energy.
     * 
     * @param controllers Game controllers
     * @param playerId The player ID to check
     * @returns True if the player is prevented from attaching energy
     */
    static isEnergyAttachmentPrevented(
        controllers: Controllers,
        playerId: number,
    ): boolean {
        const preventEffects = controllers.effects.getPassiveEffectsByType('prevent-energy-attachment');
        for (const passiveEffect of preventEffects) {
            const effect = passiveEffect.effect;
            // Check if this effect targets the player
            const targetPlayer = effect.target === 'self' ? passiveEffect.sourcePlayer : 
                               effect.target === 'opponent' ? (passiveEffect.sourcePlayer + 1) % controllers.players.count : 
                               -1; // 'both' case
            
            if (targetPlayer === playerId || effect.target === 'both') {
                return true;
            }
        }
        return false;
    }

    /**
     * Check if a creature is prevented from attacking.
     * 
     * @param controllers Game controllers
     * @param playerId The player ID of the creature
     * @param fieldIndex The field position of the creature
     * @returns True if the creature is prevented from attacking
     */
    static isAttackPrevented(
        controllers: Controllers,
        playerId: number,
        fieldIndex: number,
    ): boolean {
        const preventEffects = controllers.effects.getPassiveEffectsByType('prevent-attack');
        
        const creature = controllers.field.getRawCardByPosition(playerId, fieldIndex);
        if (!creature) {
            return false;
        }
        
        // Create a handler data view for criteria matching
        const handlerData = ControllerUtils.createPlayerView(controllers, playerId);
        
        for (const passiveEffect of preventEffects) {
            const effect = passiveEffect.effect;
            // Check if this effect applies to the creature
            const matchesCriteria = FieldTargetCriteriaFilter.matchesFieldCriteria(
                effect.target.fieldCriteria || {},
                creature,
                controllers.cardRepository.cardRepository,
                handlerData.energy?.attachedEnergyByInstance,
            );
            
            if (matchesCriteria) {
                // Also check player and position criteria
                if (effect.target.player) {
                    const targetPlayer = effect.target.player === 'self' ? passiveEffect.sourcePlayer : 
                                       (passiveEffect.sourcePlayer + 1) % controllers.players.count;
                    if (targetPlayer !== playerId) {
                        continue;
                    }
                }
                
                if (effect.target.position) {
                    const isActive = fieldIndex === 0;
                    if (effect.target.position === 'active' && !isActive) {
                        continue;
                    }
                    if (effect.target.position === 'bench' && isActive) {
                        continue;
                    }
                }
                
                return true;
            }
        }
        return false;
    }
}
