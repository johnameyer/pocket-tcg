import { Serializable } from "@cards-ts/core";

export interface Card {
    // TODO why is this needed
    [index: string]: Serializable;
    id: string; // Unique instance ID for this specific card copy
    type: 'creature' | 'supporter' | 'item' | 'tool';
    cardId: string; // Card template ID for the card
}

export interface CreatureCard extends Card {
    type: 'creature';
    cardId: string;
}

export interface SupporterCard extends Card {
    type: 'supporter';
    cardId: string;
}

export interface ItemCard extends Card {
    type: 'item';
    cardId: string;
}

export interface ToolCard extends Card {
    type: 'tool';
    cardId: string;
}

export type GameCard = CreatureCard | SupporterCard | ItemCard | ToolCard;
