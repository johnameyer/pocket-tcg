import { CreatureData, SupporterData, ItemData, ToolData, CardData } from "./card-types.js";

export class CardRepository {
    constructor(
        private creatureData: Map<string, CreatureData> = new Map(),
        private supporterData: Map<string, SupporterData> = new Map(),
        private itemData: Map<string, ItemData> = new Map(),
        private toolData: Map<string, ToolData> = new Map()
    ) {
        // No initialization here - data will be provided by the caller
    }

    public getCreature(id: string): CreatureData {
        const creature = this.creatureData.get(id);
        if (!creature) {
            throw new Error(`Creature not found: ${id}`);
        }
        return creature;
    }

    public getAllCreatureIds(): string[] {
        return Array.from(this.creatureData.keys());
    }

    public getSupporter(id: string): SupporterData {
        const supporter = this.supporterData.get(id);
        if (!supporter) {
            throw new Error(`Supporter not found: ${id}`);
        }
        return supporter;
    }

    public getItem(id: string): ItemData {
        const item = this.itemData.get(id);
        if (!item) {
            throw new Error(`Item not found: ${id}`);
        }
        return item;
    }

    public getTool(id: string): ToolData {
        const tool = this.toolData.get(id);
        if (!tool) {
            throw new Error(`Tool not found: ${id}`);
        }
        return tool;
    }

    public getAllSupporterIds(): string[] {
        return Array.from(this.supporterData.keys());
    }

    public getAllItemIds(): string[] {
        return Array.from(this.itemData.keys());
    }

    public getAllToolIds(): string[] {
        return Array.from(this.toolData.keys());
    }

    /**
     * Gets a card by ID, trying all card types.
     *
     * @param id The ID of the card to get
     * @returns The card data and its type
     * @throws Error if the card is not found in any collection
     */
    public getCard(id: string): { data: CardData; type: string; } {
        try {
            return { data: this.getCreature(id), type: 'creature' };
        } catch (e) {
            try {
                return { data: this.getSupporter(id), type: 'supporter' };
            } catch (e) {
                try {
                    return { data: this.getItem(id), type: 'item' };
                } catch (e) {
                    try {
                        return { data: this.getTool(id), type: 'tool' };
                    } catch (e) {
                        throw new Error(`Card not found: ${id}`);
                    }
                }
            }
        }
    }

    /**
     * Determines the evolution stage of a Creature.
     *
     * @param creatureId The ID of the Creature to check
     * @returns 0 for Basic, 1 for Stage 1, 2 for Stage 2, or -1 if not found
     */
    public getEvolutionStage(creatureId: string): number {
        try {
            const creature = this.getCreature(creatureId);

            // Basic creatures have no evolvesFrom property
            if (!creature.evolvesFrom) {
                return 0; // Basic creature
            }

            // Check if the creature it evolves from is also an evolution creature
            try {
                const preCreature = this.getCreature(creature.evolvesFrom);
                if (!preCreature.evolvesFrom) {
                    return 1; // Stage 1 creature (evolves from Basic)
                } else {
                    return 2; // Stage 2 creature (evolves from Stage 1)
                }
            } catch (error) {
                // If we can't find the pre-evolution, assume it's a Stage 1
                return 1;
            }
        } catch (error) {
            return -1; // Creature not found
        }
    }
}
