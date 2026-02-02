import { Controllers } from '../controllers/controllers.js';
import { PassiveEffect } from '../controllers/effect-controller.js';
import { RetreatPreventionEffect, PreventDamageEffect } from '../repository/effect-types.js';

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
     * Supports both exact templateId matching and attribute-based matching (e.g., 'ex' attribute).
     * 
     * @param controllers Game controllers for accessing card repository
     * @param effect The passive effect to check
     * @param attackerTemplateId The template ID of the attacking creature
     * @returns True if the effect prevents damage from the specified attacker
     */
    static isDamagePreventedFrom(
        controllers: Controllers,
        effect: PassiveEffect,
        attackerTemplateId: string,
    ): boolean {
        // Check if this is a prevent-damage effect
        if (effect.effect.type !== 'prevent-damage') {
            return false;
        }
        
        const prevention = effect.effect as PreventDamageEffect;
        
        // If no source filter, the effect applies to all attackers
        if (!prevention.source) {
            return true;
        }

        // Get source creature data to check attributes
        const sourceCreatureData = controllers.cardRepository.getCreature(prevention.source);
        const attackerCreatureData = controllers.cardRepository.getCreature(attackerTemplateId);
        
        // If source has 'ex' attribute, check if attacker also has it
        if (sourceCreatureData.attributes?.ex) {
            return attackerCreatureData.attributes?.ex === true;
        }
        
        // No ex attribute, so match by exact templateId
        return attackerTemplateId === prevention.source;
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
        return allEffects.filter(effect => 
            this.isRetreatPreventedFor(effect, playerId, fieldIndex)
        );
    }

    /**
     * Get all damage-prevention effects that apply to a specific attacker.
     * 
     * @param controllers Game controllers
     * @param attackerTemplateId The template ID of the attacking creature
     * @returns Array of applicable damage-prevention effects
     */
    static getApplicableDamagePreventions(
        controllers: Controllers,
        attackerTemplateId: string,
    ): PassiveEffect[] {
        const allEffects = controllers.effects.getPassiveEffectsByType('prevent-damage');
        return allEffects.filter(effect => 
            this.isDamagePreventedFrom(controllers, effect, attackerTemplateId)
        );
    }
}
