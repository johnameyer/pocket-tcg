import { sequence, loop, game, conditionalState, handleSingle } from '@cards-ts/state-machine';
import { Controllers } from './controllers/controllers.js';
import { GameOverMessage, KnockedOutMessage, TurnSummaryMessage } from './messages/status/index.js';
import { EffectQueueProcessor } from './effects/effect-queue-processor.js';
import { CreatureData } from './repository/card-types.js';
import { isPendingEnergySelection, isPendingCardSelection } from './effects/pending-selection-types.js';

// Helper function to calculate points awarded for knocking out a creature
const calculateKnockoutPoints = (creatureData: CreatureData): number => {
    if (creatureData.attributes?.ex && creatureData.attributes?.mega) {
        return 3; // Mega ex cards
    } else if (creatureData.attributes?.ex) {
        return 2; // Regular ex cards
    } 
    return 1; // Basic cards
    
};

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
                    
                    // Get field instance ID for cleanup
                    const fieldInstanceId = controllers.field.getFieldInstanceId(i, 0);
                    if (fieldInstanceId) {
                        // Clean up energy attached to the knocked out card
                        controllers.energy.removeAllEnergyFromInstance(i, fieldInstanceId);
                        
                        // Clean up passive effects from the knocked out card's ability
                        controllers.effects.clearEffectsForInstance(fieldInstanceId);
                        
                        // Clean up tools and their effects attached to the knocked out card
                        const attachedTool = controllers.tools.getAttachedTool(fieldInstanceId);
                        if (attachedTool) {
                            controllers.effects.clearEffectsForTool(attachedTool.instanceId, fieldInstanceId);
                        }
                        controllers.tools.detachTool(fieldInstanceId);
                    }
                    
                    // Award points to the opponent
                    const opponentId = (i + 1) % controllers.players.count;
                    const pointsToAward = calculateKnockoutPoints(cardData);
                    controllers.points.increaseScore(opponentId, pointsToAward);
                    
                    // Note: Card will be automatically discarded when promoteToBattle is called
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
                    
                    // Get field instance ID for cleanup (benchIndex + 1 because bench starts at position 1)
                    const fieldInstanceId = controllers.field.getFieldInstanceId(i, benchIndex + 1);
                    if (fieldInstanceId) {
                        // Clean up energy attached to the knocked out card
                        controllers.energy.removeAllEnergyFromInstance(i, fieldInstanceId);
                        
                        // Clean up passive effects from the knocked out card's ability
                        controllers.effects.clearEffectsForInstance(fieldInstanceId);
                        
                        // Clean up tools and their effects attached to the knocked out card
                        const attachedTool = controllers.tools.getAttachedTool(fieldInstanceId);
                        if (attachedTool) {
                            controllers.effects.clearEffectsForTool(attachedTool.instanceId, fieldInstanceId);
                        }
                        controllers.tools.detachTool(fieldInstanceId);
                    }
                    
                    // Award points to the opponent
                    const opponentId = (i + 1) % controllers.players.count;
                    const pointsToAward = calculateKnockoutPoints(cardData);
                    controllers.points.increaseScore(opponentId, pointsToAward);
                    
                    // Remove the knocked out bench card (automatically discards)
                    controllers.field.removeBenchCard(i, benchIndex);
                }
            }
        }
    },
};

// Check for game over conditions and handle them
const handleGameOver = sequence<Controllers>([
    // Send game over message
    { 
        name: 'sendGameOverMessage',
        run: (controllers: Controllers) => {
            // Check if game ended due to turn limit
            if (controllers.turnCounter.isMaxTurnsReached()) {
                controllers.players.messageAll(new GameOverMessage('Tie - Turn limit reached'));
            } else {
                const winnerName = getWinner(controllers);
                if (winnerName) {
                    controllers.players.messageAll(new GameOverMessage(winnerName));
                }
            }
        },
    },
    { 
        name: 'completeGame', 
        run: (controllers: Controllers) => controllers.completed.complete(),
    },
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
                    position: getPlayerNeedingSelection,
                }),
                // TODO Condition is not re-evaluated for some reason without afterEach...
                afterEach: () => {},
            }),
        }),
    }),
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
            maxHp: cardRepo.getCreature(myCard.templateId).maxHp,
        } : { name: 'None', hp: 0, maxHp: 0 };
        
        const opponentCardInfo = opponentCard ? {
            name: cardRepo.getCreature(opponentCard.templateId).name,
            hp: Math.max(0, cardRepo.getCreature(opponentCard.templateId).maxHp - opponentCard.damageTaken),
            maxHp: cardRepo.getCreature(opponentCard.templateId).maxHp,
        } : { name: 'None', hp: 0, maxHp: 0 };
        
        const myBenchInfo = myBench.map(card => ({
            name: cardRepo.getCreature(card.templateId).name,
            hp: Math.max(0, cardRepo.getCreature(card.templateId).maxHp - card.damageTaken),
            maxHp: cardRepo.getCreature(card.templateId).maxHp,
        }));
        
        const opponentBenchInfo = opponentBench.map(card => ({
            name: cardRepo.getCreature(card.templateId).name,
            hp: Math.max(0, cardRepo.getCreature(card.templateId).maxHp - card.damageTaken),
            maxHp: cardRepo.getCreature(card.templateId).maxHp,
        }));
        
        const handCards = controllers.hand.getHand(currentPlayer)
            .map(card => cardRepo.getCreature(card.templateId).name)
            .join(', ');
        
        const drawnCardName = card ? cardRepo.getCreature(card.templateId).name : undefined;
        
        controllers.players.message(currentPlayer, new TurnSummaryMessage(myCardInfo, opponentCardInfo, myBenchInfo, opponentBenchInfo, handCards, drawnCardName));
    },
};

