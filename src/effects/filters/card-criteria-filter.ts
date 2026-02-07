import { CardCriteria, CreatureCardCriteria } from '../../repository/criteria/card-criteria.js';
import { CardRepository } from '../../repository/card-repository.js';
import { GameCard } from '../../controllers/card-types.js';
import { CreatureData } from '../../repository/card-types.js';

/**
 * Filters cards based on criteria to enable pre-filtering before user selection.
 * This allows getting all cards from a location, then filtering by criteria,
 * then requiring selection if multiple options remain.
 * 
 * @example
 * // Get all hand cards, then filter by criteria
 * const allCards = CardTargetResolver.getCardsAtLocation(0, 'hand', controllers);
 * const filtered = CardCriteriaFilter.filter(allCards, criteria, cardRepository);
 * // Then return requires-selection with filtered cards
 */
export class CardCriteriaFilter {
    /**
     * Filters an array of cards based on the provided criteria.
     * 
     * @param cards The cards to filter
     * @param criteria The criteria to match against (optional)
     * @param cardRepository Card repository for looking up card details
     * @returns Array of cards matching the criteria
     */
    static filter(
        cards: GameCard[],
        criteria: CardCriteria | undefined,
        cardRepository: CardRepository,
    ): GameCard[] {
        if (!criteria || cards.length === 0) {
            return cards;
        }

        return cards.filter(card => this.matchesCriteria(card, criteria, cardRepository));
    }

    /**
     * Checks if a single card matches the given criteria.
     * 
     * @param card The card to check
     * @param criteria The criteria to match against
     * @param cardRepository Card repository for looking up card details
     * @returns True if the card matches, false otherwise
     */
    private static matchesCriteria(
        card: GameCard,
        criteria: CardCriteria,
        cardRepository: CardRepository,
    ): boolean {
        // Handle specific card type criteria
        if ('cardType' in criteria) {
            // For trainer cards, check if it's item or supporter
            if (criteria.cardType === 'trainer') {
                return card.type === 'item' || card.type === 'supporter';
            }

            // For specific card types, check exact match
            return card.type === criteria.cardType;
        }

        // Handle creature criteria
        if ('isType' in criteria || 'stage' in criteria || 'previousStageName' in criteria || 'attributes' in criteria) {
            return this.matchesCreatureCriteria(card, criteria, cardRepository);
        }

        // Handle name criteria
        if ('name' in criteria && criteria.name && criteria.name.length > 0) {
            try {
                const cardData = cardRepository.getCard(card.templateId);
                return 'name' in cardData && criteria.name.includes(cardData.name as string);
            } catch {
                return false;
            }
        }

        return true; // No criteria to match means all cards pass
    }

    /**
     * Public method for evaluating creature-specific criteria against a field creature.
     * Used by FieldTargetCriteriaFilter and other handlers.
     * 
     * @param criteria The creature criteria to evaluate
     * @param fieldCard The field creature to check
     * @param cardRepository Card repository
     * @returns True if the creature matches criteria
     */
    static evaluateCardCriteria(
        criteria: CreatureCardCriteria,
        fieldCard: { templateId: string },
        cardRepository: CardRepository,
    ): boolean {
        try {
            const creatureData = cardRepository.getCreature(fieldCard.templateId);

            // Check stage condition
            if (criteria.stage !== undefined) {
                const actualStage = this.calculateStage(creatureData, cardRepository);
                if (criteria.stage !== actualStage) {
                    return false;
                }
            }

            // Check isType condition
            if (criteria.isType !== undefined) {
                if (creatureData.type !== criteria.isType) {
                    return false;
                }
            }

            // Check attributes condition
            if (criteria.attributes !== undefined) {
                if (criteria.attributes.ex !== undefined) {
                    const isEx = creatureData.attributes?.ex || false;
                    if (criteria.attributes.ex !== isEx) {
                        return false;
                    }
                }

                if (criteria.attributes.mega !== undefined) {
                    const isMega = creatureData.attributes?.mega || false;
                    if (criteria.attributes.mega !== isMega) {
                        return false;
                    }
                }

                if (criteria.attributes.ultraBeast !== undefined) {
                    const isUltraBeast = creatureData.attributes?.ultraBeast || false;
                    if (criteria.attributes.ultraBeast !== isUltraBeast) {
                        return false;
                    }
                }
            }

            // Check previousStageName condition
            if (criteria.previousStageName !== undefined) {
                if (!creatureData.previousStageName || creatureData.previousStageName.toLowerCase() !== criteria.previousStageName.toLowerCase()) {
                    return false;
                }
            }

            return true;
        } catch {
            return false;
        }
    }

    /**
     * Checks if a card matches creature-specific criteria.
     * 
     * @param card The card to check
     * @param criteria The creature criteria
     * @param cardRepository Card repository
     * @returns True if the card matches creature criteria
     */
    private static matchesCreatureCriteria(
        card: GameCard,
        criteria: CreatureCardCriteria,
        cardRepository: CardRepository,
    ): boolean {
        // Only creature cards can match creature criteria
        if (card.type !== 'creature') {
            return false;
        }

        return this.evaluateCardCriteria(criteria, card, cardRepository);
    }

    /**
     * Calculate the stage of a creature based on its evolution chain.
     * Stage 0 = Basic (no previousStageName)
     * Stage 1 = Evolves from Basic
     * Stage 2 = Evolves from Stage 1
     */
    private static calculateStage(cardData: CreatureData, cardRepository: CardRepository): number {
        if (!cardData.previousStageName) {
            return 0; // Basic creature
        }

        try {
            const prevStageData = cardRepository.getCreatureByName(cardData.previousStageName);
            if (!prevStageData.previousStageName) {
                return 1; // Stage 1 (evolves from Basic)
            }
            return 2; // Stage 2 (evolves from Stage 1)
        } catch (error) {
            return 0; // Default to Basic if can't resolve evolution chain
        }
    }
}
