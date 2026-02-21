import { CardRepositoryController } from '../controllers/card-repository-controller.js';
import { GameCard } from '../controllers/card-types.js';

/**
 * Extract the name of a card from the repository
 * @param card The card to get the name for
 * @param cardRepository The card repository controller
 * @returns The card name, or templateId if lookup fails
 */
export function getCardName(card: GameCard, cardRepository: CardRepositoryController): string {
    try {
        switch (card.type) {
            case 'creature':
                return cardRepository.getCreature(card.templateId).name;
            case 'supporter':
                return cardRepository.getSupporter(card.templateId).name;
            case 'item':
                return cardRepository.getItem(card.templateId).name;
            case 'tool':
                return cardRepository.getTool(card.templateId).name;
            case 'stadium':
                return cardRepository.getStadium(card.templateId).name;
        }
    } catch {
        return card.templateId;
    }
}

/**
 * Extract names of multiple cards
 * @param cards The cards to get names for
 * @param cardRepository The card repository controller
 * @returns Array of card names
 */
export function getCardNames(cards: GameCard[], cardRepository: CardRepositoryController): string[] {
    return cards.map(card => getCardName(card, cardRepository));
}