// Check if there's a pending selection that needs to be resolved
const hasPendingSelection = (controllers: Controllers) => {
    return controllers.turnState.getPendingSelection() !== undefined;
};

// Get the player who needs to make a selection (depends on effect context)
const getPlayerNeedingPendingSelection = (controllers: Controllers) => {
    const pendingSelection = controllers.turnState.getPendingSelection();
    if (!pendingSelection) {
        return -1;
    }
    
    // Determine which player should make the selection based on the effect context
    const context = pendingSelection.originalContext;
    
    if (pendingSelection.selectionType === 'field') {
        // For field selections, check if opponent should choose
        const effect = pendingSelection.effect;
        if ('target' in effect && effect.target && typeof effect.target === 'object' && 'chooser' in effect.target) {
            const chooser = effect.target.chooser;
            if (chooser === 'opponent') {
                // Opponent of source player chooses
                return (context.sourcePlayer + 1) % controllers.players.count;
            }
        }
    } else if (pendingSelection.selectionType === 'energy') {
        // For energy selection, use the specified player
        if (isPendingEnergySelection(pendingSelection)) {
            return pendingSelection.playerId;
        }
    } else if (pendingSelection.selectionType === 'card') {
        // For card selection, use the specified player
        if (isPendingCardSelection(pendingSelection)) {
            return pendingSelection.playerId;
        }
    } else if (pendingSelection.selectionType === 'choice') {
        // For choice selection, default to source player
        return context.sourcePlayer;
    }
    
    // Default to source player
    return context.sourcePlayer;
};

// Handle pending selections in a loop
const handlePendingSelections = loop<Controllers>({
    id: 'pendingSelectionLoop',
    breakingIf: (controllers: Controllers) => !hasPendingSelection(controllers),
    run: sequence<Controllers>([
        conditionalState({
            id: 'handleFieldSelection',
            condition: (controllers: Controllers) => {
                const pending = controllers.turnState.getPendingSelection();
                return pending?.selectionType === 'field';
            },
            truthy: handleSingle({
                handler: 'selectTarget',
                position: getPlayerNeedingPendingSelection,
            }),
        }),
        conditionalState({
            id: 'handleFieldSelection',
            condition: (controllers: Controllers) => {
                const pending = controllers.turnState.getPendingSelection();
                return pending?.selectionType === 'field';
            },
            truthy: handleSingle({
                handler: 'selectTarget',
                position: getPlayerNeedingPendingSelection,
            }),
        }),
        conditionalState({
            id: 'handleEnergySelection',
            condition: (controllers: Controllers) => {
                const pending = controllers.turnState.getPendingSelection();
                return pending?.selectionType === 'energy';
            },
            truthy: handleSingle({
                handler: 'selectEnergy',
                position: getPlayerNeedingPendingSelection,
            }),
        }),
        conditionalState({
            id: 'handleCardSelection',
            condition: (controllers: Controllers) => {
                const pending = controllers.turnState.getPendingSelection();
                return pending?.selectionType === 'card';
            },
            truthy: handleSingle({
                handler: 'selectCard',
                position: getPlayerNeedingPendingSelection,
            }),
        }),
        conditionalState({
            id: 'handleChoiceSelection',
            condition: (controllers: Controllers) => {
                const pending = controllers.turnState.getPendingSelection();
                return pending?.selectionType === 'choice';
            },
            truthy: handleSingle({
                handler: 'selectChoice',
                position: getPlayerNeedingPendingSelection,
            }),
        }),
    ]),
    // TODO Condition is not re-evaluated for some reason without afterEach...
    afterEach: () => {},
});

