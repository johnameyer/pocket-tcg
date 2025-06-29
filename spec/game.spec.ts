import { expect } from 'chai';
import { IntermediaryHandler } from '../src/handlers/intermediary-handler.js';
import { eventHandler } from '../src/event-handler.js';
import { GameSetup } from '../src/game-setup.js';
import { DefaultBotHandler } from '../src/handlers/default-bot-handler.js';
import { HandlerData } from '../src/game-handler.js';
import { GameParams } from '../src/game-params.js';
import { buildProviders } from '../src/controllers/controllers.js';
import { StatusMessage } from '../src/messages/status-message.js';
import { stateMachine } from '../src/state-machine.js';
import { adapt } from '@cards-ts/state-machine';
import { ArrayMessageHandler, buildGameFactory, HandlerChain, HandlerResponsesQueue } from '@cards-ts/core';
import { mockRepository } from './mock-repository.js';
import { SelectActiveCardResponseMessage } from '../src/messages/response/select-active-card-response-message.js';
import { EvolveResponseMessage } from '../src/messages/response/evolve-response-message.js';
import { AttackResponseMessage } from '../src/messages/response/attack-response-message.js';
import { AttackResultMessage } from '../src/messages/status/attack-result-message.js';
import { GameOverMessage } from '../src/messages/status/game-over-message.js';
import { ResponseMessage } from '../src/messages/response-message.js';
import { ControllerHandlerState } from '@cards-ts/core';
import { Controllers } from '../src/controllers/controllers.js';

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

    it('runs to completion with bot handlers', () => {
        const messageHandlers = Array.from({ length: 2 }, () => new ArrayMessageHandler<StatusMessage>());
        const gameHandler = () => new DefaultBotHandler(mockRepository);

        // @ts-expect-error
        const players = Array.from(messageHandlers, messageHandler => new HandlerChain([ messageHandler, gameHandler() ]));
        const names = Array.from(messageHandlers, (_, i) => String.fromCharCode(65 + i));
        const driver = factory.getGameDriver(players, params, names);

        driver.resume();
        driver.handleSyncResponses();
        driver.resume();

        const state = driver.getState() as ControllerHandlerState<Controllers>;
        expect(state.setup.playersReady.some((ready: boolean) => ready)).to.equal(true);
    });
    
    it('runs to completion with bot handlers', () => {
        const messageHandlers = Array.from({ length: 2 }, () => new ArrayMessageHandler<StatusMessage>());
        const gameHandler = () => new DefaultBotHandler(mockRepository);

        // @ts-expect-error
        const players = Array.from(messageHandlers, messageHandler => new HandlerChain([ messageHandler, gameHandler() ]));
        const names = Array.from(messageHandlers, (_, i) => String.fromCharCode(65 + i));
        const driver = factory.getGameDriver(players, params, names);

        driver.resume();
        
        // Run until game completes
        let steps = 0;
        while (!driver.getState().completed && steps < 100) {
            driver.handleSyncResponses();
            driver.resume();
            steps++;
        }

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
    
    it('handles attacks and knockouts correctly', () => {
        const messageHandlers = Array.from({ length: 2 }, () => new ArrayMessageHandler<StatusMessage>());
        
        class TestGameHandler extends DefaultBotHandler {
            handleAction(handlerData: HandlerData, responsesQueue: HandlerResponsesQueue<ResponseMessage>): void {
                responsesQueue.push(new AttackResponseMessage(0));
            }
        }
        
        const gameHandlers = [
            new TestGameHandler(),
            new TestGameHandler()
        ];
        
        const players = messageHandlers.map((messageHandler, index) => 
            // @ts-ignore
            new HandlerChain([messageHandler, gameHandlers[index]])
        );
        
        const names = Array.from(messageHandlers, (_, i) => String.fromCharCode(65 + i));
        const driver = factory.getGameDriver(players, params, names);
        
        // Run until we see attack messages or game completes
        driver.resume();
        let steps = 0;
        while (steps < 50) {
            driver.handleSyncResponses();
            driver.resume();
            steps++;
            
            // Check if we have attack messages
            const attackMessages = messageHandlers[0].arr.filter(msg => msg.type === 'attack-result-message');
            if (attackMessages.length > 0) break;
        }
        
        // Check for attack messages
        const attackMessages = messageHandlers[0].arr.filter(msg => msg.type === 'attack-result-message') as AttackResultMessage[];
        expect(attackMessages.length).to.be.greaterThan(0);
        
        const attackMsg = attackMessages[0];
        expect(attackMsg.damage).to.be.a('number');
        expect(attackMsg.attackName).to.be.a('string');
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
                responsesQueue.push(new AttackResponseMessage(0));
            }
            
            handleSelectActiveCard(handlerData: HandlerData, responsesQueue: HandlerResponsesQueue<ResponseMessage>): void {
                // Select the first benched card
                responsesQueue.push(new SelectActiveCardResponseMessage(0));
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
    
    it('handles setup phase correctly', () => {
        const messageHandlers = Array.from({ length: 2 }, () => new ArrayMessageHandler<StatusMessage>());
        
        // Track setup actions for each player
        const setupActions: { [key: number]: string[] } = {
            0: [],
            1: []
        };
        
        // Create a custom game handler that tracks setup
        class SetupTrackingHandler extends DefaultBotHandler {
            constructor(private readonly playerId: number) {
                super(mockRepository);
            }
            
            handleSetup(handlerData: HandlerData, responsesQueue: HandlerResponsesQueue<ResponseMessage>): void {
                // Record that this player performed setup
                setupActions[this.playerId].push(`setup-${this.playerId}`);
                
                // Call parent setup logic
                super.handleSetup(handlerData, responsesQueue);
            }
            
            handleAction(handlerData: HandlerData, responsesQueue: HandlerResponsesQueue<ResponseMessage>): void {
                // Always attack to cause damage and eventually knockouts
                responsesQueue.push(new AttackResponseMessage(0));
            }
            
            handleSelectActiveCard(handlerData: HandlerData, responsesQueue: HandlerResponsesQueue<ResponseMessage>): void {
                // Select the first benched card
                responsesQueue.push(new SelectActiveCardResponseMessage(0));
            }
        }
        
        // Create custom handlers for each player
        const gameHandlers = [
            new SetupTrackingHandler(0),
            new SetupTrackingHandler(1)
        ];
        
        const players = messageHandlers.map((messageHandler, index) => 
            // @ts-ignore - Ignoring type issues with HandlerChain for testing purposes
            new HandlerChain([messageHandler, gameHandlers[index]])
        );
        
        const names = Array.from(messageHandlers, (_, i) => String.fromCharCode(65 + i));
        
        const driver = factory.getGameDriver(players, params, names);
        
        // Run until setup is complete
        driver.resume();
        
        // Continue until setup phase is done
        for (let i = 0; i < 10; i++) {
            driver.handleSyncResponses();
            driver.resume();
        }
        
        // Verify both players performed setup
        expect(setupActions[0].length).to.be.greaterThan(0);
        expect(setupActions[1].length).to.be.greaterThan(0);
        
        // Verify setup state shows players are ready
        const state = driver.getState() as ControllerHandlerState<Controllers>;
        expect(state.setup.playersReady.every((ready: boolean) => ready)).to.be.true;
    });

    it('handles evolution correctly', () => {
        const messageHandlers = Array.from({ length: 2 }, () => new ArrayMessageHandler<StatusMessage>());
        
        // Create a custom game handler that evolves a creature
        class EvolutionTestHandler extends DefaultBotHandler {
            private evolved = false;
            
            constructor() {
                super(mockRepository);
            }
            
            handleAction(handlerData: HandlerData, responsesQueue: HandlerResponsesQueue<ResponseMessage>): void {
                if (!this.evolved) {
                    // Try to evolve first
                    const hand = handlerData.hand;
                    const hasEvolutionCard = hand.some(card => card.cardId === 'test-evolution');
                    if (hasEvolutionCard) {
                        responsesQueue.push(new EvolveResponseMessage('test-evolution', true));
                        this.evolved = true;
                        return;
                    }
                }
                // Otherwise attack
                responsesQueue.push(new AttackResponseMessage(0));
            }
        }
        
        const gameHandlers = [
            new EvolutionTestHandler(),
            new DefaultBotHandler(mockRepository)
        ];
        
        const players = messageHandlers.map((messageHandler, index) => 
            // @ts-ignore
            new HandlerChain([messageHandler, gameHandlers[index]])
        );
        
        // Create test deck with evolution card
        const evolutionDecks = [
            ['test-evolution', 'test-creature-0', 'test-creature-0', 'test-creature-1'],
            ['test-creature-0', 'test-creature-1', 'test-creature-0', 'test-creature-1']
        ];
        
        const testParams: GameParams = {
            ...params,
            initialDecks: evolutionDecks
        };
        
        const names = Array.from(messageHandlers, (_, i) => String.fromCharCode(65 + i));
        const driver = factory.getGameDriver(players, testParams, names);
        
        driver.resume();
        while (!driver.getState().completed) {
            driver.handleSyncResponses();
            driver.resume();
        }
        
        // Check if evolution occurred by looking for the evolved creature
        const state = driver.getState() as ControllerHandlerState<Controllers>;
        const activeCards = (state.field as any).activeCards;
        
        // Check if any active card has the evolution card ID
        const hasEvolution = activeCards.some((card: any) => card && card.cardId === 'test-evolution');
        
        // Also check bench cards for evolution
        const benchCards = (state.field as any).benchedCards;
        const hasEvolutionInBench = benchCards && benchCards.some((playerBench: any[]) => 
            playerBench && playerBench.some((card: any) => card && card.cardId === 'test-evolution')
        );
        
        expect(hasEvolution || hasEvolutionInBench).to.be.true;
    });
});
