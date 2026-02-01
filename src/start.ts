#!/usr/bin/env ts-node

import { ControllerHandlerState, HandlerChain, IncrementalIntermediary, InquirerPresenter, SystemHandlerParams } from '@cards-ts/core';
import { hideBin } from 'yargs/helpers';
import yargs from 'yargs';
import { GameHandlerParams } from './game-handler-params.js';
import { ResponseMessage } from './messages/response-message.js';
import { GameSetup } from './game-setup.js';
import { gameFactory } from './game-factory.js';
import { Controllers } from './controllers/controllers.js';

const argv = yargs(hideBin(process.argv))
    .option('players', {
        type: 'number',
        description: 'Number of opponents to play against',
        default: 1,
    })
    .option('name', {
        type: 'string',
        description: 'Player\'s name',
    })
    .options(new GameSetup().getYargs())
    .strict()
    .help()
    .parseSync();

const mainPlayerIntermediary = new IncrementalIntermediary(new InquirerPresenter());
const names: string[] = [];
let name: string = argv.name as string;
if(!argv.name) {        
    // await mainPlayer.askForName();
    name = 'Player';
}
names.push(name);
names.push('Greg');

type HandlerData = ControllerHandlerState<Controllers>;

const factory = gameFactory();
const players: HandlerChain<SystemHandlerParams & GameHandlerParams, HandlerData, ResponseMessage>[] = Array(argv.players as number + 1);
players[0] = factory.getIntermediaryHandlerChain(mainPlayerIntermediary);
for(let i = 1; i < players.length; i++) {
    players[i] = factory.getDefaultBotHandlerChain();
}

const gameSetup = factory.getGameSetup();

const params = gameSetup.setupForYargs(argv);

const errors = gameSetup.verifyParams(params);

if(Object.keys(errors).length) {
    // Log errors to console and exit with error code
    for(const error of Object.entries(errors)) {
        console.error(error[1]);
    }
    process.exitCode = 1;
} else {
    await factory.getGameDriver(players, params, names).start();
}
