import { Controllers } from './controllers/controllers.js';
import { GameOverMessage, KnockedOutMessage, TurnSummaryMessage } from './messages/status/index.js';
import { sequence, loop, game, conditionalState, handleSingle, named } from '@cards-ts/state-machine';

// Check if any card was knocked out (has 0 HP)
const isCardKnockedOut = (controllers: Controllers) => {
    // Check both players' active cards
    for (let i = 0; i < controllers.players.count; i++) {
        if (controllers.field.isKnockedOut(i)) {
            return true;
        }
    }
    return false;
};

// Check if a player has no remaining cards (active is knocked out and no bench)
const isPlayerDefeated = (controllers: Controllers, playerId: number) => {
    return controllers.field.isKnockedOut(playerId) && !controllers.field.hasRemainingCards(playerId);
};

// Check if a player has won by points (3 points)
const hasWonByPoints = (controllers: Controllers, playerId: number) => {
    return controllers.points.get(playerId) >= 3;
};

// Check if the game is over (a player is defeated or has 3 points)
const isGameOver = (controllers: Controllers) => {
    for (let i = 0; i < controllers.players.count; i++) {
        // Check if this player is defeated
        if (isPlayerDefeated(controllers, i)) {
            return true;
        }
        
        // Check if this player has won by points
        if (hasWonByPoints(controllers, i)) {
            return true;
        }
    }
    return false;
};

// Get the player who needs to select a new active card
const getPlayerNeedingSelection = (controllers: Controllers) => {
    for (let i = 0; i < controllers.players.count; i++) {
        if (controllers.field.isKnockedOut(i) && controllers.field.hasRemainingCards(i)) {
            return i;
        }
    }
    return -1;
};

// Process knockouts and award points
const processKnockouts = { 
    name: 'processKnockouts', 
    run: (controllers: Controllers) => {
        // Check each player
        for (let i = 0; i < controllers.players.count; i++) {
            // If this player's card is knocked out
            if (controllers.field.isKnockedOut(i)) {
                // Send knockout message
                const targetCard = controllers.field.getActiveCard(i);
                controllers.players.messageAll(new KnockedOutMessage(targetCard.name));
                
                // Add a point to the opponent
                const opponentId = (i + 1) % controllers.players.count;
                controllers.points.increaseScore(opponentId, 1);
            }
        }
    }
};

// Check for game over conditions and handle them
const handleGameOver = sequence<Controllers>([
    // Send game over message
    { 
        name: 'sendGameOverMessage',
        run: (controllers: Controllers) => {
        const winnerName = getWinner(controllers);
        if (winnerName) {
            controllers.players.messageAll(new GameOverMessage(winnerName));
        }
    }},
    { 
        name: 'completeGame', 
        run: (controllers: Controllers) => controllers.completed.complete()
    }
]);

// Handle card knockout
const handleKnockout = sequence<Controllers>([
    // First process all knockouts and award points
    processKnockouts,
    
    // Check if game is over after processing knockouts
    conditionalState({
        id: 'gameOverCheck',
        condition: isGameOver,
        truthy: handleGameOver,
        falsey: conditionalState({
            id: 'needsSelection',
            condition: (controllers: Controllers) => getPlayerNeedingSelection(controllers) !== -1,
            truthy: loop<Controllers>({
                id: 'selectionLoop',
                breakingIf: (controllers: Controllers) => getPlayerNeedingSelection(controllers) === -1,
                run: handleSingle({
                    handler: 'selectActiveCard',
                    position: getPlayerNeedingSelection
                }),
                // TODO Condition is not re-evaluated for some reason without afterEach...
                afterEach: () => {},
            })
        })
    })
]);

// Get the winner of the game
const getWinner = (controllers: Controllers): string => {
    // Check if Controllers player is defeated
    for (let i = 0; i < controllers.players.count; i++) {
        if (isPlayerDefeated(controllers, i)) {
            const winnerIndex = (i + 1) % controllers.players.count;
            return `Player ${winnerIndex + 1}`;
        }
    }
    
    // Check if Controllers player has won by points
    for (let i = 0; i < controllers.players.count; i++) {
        if (hasWonByPoints(controllers, i)) {
            return `Player ${i + 1}`;
        }
    }
    
    return '';
};

