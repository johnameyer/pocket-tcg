export type Card = {
    instanceId: string; // Unique instance ID for this specific card copy
    type: 'creature' | 'supporter' | 'item' | 'tool';
    templateId: string; // Card template ID for the card
};

export type CreatureCard = Card & {
    type: 'creature';
    templateId: string;
};

export type SupporterCard = Card & {
    type: 'supporter';
    templateId: string;
};

export type ItemCard = Card & {
    type: 'item';
    templateId: string;
};

export type ToolCard = Card & {
    type: 'tool';
    templateId: string;
};

export type GameCard = CreatureCard | SupporterCard | ItemCard | ToolCard;
