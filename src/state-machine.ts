import { Controllers } from './controllers/controllers.js';
import { GameOverMessage, KnockedOutMessage, TurnSummaryMessage } from './messages/status/index.js';
import { sequence, loop, game, conditionalState, handleSingle, named } from '@cards-ts/state-machine';
import { TriggerProcessor } from './effects/trigger-processor.js';
import { GameCard } from './controllers/card-types.js';

// Check if any card was knocked out (has 0 HP)
const isCardKnockedOut = (controllers: Controllers) => {
    // Check both players' active cards
    for (let i = 0; i < controllers.players.count; i++) {
        if (controllers.field.isKnockedOut(i)) {
            return true;
        }
        
        // Check bench card knockouts
        const benchCards = controllers.field.getCards(i).slice(1); // Skip active card
        for (const benchCard of benchCards) {
            const { maxHp } = controllers.cardRepository.getCreature(benchCard.templateId);
            if (benchCard.damageTaken >= maxHp) {
                return true;
            }
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
            // Check active card knockout
            if (controllers.field.isKnockedOut(i)) {
                // Send knockout message
                const targetCard = controllers.field.getCardByPosition(i, 0);
                if (targetCard) {
                    const cardData = controllers.cardRepository.getCreature(targetCard.templateId);
                    controllers.players.messageAll(new KnockedOutMessage(cardData.name));
                    
                    // Get attached energy before removing it
                    const attachedEnergy = controllers.energy.getAttachedEnergyByInstance(targetCard.instanceId);
                    
                    // Clean up energy attached to the knocked out card and add to discard pile
                    controllers.energy.removeAllEnergyFromInstance(targetCard.instanceId);
                    controllers.energy.addDiscardedEnergyDict(i, attachedEnergy);
                    
                    // Add the knocked out card to discard pile (including evolution stack)
                    const cardsToDiscard: GameCard[] = [{
                        instanceId: targetCard.instanceId,
                        templateId: targetCard.templateId,
                        type: 'creature' as const
                    }];
                    
                    // If there's an evolution stack, add those cards to discard pile too
                    if (targetCard.evolutionStack && targetCard.evolutionStack.length > 0) {
                        for (const stackCard of targetCard.evolutionStack) {
                            cardsToDiscard.push({
                                instanceId: stackCard.instanceId,
                                templateId: stackCard.templateId,
                                type: 'creature' as const
                            });
                        }
                    }
                    
                    controllers.discard.addCards(i, ...cardsToDiscard);
                    
                    // Award points to the opponent (2 for ex cards, 1 for regular)
                    const opponentId = (i + 1) % controllers.players.count;
                    const pointsToAward = cardData.attributes?.ex ? 2 : 1;
                    controllers.points.increaseScore(opponentId, pointsToAward);
                }
            }
            
            // Check bench card knockouts
            const benchCards = controllers.field.getCards(i).slice(1); // Skip active card
            for (let benchIndex = 0; benchIndex < benchCards.length; benchIndex++) {
                const benchCard = benchCards[benchIndex];
                const { maxHp } = controllers.cardRepository.getCreature(benchCard.templateId);
                
                if (benchCard.damageTaken >= maxHp) {
                    // Send knockout message
                    const cardData = controllers.cardRepository.getCreature(benchCard.templateId);
                    controllers.players.messageAll(new KnockedOutMessage(`${cardData.name} (bench)`));
                    
                    // Get attached energy before removing it
                    const attachedEnergy = controllers.energy.getAttachedEnergyByInstance(benchCard.instanceId);
                    
                    // Clean up energy attached to the knocked out card and add to discard pile
                    controllers.energy.removeAllEnergyFromInstance(benchCard.instanceId);
                    controllers.energy.addDiscardedEnergyDict(i, attachedEnergy);
                    
                    // Add the knocked out bench card to discard pile (including evolution stack)
                    const cardsToDiscard: GameCard[] = [{
                        instanceId: benchCard.instanceId,
                        templateId: benchCard.templateId,
                        type: 'creature' as const
                    }];
                    
                    // If there's an evolution stack, add those cards to discard pile too
                    if (benchCard.evolutionStack && benchCard.evolutionStack.length > 0) {
                        for (const stackCard of benchCard.evolutionStack) {
                            cardsToDiscard.push({
                                instanceId: stackCard.instanceId,
                                templateId: stackCard.templateId,
                                type: 'creature' as const
                            });
                        }
                    }
                    
                    controllers.discard.addCards(i, ...cardsToDiscard);
                    
                    // Award points to the opponent (2 for ex cards, 1 for regular)
                    const opponentId = (i + 1) % controllers.players.count;
                    const pointsToAward = cardData.attributes?.ex ? 2 : 1;
                    controllers.points.increaseScore(opponentId, pointsToAward);
                    
                    // Remove the knocked out bench card
                    controllers.field.removeBenchCard(i, benchIndex);
                }
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
        
        const myCard = controllers.field.getCardByPosition(currentPlayer, 0);
        const opponentCard = controllers.field.getCardByPosition(opponentId, 0);
        const myBench = controllers.field.getPlayedCards(currentPlayer).slice(1);
        const opponentBench = controllers.field.getPlayedCards(opponentId).slice(1);
        
        // Convert to CreatureInfo format
        const myCardInfo = myCard ? {
            name: cardRepo.getCreature(myCard.templateId).name,
            hp: Math.max(0, cardRepo.getCreature(myCard.templateId).maxHp - myCard.damageTaken),
            maxHp: cardRepo.getCreature(myCard.templateId).maxHp
        } : { name: 'None', hp: 0, maxHp: 0 };
        
        const opponentCardInfo = opponentCard ? {
            name: cardRepo.getCreature(opponentCard.templateId).name,
            hp: Math.max(0, cardRepo.getCreature(opponentCard.templateId).maxHp - opponentCard.damageTaken),
            maxHp: cardRepo.getCreature(opponentCard.templateId).maxHp
        } : { name: 'None', hp: 0, maxHp: 0 };
        
        const myBenchInfo = myBench.map(card => ({
            name: cardRepo.getCreature(card.templateId).name,
            hp: Math.max(0, cardRepo.getCreature(card.templateId).maxHp - card.damageTaken),
            maxHp: cardRepo.getCreature(card.templateId).maxHp
        }));
        
        const opponentBenchInfo = opponentBench.map(card => ({
            name: cardRepo.getCreature(card.templateId).name,
            hp: Math.max(0, cardRepo.getCreature(card.templateId).maxHp - card.damageTaken),
            maxHp: cardRepo.getCreature(card.templateId).maxHp
        }));
        
        const handCards = controllers.hand.getHand(currentPlayer)
            .map(card => cardRepo.getCreature(card.templateId).name)
            .join(', ');
        
        const drawnCardName = card ? cardRepo.getCreature(card.templateId).name : undefined;
        
        controllers.players.message(currentPlayer, new TurnSummaryMessage(myCardInfo, opponentCardInfo, myBenchInfo, opponentBenchInfo, handCards, drawnCardName));
    }
};

// Handle player actions
const handlePlayerActions = loop<Controllers>({
    id: 'actionLoop',
    breakingIf: (controllers: Controllers) => controllers.turnState.getShouldEndTurn(),
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
                const currentPlayer = controllers.turn.get();
                controllers.turnState.startTurn();
                controllers.energy.resetTurnFlags(currentPlayer);
            }
        },
        
        // Generate energy and draw card
        {
            name: 'generateEnergyAndDrawCard',
            run: (controllers: Controllers) => {
                const currentPlayer = controllers.turn.get();
                
                // Generate energy for current player
                controllers.energy.generateEnergy(currentPlayer);
                
                // Draw card and show summary
                const opponentId = (currentPlayer + 1) % controllers.players.count;
                const cardRepo = controllers.cardRepository;
                
                const card = controllers.hand.drawCard(currentPlayer);
                
                const myActive = controllers.field.getCardByPosition(currentPlayer, 0);
                const opponentActive = controllers.field.getCardByPosition(opponentId, 0);
                const myBench = controllers.field.getPlayedCards(currentPlayer).slice(1);
                const opponentBench = controllers.field.getPlayedCards(opponentId).slice(1);
                
                // Convert to CreatureInfo format
                const myActiveInfo = myActive ? {
                    name: cardRepo.getCreature(myActive.templateId).name,
                    hp: Math.max(0, cardRepo.getCreature(myActive.templateId).maxHp - myActive.damageTaken),
                    maxHp: cardRepo.getCreature(myActive.templateId).maxHp
                } : { name: 'None', hp: 0, maxHp: 0 };
                
                const opponentActiveInfo = opponentActive ? {
                    name: cardRepo.getCreature(opponentActive.templateId).name,
                    hp: Math.max(0, cardRepo.getCreature(opponentActive.templateId).maxHp - opponentActive.damageTaken),
                    maxHp: cardRepo.getCreature(opponentActive.templateId).maxHp
                } : { name: 'None', hp: 0, maxHp: 0 };
                
                const myBenchInfo = myBench.map((card: any) => ({
                    name: cardRepo.getCreature(card.templateId).name,
                    hp: Math.max(0, cardRepo.getCreature(card.templateId).maxHp - card.damageTaken),
                    maxHp: cardRepo.getCreature(card.templateId).maxHp
                }));
                
                const opponentBenchInfo = opponentBench.map((card: any) => ({
                    name: cardRepo.getCreature(card.templateId).name,
                    hp: Math.max(0, cardRepo.getCreature(card.templateId).maxHp - card.damageTaken),
                    maxHp: cardRepo.getCreature(card.templateId).maxHp
                }));
                
                const handCards = controllers.hand.getHand(currentPlayer)
                    .map((card: GameCard) => {
                        // Handle different card types
                        if (card.type === 'creature') {
                            return cardRepo.getCreature(card.templateId).name;
                        } else if (card.type === 'supporter') {
                            return cardRepo.getSupporter(card.templateId).name;
                        } else if (card.type === 'item') {
                            return cardRepo.getItem(card.templateId).name;
                        } else if (card.type === 'tool') {
                            return cardRepo.getTool(card.templateId).name;
                        } else {
                            return (card as { templateId?: string }).templateId || 'unknown'; // fallback
                        }
                    })
                    .join(', ');
                
                const drawnCardName = card ? (() => {
                    // Handle different card types for drawn card
                    if (card.type === 'creature') {
                        return cardRepo.getCreature(card.templateId).name;
                    } else if (card.type === 'supporter') {
                        return cardRepo.getSupporter(card.templateId).name;
                    } else if (card.type === 'item') {
                        return cardRepo.getItem(card.templateId).name;
                    } else if (card.type === 'tool') {
                        return cardRepo.getTool(card.templateId).name;
                    } else {
                        return (card as { templateId?: string }).templateId || 'unknown'; // fallback
                    }
                })() : undefined;
                
                controllers.players.message(currentPlayer, new TurnSummaryMessage(myActiveInfo, opponentActiveInfo, myBenchInfo, opponentBenchInfo, handCards, drawnCardName));
            }
        },
        
        // Handle player actions until a card is knocked out or turn ends
        handlePlayerActions,
        
        // Checkup Phase - process status effects
        {
            name: 'checkupPhase',
            run: (controllers: Controllers) => {
                const currentPlayer = controllers.turn.get();
                
                // Process between-turn damage for both players
                for (let playerId = 0; playerId < 2; playerId++) {
                    const damageResult = controllers.statusEffects.processBetweenTurnEffects(playerId);
                    
                    try {
                        // Make sure the card exists before applying damage
                        const activeCard = controllers.field.getCardByPosition(playerId, 0);
                    if (activeCard) {
                        if (damageResult.poisonDamage > 0) {
                            const actualDamage = controllers.field.applyDamage(playerId, damageResult.poisonDamage);
                            controllers.players.messageAll({
                                type: 'status-effect-damage',
                                components: [`Player ${playerId + 1}'s card takes ${damageResult.poisonDamage} poison damage!`]
                            });
                        }
                        
                        if (damageResult.burnDamage > 0) {
                            const actualDamage = controllers.field.applyDamage(playerId, damageResult.burnDamage);
                            controllers.players.messageAll({
                                type: 'status-effect-damage', 
                                components: [`Player ${playerId + 1}'s card takes ${damageResult.burnDamage} burn damage!`]
                            });
                        }
                    }
                } catch (error) {
                    // If the card doesn't exist (e.g., knocked out), log the error but don't crash
                    console.error(`Error applying status effect damage to player ${playerId}:`, error);
                }
                }
                
                // Process end-of-turn status effect checks for current player
                const endOfTurnResult = controllers.statusEffects.processEndOfTurnChecks(currentPlayer);
                
                // Clear persistent effects at end of turn (they last "during opponent's next turn")
            }
        },
        
        // Check for knockouts after checkup phase
        conditionalState({
            id: 'checkKnockoutsAfterCheckup',
            condition: isCardKnockedOut,
            truthy: handleKnockout,
        }),
        
        // Advance to the next player's turn
        { 
            name: 'nextTurn',
            run: (controllers: Controllers) => {
                if (!isGameOver(controllers)) {
                    // Mark first turn complete after first player's turn
                    if (controllers.energy.isFirstTurnRestricted()) {
                        controllers.energy.markFirstTurnComplete();
                    }
                    
                    controllers.turn.next();
                    // Only advance turn counter after both players have played
                    if (controllers.turn.get() === 0) {
                        controllers.turnCounter.advanceTurn();
                    }
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
        
        // Set energy types for each player based on their deck
        for (let i = 0; i < controllers.players.count; i++) {
            const energyTypes = controllers.deck.getPlayerEnergyTypes(i);
            controllers.energy.setAvailableTypes(i, energyTypes);
        }
        
        // Draw initial hands
        for (let i = 0; i < controllers.players.count; i++) {
            controllers.hand.drawInitialHand(i);
        }
        
        // Players will set up their cards during setup phase
    },
    sequence<Controllers>([
        // Setup phase - each player sets up their cards
        loop<Controllers>({
            id: 'setupLoop',
            breakingIf: (controllers: Controllers) => controllers.setup.isSetupComplete(),
            run: handleSingle({
                handler: 'setup',
                position: (controllers: Controllers) => controllers.turn.get()
            }),
            afterEach: (controllers: Controllers) => {
                if (!controllers.setup.isSetupComplete()) {
                    controllers.turn.next();
                }
            },
            afterAll: () => { },
        }),
        
        // Main game turns
        gameTurn
    ]),
    (controllers: Controllers) => {
        // Game over logic is handled in the turn handler
    },
);
