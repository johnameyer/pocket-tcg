import { FieldTargetCriteria } from '../../repository/targets/field-target.js';
import { CardRepository } from '../../repository/card-repository.js';
import { HandlerData } from '../../game-handler.js';
import { FieldCard } from '../../controllers/field-controller.js';
import { getFieldInstanceId } from '../../utils/field-card-utils.js';
import { AttachableEnergyType } from '../../repository/energy-types.js';
import { FieldCriteria } from '../../repository/criteria/field-target-criteria.js';
import { CardCriteriaFilter } from './card-criteria-filter.js';

/**
 * Filters field cards (creatures) based on targeting criteria.
 * Enables pre-filtering of all creatures before user selection.
 * 
 * This separates the filtering logic from the targeting logic, allowing:
 * 1. Get all creatures from field
 * 2. Filter by criteria (position, type, condition)
 * 3. Show filtered options to user for selection
 * 
 * @example
 * // Get all field creatures, then filter by criteria
 * const allCreatures = controllers.field.getCards(playerId);
 * const filtered = FieldTargetCriteriaFilter.filter(
 *   allCreatures, 
 *   criteria, 
 *   handlerData, 
 *   cardRepository,
 *   playerId
 * );
 * // Then return requires-selection with filtered creatures
 */
export class FieldTargetCriteriaFilter {
    /**
     * Filters an array of field cards based on the provided criteria.
     * 
     * @param cards The field cards to filter
     * @param criteria The criteria to match against (optional)
     * @param handlerData Handler data for context
     * @param cardRepository Card repository for looking up card details
     * @param playerId The player ID for context (for evaluating conditions)
     * @returns Array of field cards matching the criteria
     */
    static filter(
        cards: (FieldCard | undefined)[],
        criteria: FieldTargetCriteria | undefined,
        handlerData: HandlerData,
        cardRepository: CardRepository,
        playerId: number,
    ): Array<{ card: FieldCard; fieldIndex: number }> {
        const result: Array<{ card: FieldCard; fieldIndex: number }> = [];

        for (let fieldIndex = 0; fieldIndex < cards.length; fieldIndex++) {
            const card = cards[fieldIndex];
            if (!card) {
                continue;
            }

            if (!criteria || this.matchesCriteria(card, criteria, handlerData, cardRepository, fieldIndex)) {
                result.push({ card, fieldIndex });
            }
        }

        return result;
    }

    /**
     * Checks if a single field card matches the given criteria.
     * 
     * @param card The field card to check
     * @param criteria The criteria to match against
     * @param handlerData Handler data for context
     * @param cardRepository Card repository
     * @param fieldIndex The field position (0 = active, 1+ = bench)
     * @returns True if the card matches, false otherwise
     */
    private static matchesCriteria(
        card: FieldCard,
        criteria: FieldTargetCriteria,
        handlerData: HandlerData,
        cardRepository: CardRepository,
        fieldIndex: number,
    ): boolean {
        // Check position criteria
        if (criteria.position === 'active' && fieldIndex !== 0) {
            return false;
        }
        if (criteria.position === 'bench' && fieldIndex === 0) {
            return false;
        }

        // Check field criteria (card properties and field state)
        if (criteria.fieldCriteria) {
            if (!this.evaluateFieldCriteria(
                criteria.fieldCriteria,
                card,
                cardRepository,
                handlerData.energy?.attachedEnergyByInstance,
            )) {
                return false;
            }
        }

        return true;
    }

    /**
     * Evaluates a FieldCriteria against a creature, checking both card-level
     * properties (stage, type, attributes) and field-specific state (hasDamage, hasEnergy).
     * Public method for external use in handlers.
     * 
     * @param criteria The field criteria to evaluate
     * @param card The creature to check
     * @param cardRepository Card repository for metadata lookup
     * @param attachedEnergy Optional map of energy by instance ID
     * @returns True if the creature matches the criteria, false otherwise
     */
    static matchesFieldCriteria(
        criteria: FieldCriteria,
        card: FieldCard,
        cardRepository: CardRepository,
        attachedEnergy?: { [instanceId: string]: Record<AttachableEnergyType, number> },
    ): boolean {
        return this.evaluateFieldCriteria(criteria, card, cardRepository, attachedEnergy);
    }

    /**
     * Evaluates a FieldCriteria against a creature, checking both card-level
     * properties (stage, type, attributes) and field-specific state (hasDamage, hasEnergy).
     * 
     * @param criteria The field criteria to evaluate
     * @param card The creature to check
     * @param cardRepository Card repository for metadata lookup
     * @param attachedEnergy Optional map of energy by instance ID
     * @returns True if the creature matches the criteria, false otherwise
     */
    private static evaluateFieldCriteria(
        criteria: FieldCriteria,
        card: FieldCard,
        cardRepository: CardRepository,
        attachedEnergy?: { [instanceId: string]: Record<AttachableEnergyType, number> },
    ): boolean {
        // Evaluate card criteria if present - delegate to CardCriteriaFilter
        if (criteria.cardCriteria) {
            if (!CardCriteriaFilter.evaluateCardCriteria(criteria.cardCriteria, card, cardRepository)) {
                return false;
            }
        }

        // Check hasDamage condition
        if (criteria.hasDamage === true && card.damageTaken <= 0) {
            return false;
        }

        // Check hasEnergy condition
        if (criteria.hasEnergy !== undefined) {
            if (!attachedEnergy) {
                return false;
            }

            const fieldInstanceId = getFieldInstanceId(card);
            const creatureEnergy = attachedEnergy[fieldInstanceId];
            if (!creatureEnergy) {
                return false;
            }

            // Get the energy type and required count
            const energyType = Object.keys(criteria.hasEnergy)[0] as AttachableEnergyType;
            const requiredCount = criteria.hasEnergy[energyType] || 1;

            if ((creatureEnergy[energyType] || 0) < requiredCount) {
                return false;
            }
        }

        return true;
    }
}
