import { AttachableEnergyType } from '../energy-types.js';


/**
 * Base criteria shared by all card types.
 */
export type BaseCardCriteria = {
    /** Specific card names (exact match) */
    names?: string[];
};

/**
 * Criteria for tool cards.
 */
export type ToolCardCriteria = BaseCardCriteria & {
    cardType: 'tool';
};

/**
 * Criteria for supporter cards.
 */
export type SupporterCardCriteria = BaseCardCriteria & {
    cardType: 'supporter';
};

/**
 * Criteria for item cards.
 */
export type ItemCardCriteria = BaseCardCriteria & {
    cardType: 'item';
};

/**
 * Represents criteria for creature cards (from card definition).
 * Used for filtering creatures by their card properties in any location.
 */
export type CreatureCardCriteria = {
    name?: string[]; 
    stage?: 0 | 1 | 2;
    previousStageName?: string;
    isType?: AttachableEnergyType;
    attributes?: {
        ex?: boolean;
        mega?: boolean;
        ultraBeast?: boolean;
    };
};

/**
 * Criteria for creature cards (by card type).
 * Can optionally include creature-specific property filters.
 */
export type CreatureCardTypeCriteria = BaseCardCriteria & CreatureCardCriteria & {
    cardType: 'creature';
};

/**
 * Criteria for trainer cards (items or supporters).
 */
export type TrainerCardCriteria = BaseCardCriteria & {
    cardType: 'trainer';
};

/**
 * Represents criteria for targeting cards in hand, deck, or discard.
 * Used to filter which cards can be selected.
 */
export type CardCriteria = CreatureCardTypeCriteria | CreatureCardCriteria | ToolCardCriteria | SupporterCardCriteria | ItemCardCriteria | TrainerCardCriteria;
