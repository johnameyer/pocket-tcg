import { GenericControllerProvider, GlobalController } from '@cards-ts/core';
import { CardRepository } from '../repository/card-repository.js';

export type CardRepositoryState = {};

export class CardRepositoryControllerProvider implements GenericControllerProvider<CardRepositoryState, {}, CardRepositoryController> {
    constructor(private repository: CardRepository) {}
    
    controller(state: CardRepositoryState, controllers: {}): CardRepositoryController {
        return new CardRepositoryController(state, controllers, this.repository);
    }
    
    initialState(): CardRepositoryState {
        return {}; 
    }

    dependencies() {
        return {} as const; 
    }
}

/**
 * Wraps the Repository class to use the cards-ts framework to inject in all places.
 */
export class CardRepositoryController extends GlobalController<CardRepositoryState, {}> {
    constructor(state: CardRepositoryState, controllers: {}, private repository: CardRepository) {
        super(state, controllers);
    }
    
    get cardRepository(): CardRepository {
        return this.repository;
    }

    getCreature(id: string) {
        return this.repository.getCreature(id); 
    }

    getCreatureByName(name: string) {
        return this.repository.getCreatureByName(name); 
    }

    getSupporter(id: string) {
        return this.repository.getSupporter(id); 
    }

    getItem(id: string) {
        return this.repository.getItem(id); 
    }

    getTool(id: string) {
        return this.repository.getTool(id); 
    }

    getStadium(id: string) {
        return this.repository.getStadium(id); 
    }

    getAllCreatureIds() {
        return this.repository.getAllCreatureIds(); 
    }

    getAllSupporterIds() {
        return this.repository.getAllSupporterIds(); 
    }

    getAllItemIds() {
        return this.repository.getAllItemIds(); 
    }

    getCard(id: string) {
        return this.repository.getCard(id);
    }

    /**
     * Validates that every creature's previousStageName (evolvesFrom) exists in the repository.
     * Throws an error if any creature references a non-existent previous stage.
     */
    validateEvolutions(): void {
        const creatureIds = this.repository.getAllCreatureIds();
        const errors: string[] = [];

        for (const creatureId of creatureIds) {
            const creature = this.repository.getCreature(creatureId);
            
            if (creature.previousStageName) {
                try {
                    this.repository.getCreatureByName(creature.previousStageName);
                } catch {
                    errors.push(`Creature "${creature.name}" (${creatureId}) references non-existent previousStageName: "${creature.previousStageName}"`);
                }
            }
        }

        if (errors.length > 0) {
            throw new Error(`Evolution validation failed:\n${errors.join('\n')}`);
        }
    }
}