// Draw a card and show turn summary
const drawCardAndShowSummary = {
    name: 'drawCardAndShowSummary',
    run: (controllers: Controllers) => {
        const currentPlayer = controllers.turn.get();
        const opponentId = (currentPlayer + 1) % controllers.players.count;
        const cardRepo = controllers.cardRepository;
        
        const card = controllers.hand.drawCard(currentPlayer);
        
        const myCard = controllers.field.getActiveCard(currentPlayer);
        const opponentCard = controllers.field.getActiveCard(opponentId);
        const myBench = controllers.field.getBenchedCards(currentPlayer);
        const opponentBench = controllers.field.getBenchedCards(opponentId);
        
        const handCards = controllers.hand.getHand(currentPlayer)
            .map(card => cardRepo.getCardName(card.cardId, card.type))
            .join(', ');
        
        const drawnCardName = card ? cardRepo.getCardName(card.cardId, card.type) : undefined;
        
        controllers.players.message(currentPlayer, new TurnSummaryMessage(myCard, opponentCard, myBench, opponentBench, handCards, drawnCardName));
    }
};

// This is no longer used as the logic is moved to the action handler

// Handle player actions
const handlePlayerActions = loop<Controllers>({
    id: 'actionLoop',
    breakingIf: (controllers: Controllers) => {
        return controllers.turnState.getShouldEndTurn();
    },
    run: sequence<Controllers>([
        // Handle player action
        handleSingle({
            handler: 'action',
            position: (controllers: Controllers) => controllers.turn.get()
        }),
        {
            // TODO why is this needed?
            name: 'noop',
            run: () => {},
        }, 
        // Check for knockouts after each action
        conditionalState({
            id: 'checkKnockouts',
            condition: isCardKnockedOut,
            truthy: handleKnockout,
        })
    ]),
    // TODO Condition is not re-evaluated for some reason without afterEach...
    afterEach: () => {},
});

// Basic game turn
const gameTurn = loop<Controllers>({
    id: 'gameTurnLoop',
    breakingIf: isGameOver,
    run: sequence<Controllers>([
        // Reset turn state at the start of each turn
        {
            name: 'resetTurnState',
            run: (controllers: Controllers) => {
                controllers.turnState.resetTurnState();
            }
        },
        
        // Draw a card and show turn summary
        drawCardAndShowSummary,
        
        // Handle player actions until a card is knocked out or turn ends
        handlePlayerActions,
        
        // Advance to the next player's turn
        { 
            name: 'nextTurn',
            run: (controllers: Controllers) => {
                if (!isGameOver(controllers)) {
                    controllers.turn.next();
                }
            }
        }
    ]),
    // TODO Condition is not re-evaluated for some reason without afterEach...
    afterEach: () => {},
});

export const stateMachine = game<Controllers>(
    (controllers: Controllers) => {
        // Initialize the game
        const params = controllers.params.get();
        if (params.initialDecks) {
            // Use initial decks from params if provided
            controllers.deck.initialize(controllers.players.count, params.initialDecks);
        } else {
            // Otherwise initialize with empty decks
            controllers.deck.initialize(controllers.players.count);
        }
        
        // Initialize hands once for all players
        controllers.hand.initialize(controllers.players.count);
        
        // Draw initial hands
        for (let i = 0; i < controllers.players.count; i++) {
            controllers.hand.drawInitialHand(i);
        }
        
        // Set up initial active cards from deck
        for (let i = 0; i < controllers.players.count; i++) {
            const firstCard = controllers.hand.drawCard(i);
            if (firstCard && firstCard.type === 'creature') {
                controllers.field.setActiveCard(i, firstCard.cardId);
            }
        }
        
        // Reset points
        controllers.points.reset();
    },
    gameTurn,
    (controllers: Controllers) => {
        // Game over logic is handled in the turn handler
    },
);
