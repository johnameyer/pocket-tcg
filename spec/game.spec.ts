import { expect } from 'chai';
import { IntermediaryHandler } from '../src/handlers/intermediary-handler.js';
import { eventHandler } from '../src/event-handler.js';
import { GameSetup } from '../src/game-setup.js';
import { DefaultBotHandler } from '../src/handlers/default-bot-handler.js';
import { GameHandler, HandlerData } from '../src/game-handler.js';
import { GameParams } from '../src/game-params.js';
import { buildProviders } from '../src/controllers/controllers.js';
import { StatusMessage } from '../src/messages/status-message.js';
import { stateMachine } from '../src/state-machine.js';
import { adapt } from '@cards-ts/state-machine';
import { ArrayMessageHandler, buildGameFactory, HandlerChain, HandlerResponsesQueue } from '@cards-ts/core';
import { mockRepository } from './mock-repository.js';
import { ActionResponseMessage } from '../src/messages/response/action-response-message.js';
import { SelectActiveCardResponseMessage } from '../src/messages/response/select-active-card-response-message.js';
import { AttackResultMessage } from '../src/messages/status/attack-result-message.js';
import { KnockedOutMessage } from '../src/messages/status/knocked-out-message.js';
import { GameOverMessage } from '../src/messages/status/game-over-message.js';
import { ResponseMessage } from '../src/messages/response-message.js';

