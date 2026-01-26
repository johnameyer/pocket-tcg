import { CreatureData, SupporterData, ItemData, ToolData } from './card-types.js';

export class CardRepository {
    private creatureNameMap: Map<string, CreatureData> = new Map();
    
    constructor(
        private creatureData: Map<string, CreatureData> = new Map(),
        private supporterData: Map<string, SupporterData> = new Map(),
        private itemData: Map<string, ItemData> = new Map(),
        private fieldCardToolData: Map<string, ToolData> = new Map()
    ) {
        // Build name-to-creature map at instantiation time for efficient lookups
        for (const creature of creatureData.values()) {
            // Store first occurrence of each name (multiple creatures may share the same name)
            if (!this.creatureNameMap.has(creature.name)) {
                this.creatureNameMap.set(creature.name, creature);
            }
        }
    }

    public getCreature(templateId: string): CreatureData {
        const fieldCard = this.creatureData.get(templateId);
        if (!fieldCard) {
            throw new Error(`FieldCard not found: ${templateId}`);
        }
        return fieldCard;
    }
    
    public getAllCreatureIds(): string[] {
        return Array.from(this.creatureData.keys());
    }
    
    /**
     * Get a creature by its name.
     * This is used for evolution chain validation where evolvesFrom references a creature name.
     * 
     * Note: If multiple creatures share the same name (e.g., different versions with different templateIds),
     * this returns the first match. This is acceptable because creatures with the same name should have
     * compatible evolution chains - the evolvesFrom property references the name, not a specific templateId.
     * 
     * @param name The name of the creature to find
     * @returns The first creature data matching the name
     * @throws Error if no creature with that name is found
     */
    public getCreatureByName(name: string): CreatureData {
        const creature = this.creatureNameMap.get(name);
        if (!creature) {
            throw new Error(`Creature not found with name: ${name}`);
        }
        return creature;
    }
    
    public getSupporter(templateId: string): SupporterData {
        const supporter = this.supporterData.get(templateId);
        if (!supporter) {
            throw new Error(`Supporter not found: ${templateId}`);
        }
        return supporter;
    }
    
    public getItem(templateId: string): ItemData {
        const item = this.itemData.get(templateId);
        if (!item) {
            throw new Error(`Item not found: ${templateId}`);
        }
        return item;
    }
    
    public getTool(templateId: string): ToolData {
        const tool = this.fieldCardToolData.get(templateId);
        if (!tool) {
            throw new Error(`Tool not found: ${templateId}`);
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
        return Array.from(this.fieldCardToolData.keys());
    }
    
    /**
     * Gets a card by ID, trying all card types.
     * 
     * @param id The ID of the card to get
     * @returns The card data and its type
     * @throws Error if the card is not found in any collection
     */
    public getCard(id: string): { data: CreatureData | SupporterData | ItemData | ToolData; type: string } {
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
     * Determines the evolution stage of a FieldCard.
     * 
     * @param fieldCardId The ID of the FieldCard to check
     * @returns 0 for Basic, 1 for Stage 1, 2 for Stage 2, or -1 if not found
     */
    public getEvolutionStage(fieldCardId: string): number {
        try {
            const fieldCard = this.getCreature(fieldCardId);
            
            // Basic FieldCard have no evolvesFrom property
            if (!fieldCard.previousStageName) {
                return 0; // Basic FieldCard
            }
            
            // Check if the FieldCard it evolves from is also an evolution FieldCard
            // evolvesFrom is now a creature name, not a templateId
            try {
                const preFieldCard = this.getCreatureByName(fieldCard.previousStageName);
                if (!preFieldCard.previousStageName) {
                    return 1; // Stage 1 FieldCard (evolves from Basic)
                } else {
                    return 2; // Stage 2 FieldCard (evolves from Stage 1)
                }
            } catch (error) {
                // If we can't find the pre-evolution, assume it's a Stage 1
                return 1;
            }
        } catch (error) {
            return -1; // FieldCard not found
        }
    }
}
