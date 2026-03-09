import { CreatureData, SupporterData, ItemData, ToolData, StadiumData, FossilData } from './card-types.js';

export class CardRepository {
    private creatureNameMap: Record<string, CreatureData> = {};

    private evolutionsOfMap: Record<string, string[]> = {};

    private typeMap: Record<string, string[]> = {};

    private fossilTemplateIds: Set<string> = new Set();
    
    constructor(
        private creatureData: Record<string, CreatureData> = {},
        private supporterData: Record<string, SupporterData> = {},
        private itemData: Record<string, ItemData> = {},
        private fieldCardToolData: Record<string, ToolData> = {},
        private stadiumData: Record<string, StadiumData> = {},
        fossilData: Record<string, FossilData> = {},
    ) {
        // Register fossils as creature entries so field operations work seamlessly
        for (const [ templateId, fossil ] of Object.entries(fossilData)) {
            this.fossilTemplateIds.add(templateId);
            this.creatureData[templateId] = {
                templateId: fossil.templateId,
                name: fossil.name,
                maxHp: fossil.maxHp,
                type: 'fossil',
                retreatCost: 0, // Safe default: retreat validation in action-validator.ts and event-handler.ts
                                // explicitly calls isFossil() and blocks retreat before energy is evaluated.
                attacks: [],
                fossil: true,
            };
        }
        // Build name-to-creature map at instantiation time for efficient lookups.
        // Use this.creatureData (which includes fossils) so getCreatureByName works for all field cards.
        for (const creature of Object.values(this.creatureData)) {
            // Store first occurrence of each name (multiple creatures may share the same name)
            if (!(creature.name in this.creatureNameMap)) {
                this.creatureNameMap[creature.name] = creature;
            }
        }
        
        // Build reverse evolution map: creatureName -> [IDs that evolve from it]
        for (const [ templateId, creature ] of Object.entries(this.creatureData)) {
            if (creature.previousStageName) {
                if (!(creature.previousStageName in this.evolutionsOfMap)) {
                    this.evolutionsOfMap[creature.previousStageName] = [];
                }
                this.evolutionsOfMap[creature.previousStageName].push(templateId);
            }
        }
        
        // Build type map: creatureType -> [IDs of that type]
        for (const [ templateId, creature ] of Object.entries(this.creatureData)) {
            if (creature.type) {
                if (!(creature.type in this.typeMap)) {
                    this.typeMap[creature.type] = [];
                }
                this.typeMap[creature.type].push(templateId);
            }
        }
    }

    public getCreature(templateId: string): CreatureData {
        const fieldCard = this.creatureData[templateId];
        if (!fieldCard) {
            throw new Error(`FieldCard not found: ${templateId}`);
        }
        return fieldCard;
    }
    
    public getAllCreatureIds(): string[] {
        return Object.keys(this.creatureData);
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
        const creature = this.creatureNameMap[name];
        if (!creature) {
            throw new Error(`Creature not found with name: ${name}`);
        }
        return creature;
    }
    
    public getSupporter(templateId: string): SupporterData {
        const supporter = this.supporterData[templateId];
        if (!supporter) {
            throw new Error(`Supporter not found: ${templateId}`);
        }
        return supporter;
    }
    
    public getItem(templateId: string): ItemData {
        const item = this.itemData[templateId];
        if (!item) {
            throw new Error(`Item not found: ${templateId}`);
        }
        return item;
    }
    
    public getTool(templateId: string): ToolData {
        const tool = this.fieldCardToolData[templateId];
        if (!tool) {
            throw new Error(`Tool not found: ${templateId}`);
        }
        return tool;
    }
    
    public getStadium(templateId: string): StadiumData {
        const stadium = this.stadiumData[templateId];
        if (!stadium) {
            throw new Error(`Stadium not found: ${templateId}`);
        }
        return stadium;
    }
    
    public getAllSupporterIds(): string[] {
        return Object.keys(this.supporterData);
    }
    
    public getAllItemIds(): string[] {
        return Object.keys(this.itemData);
    }
    
    public getAllToolIds(): string[] {
        return Object.keys(this.fieldCardToolData);
    }
    
    public getAllStadiumIds(): string[] {
        return Object.keys(this.stadiumData);
    }

    public getAllFossilIds(): string[] {
        return Array.from(this.fossilTemplateIds);
    }

    /**
     * Returns true if the given templateId is a fossil card.
     * Fossils are trainer item cards that can be placed on the field.
     */
    public isFossil(templateId: string): boolean {
        return this.fossilTemplateIds.has(templateId);
    }
    
    /**
     * Gets a card by ID, trying all card types.
     * 
     * @param id The ID of the card to get
     * @returns The card data and its type
     * @throws Error if the card is not found in any collection
     */
    public getCard(id: string): 
        | { data: CreatureData; type: 'creature' }
        | { data: SupporterData; type: 'supporter' }
        | { data: ItemData; type: 'item' }
        | { data: ToolData; type: 'tool' }
        | { data: StadiumData; type: 'stadium' }
        | { data: FossilData; type: 'fossil' } {
        // Check fossils first so they are returned as 'fossil' type rather than 'creature'
        if (this.fossilTemplateIds.has(id)) {
            const creatureEntry = this.creatureData[id];
            // FossilData fields are a strict subset of CreatureData registered fields
            const fossilData: FossilData = {
                templateId: creatureEntry.templateId,
                name: creatureEntry.name,
                maxHp: creatureEntry.maxHp,
            };
            return { data: fossilData, type: 'fossil' };
        }
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
                        try {
                            return { data: this.getStadium(id), type: 'stadium' };
                        } catch (e) {
                            throw new Error(`Card not found: ${id}`);
                        }
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
            
            /*
             * Check if the FieldCard it evolves from is also an evolution FieldCard
             * evolvesFrom is now a creature name, not a templateId
             */
            try {
                const preFieldCard = this.getCreatureByName(fieldCard.previousStageName);
                if (!preFieldCard.previousStageName) {
                    return 1; // Stage 1 FieldCard (evolves from Basic)
                } 
                return 2; // Stage 2 FieldCard (evolves from Stage 1)
                
            } catch (error) {
                // If we can't find the pre-evolution, assume it's a Stage 1
                return 1;
            }
        } catch (error) {
            return -1; // FieldCard not found
        }
    }
    
    /**
     * Gets all creature IDs that evolve from a given creature name.
     * Uses O(1) lookup via pre-built index.
     * 
     * @param creatureName The name of the creature to get evolutions for
     * @returns Array of creature IDs that evolve from this creature
     */
    public getEvolutionsOf(creatureName: string): string[] {
        return this.evolutionsOfMap[creatureName] || [];
    }
    
    /**
     * Gets all creature IDs of a specific type.
     * Uses O(1) lookup via pre-built index.
     * 
     * @param type The creature type to filter by
     * @returns Array of creature IDs of that type
     */
    public getCreaturesOfType(type: string): string[] {
        return this.typeMap[type] || [];
    }
}