describe('Game', () => {
    
    // Create test decks with creature cards
    const createTestDecks = () => {
        const decks: string[][] = [];
        
        // Create two decks (one for each player)
        for (let i = 0; i < 2; i++) {
            const deck: string[] = [];
            
            // Add 10 cards to each deck
            for (let j = 0; j < 10; j++) {
                deck.push(`test-creature-${j % 2}`);
            }
            
            decks.push(deck);
        }
        
        return decks;
    };

    const factory = buildGameFactory(
        adapt(stateMachine),
        eventHandler,
        new GameSetup(),
        intermediary => new IntermediaryHandler(intermediary, mockRepository),
        () => new DefaultBotHandler(mockRepository),
        () => buildProviders(mockRepository),
    );

    const params: GameParams = {
        ...new GameSetup().getDefaultParams(),
        initialDecks: createTestDecks(),
    };

    it('runs to completion with bot handlers', async () => {
        const messageHandlers = Array.from({ length: 2 }, () => new ArrayMessageHandler<StatusMessage>());
        const gameHandler = () => new DefaultBotHandler(mockRepository);

        // @ts-expect-error
        const players = Array.from(messageHandlers, messageHandler => new HandlerChain([ messageHandler, gameHandler() ]));
        const names = Array.from(messageHandlers, (_, i) => String.fromCharCode(65 + i));
        const driver = factory.getGameDriver(players, params, names);

        await driver.start();

        // Assert game over message was sent
        const gameOverMessages = messageHandlers.flatMap(handler => 
            handler.arr.filter(msg => msg.type === 'game-over-message')
        ) as GameOverMessage[];
        expect(gameOverMessages.length).to.be.greaterThan(0);

        // Assert players have points
        const state = driver.getState();
        expect(state.points[0]).to.be.a('number');
        expect(state.points[1]).to.be.a('number');
        expect(state.points[0] + state.points[1]).to.be.greaterThan(0);
    });
    
    it('handles attacks correctly', async () => {
        const messageHandlers = Array.from({ length: 2 }, () => new ArrayMessageHandler<StatusMessage>());
        
        class SingleAttackHandler extends DefaultBotHandler {
            private hasAttacked = false;
            
            handleAction(handlerData: HandlerData, responsesQueue: HandlerResponsesQueue<ResponseMessage>): void {
                if (!this.hasAttacked) {
                    responsesQueue.push(new ActionResponseMessage({
                        type: 'attack',
                        attackIndex: 0
                    }));
                    this.hasAttacked = true;
                } else {
                    // End turn after first attack
                    super.handleAction(handlerData, responsesQueue);
                }
            }
        }
        
        const players = messageHandlers.map(messageHandler => 
            // @ts-expect-error
            new HandlerChain([messageHandler, new SingleAttackHandler(mockRepository)])
        );
        
        const names = ['A', 'B'];
        const driver = factory.getGameDriver(players, params, names);
        
        // Run until we see an attack
        driver.resume();
        while (!driver.getState().completed) {
            driver.handleSyncResponses();
            driver.resume();
            
            // Stop after first attack is processed
            const attackMessages = messageHandlers.flatMap(handler => 
                handler.arr.filter(msg => msg.type === 'attack-result-message')
            );
            if (attackMessages.length > 0) break;
        }
        
        // Verify attack occurred
        const attackMessages = messageHandlers.flatMap(handler => 
            handler.arr.filter(msg => msg.type === 'attack-result-message')
        ) as AttackResultMessage[];
        
        expect(attackMessages.length).to.be.greaterThan(0);
        const attackMsg = attackMessages[0];
        expect(attackMsg.damage).to.be.a('number');
        expect(attackMsg.attackName).to.be.a('string');
    });
    
    it('handles knockouts correctly', async () => {
        const messageHandlers = Array.from({ length: 2 }, () => new ArrayMessageHandler<StatusMessage>());
        
        class AttackUntilKnockoutHandler extends DefaultBotHandler {
            handleAction(handlerData: HandlerData, responsesQueue: HandlerResponsesQueue<ResponseMessage>): void {
                responsesQueue.push(new ActionResponseMessage({
                    type: 'attack',
                    attackIndex: 0
                }));
            }
        }
        
        const players = messageHandlers.map(messageHandler => 
            // @ts-expect-error
            new HandlerChain([messageHandler, new AttackUntilKnockoutHandler(mockRepository)])
        );
        
        const names = ['A', 'B'];
        const driver = factory.getGameDriver(players, params, names);
        
        // Run until knockout occurs
        driver.resume();
        while (!driver.getState().completed) {
            driver.handleSyncResponses();
            driver.resume();
            
            const knockoutMessages = messageHandlers.flatMap(handler => 
                handler.arr.filter(msg => msg.type === 'knocked-out-message')
            );
            if (knockoutMessages.length > 0) break;
        }
        
        // Verify knockout occurred
        const knockoutMessages = messageHandlers.flatMap(handler => 
            handler.arr.filter(msg => msg.type === 'knocked-out-message')
        ) as KnockedOutMessage[];
        
        expect(knockoutMessages.length).to.be.greaterThan(0);
        expect(knockoutMessages[0].player).to.be.a('string');
    });
    
    it('handles turn progression correctly', () => {
        const messageHandlers = Array.from({ length: 2 }, () => new ArrayMessageHandler<StatusMessage>());
        
        const turnOrder: number[] = [];
        
        class TurnTrackingHandler extends DefaultBotHandler {
            constructor(private readonly playerId: number) {
                super(mockRepository);
            }
            
            handleAction(handlerData: HandlerData, responsesQueue: HandlerResponsesQueue<ResponseMessage>): void {
                turnOrder.push(this.playerId);
                super.handleAction(handlerData, responsesQueue);
            }
        }
        
        const players = messageHandlers.map((messageHandler, index) => 
            // @ts-expect-error
            new HandlerChain([messageHandler, new TurnTrackingHandler(index)])
        );
        
        const names = ['A', 'B'];
        const driver = factory.getGameDriver(players, params, names);
        
        // Run a few turns
        driver.resume();
        let steps = 0;
        while (!driver.getState().completed && steps < 10) {
            driver.handleSyncResponses();
            driver.resume();
            steps++;
        }
        
        // Verify both players took turns
        expect(turnOrder).to.include(0);
        expect(turnOrder).to.include(1);
        expect(turnOrder.length).to.be.greaterThan(1);
    });
});
