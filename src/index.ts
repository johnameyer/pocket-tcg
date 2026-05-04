export { gameFactory } from './game-factory.js';
export { IntermediaryHandler } from './handlers/intermediary-handler.js';

// Export card types and repository for custom card definitions
export * from './repository/index.js';

// Export handler data types for external consumers (e.g. ISMCTS adapters)
export type { HandHandlerData } from './controllers/hand-controller.js';
export type { DeckHandlerData } from './controllers/deck-controller.js';
