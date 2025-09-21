import { GameParams } from '../game-params.js';
import { GameHandlerParams } from '../game-handler-params.js';
import { ResponseMessage } from '../messages/response-message.js';
import { FieldControllerProvider } from './field-controller.js';
import { CardRepositoryControllerProvider } from './card-repository-controller.js';
import { DeckControllerProvider } from './deck-controller.js';
import { HandControllerProvider } from './hand-controller.js';
import { DefaultControllerKeys, DefaultControllers, SystemHandlerParams, ControllersProviders, UnwrapProviders, ValidatedProviders, STANDARD_STATES, TurnControllerProvider, PointsControllerProvider } from '@cards-ts/core';
import { CardRepository } from '../repository/card-repository.js';
import { TurnStateControllerProvider } from './turn-state-controller.js';
import { TurnCounterControllerProvider } from './turn-counter-controller.js';
import { SetupControllerProvider } from './setup-controller.js';
import { EnergyControllerProvider } from './energy-controller.js';
import { CoinFlipControllerProvider } from './coinflip-controller.js';

type TypedDefaultControllers = DefaultControllers<GameParams, typeof STANDARD_STATES, ResponseMessage, GameHandlerParams & SystemHandlerParams>;

export const buildProviders = (cardRepository: CardRepository) => {
    const providers = {
        field: new FieldControllerProvider(),
        cardRepository: new CardRepositoryControllerProvider(cardRepository),
        turn: new TurnControllerProvider(),
        points: new PointsControllerProvider(),
        deck: new DeckControllerProvider(),
        hand: new HandControllerProvider(),
        turnState: new TurnStateControllerProvider(),
        turnCounter: new TurnCounterControllerProvider(),
        setup: new SetupControllerProvider(),
        energy: new EnergyControllerProvider(),
        coinFlip: new CoinFlipControllerProvider(),
    };
    return providers as Omit<ValidatedProviders<typeof providers & ControllersProviders<TypedDefaultControllers>>, DefaultControllerKeys> & {};
};

export type GameControllers = UnwrapProviders<ReturnType<typeof buildProviders>>;

export type Controllers = GameControllers & TypedDefaultControllers;
