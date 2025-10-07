import { GenericControllerProvider, GlobalController, Serializable } from '@cards-ts/core';
import { CardRepository } from '../repository/card-repository.js';

export type CardRepositoryState = {};

export class CardRepositoryControllerProvider implements GenericControllerProvider<CardRepositoryState, {}, CardRepositoryController> {
    constructor(private repository: CardRepository) {}
    
    controller(state: CardRepositoryState, controllers: {}): CardRepositoryController {
        return new CardRepositoryController(state, controllers, this.repository);
    }
    
    initialState(): CardRepositoryState { return {}; }
    dependencies() { return {} as const; }
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

    getCreature(id: string) { return this.repository.getCreature(id); }
    getSupporter(id: string) { return this.repository.getSupporter(id); }
    getItem(id: string) { return this.repository.getItem(id); }
    getTool(id: string) { return this.repository.getTool(id); }
    getAllCreatureIds() { return this.repository.getAllCreatureIds(); }
    getAllSupporterIds() { return this.repository.getAllSupporterIds(); }
    getAllItemIds() { return this.repository.getAllItemIds(); }
    getCard(id: string) { return this.repository.getCard(id); }
}
