import { GameSetup } from './game-setup.js';
import { DefaultBotHandler } from './handlers/default-bot-handler.js';
import { IntermediaryHandler } from './handlers/intermediary-handler.js';
import { eventHandler } from './event-handler.js';
import { buildProviders } from './controllers/controllers.js';
import { stateMachine } from './state-machine.js';
import { buildGameFactory } from '@cards-ts/core';
import { adapt } from '@cards-ts/state-machine';
import { CardRepository } from './repository/card-repository.js';

export const gameFactory = (cardRepository?: CardRepository) => {
    const repository = cardRepository || new CardRepository();
    return buildGameFactory(
        adapt(stateMachine),
        eventHandler,
        new GameSetup(),
        intermediary => new IntermediaryHandler(intermediary, repository),
        () => new DefaultBotHandler(repository),
        () => buildProviders(repository),
    );
};