// Handle player actions
const handlePlayerActions = loop<Controllers>({
    id: 'actionLoop',
    breakingIf: (controllers: Controllers) => controllers.turnState.getShouldEndTurn(),
    run: sequence<Controllers>([
        // Handle player action
        handleSingle({
            handler: 'action',
            position: (controllers: Controllers) => controllers.turn.get(),
        }),
        // Handle any pending selections after the action
        conditionalState({
            id: 'checkPendingSelections',
            condition: hasPendingSelection,
            truthy: handlePendingSelections,
        }),
        // Check for knockouts after each action
        conditionalState({
            id: 'checkKnockouts',
            condition: isCardKnockedOut,
            truthy: handleKnockout,
        }),
    ]),
    // TODO Condition is not re-evaluated for some reason without afterEach...
    afterEach: () => {},
});

// Basic game turn
const gameTurn = loop<Controllers>({
    id: 'gameTurnLoop',
    breakingIf: (controllers: Controllers) => {
        const shouldBreak = controllers.turnCounter.isMaxTurnsReached() || isGameOver(controllers);
        return shouldBreak;
    },
    run: sequence<Controllers>([
        // Reset turn state at the start of each turn
        {
            name: 'resetTurnState',
            run: (controllers: Controllers) => {
                const currentPlayer = controllers.turn.get();
                controllers.turnState.startTurn();
                // Clear effects that expired at the end of the next turn
                controllers.effects.clearEndOfNextTurnEffects(controllers.turnCounter.getTurnNumber());
                // No need to reset energy flags - energy attachment is tracked by currentEnergy being null
            },
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
                    maxHp: cardRepo.getCreature(myActive.templateId).maxHp,
                } : { name: 'None', hp: 0, maxHp: 0 };
                
                const opponentActiveInfo = opponentActive ? {
                    name: cardRepo.getCreature(opponentActive.templateId).name,
                    hp: Math.max(0, cardRepo.getCreature(opponentActive.templateId).maxHp - opponentActive.damageTaken),
                    maxHp: cardRepo.getCreature(opponentActive.templateId).maxHp,
                } : { name: 'None', hp: 0, maxHp: 0 };
                
                const myBenchInfo = myBench.map(card => ({
                    name: cardRepo.getCreature(card.templateId).name,
                    hp: Math.max(0, cardRepo.getCreature(card.templateId).maxHp - card.damageTaken),
                    maxHp: cardRepo.getCreature(card.templateId).maxHp,
                }));
                
                const opponentBenchInfo = opponentBench.map(card => ({
                    name: cardRepo.getCreature(card.templateId).name,
                    hp: Math.max(0, cardRepo.getCreature(card.templateId).maxHp - card.damageTaken),
                    maxHp: cardRepo.getCreature(card.templateId).maxHp,
                }));
                
                const handCards = controllers.hand.getHand(currentPlayer)
                    .map(card => {
                        // Handle different card types
                        if (card.type === 'creature') {
                            return cardRepo.getCreature(card.templateId).name;
                        } else if (card.type === 'supporter') {
                            return cardRepo.getSupporter(card.templateId).name;
                        } else if (card.type === 'item') {
                            return cardRepo.getItem(card.templateId).name;
                        } else if (card.type === 'tool') {
                            return cardRepo.getTool(card.templateId).name;
                        } 
                        return (card as { templateId?: string }).templateId || 'unknown'; // fallback
                        
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
                    } 
                    return (card as { templateId?: string }).templateId || 'unknown'; // fallback
                    
                })() : undefined;
                
                controllers.players.message(currentPlayer, new TurnSummaryMessage(myActiveInfo, opponentActiveInfo, myBenchInfo, opponentBenchInfo, handCards, drawnCardName));
            },
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
                                    components: [ `Player ${playerId + 1}'s card takes ${damageResult.poisonDamage} poison damage!` ],
                                });
                            }
                        
                            if (damageResult.burnDamage > 0) {
                                const actualDamage = controllers.field.applyDamage(playerId, damageResult.burnDamage);
                                controllers.players.messageAll({
                                    type: 'status-effect-damage', 
                                    components: [ `Player ${playerId + 1}'s card takes ${damageResult.burnDamage} burn damage!` ],
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
                
                // Process any effects that were triggered during the checkup phase
                EffectQueueProcessor.processQueue(controllers);
                
                // Clear persistent effects at end of turn (they last "during opponent's next turn")
            },
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
                    // Advance turn counter after each player's turn
                    controllers.turnCounter.advanceTurn();
                }
            },
        },
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
        
        // Initialize hands once for all players
        controllers.hand.initialize(controllers.players.count);
        
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
                position: (controllers: Controllers) => controllers.turn.get(),
            }),
            afterEach: (controllers: Controllers) => {
                if (!controllers.setup.isSetupComplete()) {
                    controllers.turn.next();
                }
            },
            afterAll: () => { },
        }),
        
        // Main game turns
        gameTurn,
        
        // Handle turn limit tie
        conditionalState({
            id: 'turnLimitCheck',
            condition: (controllers: Controllers) => controllers.turnCounter.isMaxTurnsReached(),
            truthy: handleGameOver,
        }),
    ]),
    (controllers: Controllers) => {
        // Game over logic is handled in the turn handler
    },
);
