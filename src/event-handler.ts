import { Controllers } from './controllers/controllers.js';
import { ResponseMessage } from './messages/response-message.js';
import { EventHandler, buildEventHandler } from '@cards-ts/core';
import { SelectActiveCardResponseMessage, ActionResponseMessage } from './messages/response/index.js';
import { AttackResultMessage, HealResultMessage } from './messages/status/index.js';
import { GameCard } from './controllers/card-types.js';

/**
 * FALLBACK HANDLING NOTES:
 * 
 * The fallback return value BECOMES the event that gets processed by the merge function.
 * 
 * INCORRECT: return new XResponseMessage() 
 * - This bypasses validation and executes the invalid action anyway
 * - Only use for "smart fallbacks" that correct invalid input to valid input
 * 
 * CORRECT: return undefined as any
 * - This discards the message and prevents any action from executing
 * - Use for true validation failures that should forfeit the turn
 * 
 * Standard forfeit pattern:
 * 1. Remove waiting position: controllers.waiting.removePosition(source)
 * 2. End the turn: controllers.turnState.setShouldEndTurn(true)
 * 3. Return undefined as any to discard the message
 * 
 * Smart fallback exceptions:
 * - SelectActivePokemonResponseMessage: Corrects invalid bench index to valid one
 * - SetupCompleteResponseMessage: Provides fallback Pokemon selection
 * - EndTurnResponseMessage: Always valid, no correction needed
 */
export const eventHandler = buildEventHandler<Controllers, ResponseMessage>({
    'select-active-card-response': {
        validateEvent: {
            validators: [
                EventHandler.validate('Invalid bench index', (controllers: Controllers, source: number, message: SelectActiveCardResponseMessage) => {
                    const playerId = source;
                    const benchedCards = controllers.field.getBenchedCards(playerId);
                    
                    return message.benchIndex < 0 || message.benchIndex >= benchedCards.length;
                }),
            ],
            fallback: (controllers: Controllers, source: number, message: SelectActiveCardResponseMessage) => {
                // Default to first benched card if invalid
                return new SelectActiveCardResponseMessage(0);
            },
        },
        merge: (controllers: Controllers, sourceHandler: number, message: SelectActiveCardResponseMessage) => {
            // Remove waiting status
            controllers.waiting.removePosition(sourceHandler);
            
            // Use the sourceHandler position instead of message.playerId
            const playerId = sourceHandler;
            
            // Promote the selected card from bench to active
            controllers.field.promoteToBattle(playerId, message.benchIndex);
            
            // Announce the new card
            const newActiveCard = controllers.field.getActiveCard(playerId);
            controllers.players.messageAll({
                type: 'card-switch',
                components: [`Player ${playerId + 1} sent out ${newActiveCard.name}!`]
            });
        }
    },
    'action-response': {
        validateEvent: {
            validators: [
                EventHandler.validate('Invalid attack index', (controllers: Controllers, source: number, message: ActionResponseMessage) => {
                    if (message.action && message.action.type === 'attack') {
                        const currentPlayer = source;
                        const playerCard = controllers.field.getActiveCard(currentPlayer);
                        const cardData = controllers.cardRepository.getCreature(playerCard.cardId);
                        
                        return cardData === undefined || 
                            message.action.attackIndex < 0 || 
                            message.action.attackIndex >= cardData.attacks.length;
                    }
                    return false;
                }),
                EventHandler.validate('Invalid card play', (controllers: Controllers, source: number, message: ActionResponseMessage) => {
                    if (message.action && message.action.type === 'play') {
                        const currentPlayer = source;
                        const handSize = controllers.hand.getHandSize(currentPlayer);
                        
                        // Check if hand is empty or card index is invalid
                        return handSize === 0 || 
                            message.action.cardIndex < 0 || 
                            message.action.cardIndex >= handSize;
                    }
                    return false;
                }),
                EventHandler.validate('Supporter already played this turn', (controllers: Controllers, source: number, message: ActionResponseMessage) => {
                    if (message.action && message.action.type === 'play') {
                        const currentPlayer = source;
                        const handSize = controllers.hand.getHandSize(currentPlayer);
                        
                        if (message.action.cardIndex >= 0 && message.action.cardIndex < handSize) {
                            const card = controllers.hand.getHand(currentPlayer)[message.action.cardIndex];
                            
                            // Check if it's a supporter card and one has already been played this turn
                            return card.type === 'supporter' && controllers.turnState.hasSupporterBeenPlayedThisTurn();
                        }
                    }
                    return false;
                }),
                EventHandler.validate('Bench is full', (controllers: Controllers, source: number, message: ActionResponseMessage) => {
                    if (message.action && message.action.type === 'play') {
                        const currentPlayer = source;
                        const handSize = controllers.hand.getHandSize(currentPlayer);
                        
                        if (message.action.cardIndex >= 0 && message.action.cardIndex < handSize) {
                            const card = controllers.hand.getHand(currentPlayer)[message.action.cardIndex];
                            const benchSize = controllers.field.getBenchedCards(currentPlayer).length;
                            
                            // Check if it's a creature card and bench is full
                            return card.type === 'creature' && benchSize >= 3;
                        }
                    }
                    return false;
                }),
            ],
            fallback: (controllers: Controllers, source: number, message: ActionResponseMessage) => {
                // Default to first attack if invalid
                return new ActionResponseMessage({ type: 'endTurn' });
            },
        },
        merge: (controllers: Controllers, sourceHandler: number, message: ActionResponseMessage) => {
            // Remove waiting status
            controllers.waiting.removePosition(sourceHandler);
            
            const currentPlayer = sourceHandler;
            
            // Handle different action types
            if (message.action.type === 'attack') {
                // Get player info
                const playerCard = controllers.field.getActiveCard(currentPlayer);
                const cardData = controllers.cardRepository.getCreature(playerCard.cardId);
                const attackName = cardData.attacks[message.action.attackIndex].name || "Attack";
                const targetId = (currentPlayer + 1) % controllers.players.count;
                
                // Perform attack
                const attackResult = controllers.field.attack(currentPlayer, message.action.attackIndex);
                
                // Send attack result message
                controllers.players.messageAll(new AttackResultMessage(
                    attackResult.attacker.name,
                    attackName,
                    attackResult.damage,
                    attackResult.target.name,
                    attackResult.target.hp
                ));
                
                // Always end turn after attack (knockout handling will happen in state machine)
                controllers.turnState.setShouldEndTurn(true);
            } else if (message.action.type === 'endTurn') {
                // Player chose to end their turn
                controllers.players.messageAll({
                    type: 'turn-ended',
                    components: [`Player ${currentPlayer + 1} ended their turn.`]
                });
                
                // Set flag to end turn
                controllers.turnState.setShouldEndTurn(true);
            } else if (message.action.type === 'play') {
                // Play a card from hand
                const cardIndex = message.action.cardIndex;
                const card = controllers.hand.playCard(currentPlayer, cardIndex) as GameCard;
                
                if (!card) {
                    return;
                }
                
                // Handle different card types
                if (card.type === 'creature') {
                    // Add the creature to the bench
                    controllers.field.addToBench(currentPlayer, card.cardId);
                    
                    // Announce the new card
                    const { name } = controllers.cardRepository.getCreature(card.cardId);
                    controllers.players.messageAll({
                        type: 'card-played',
                        components: [`Player ${currentPlayer + 1} played ${name} to the bench!`]
                    });
                    
                    // Don't end turn after playing a creature
                    controllers.turnState.setShouldEndTurn(false);
                } else if (card.type === 'item') {
                    // Get item data and apply effects
                    const itemData = controllers.cardRepository.getItem(card.cardId);
                    const targetPlayerId = message.action.targetPlayerId || currentPlayer;
                    const targetFieldIndex = message.action.targetFieldIndex || 0;
                    
                    if (itemData && itemData.effects) {
                        // Apply each effect
                        for (const effect of itemData.effects) {
                            if (effect.type === 'heal') {
                                // Get target creature (0 = active, 1+ = bench)
                                let targetCreature;
                                let actualHealing;
                                
                                if (targetFieldIndex === 0) {
                                    // Heal active card
                                    targetCreature = controllers.field.getActiveCard(targetPlayerId);
                                    actualHealing = controllers.field.healDamage(targetPlayerId, effect.amount);
                                } else {
                                    // Heal benched card
                                    const benchIndex = targetFieldIndex - 1;
                                    const benchedCards = controllers.field.getBenchedCards(targetPlayerId);
                                    if (benchIndex >= 0 && benchIndex < benchedCards.length) {
                                        targetCreature = benchedCards[benchIndex];
                                        actualHealing = controllers.field.healBenchedCard(targetPlayerId, benchIndex, effect.amount);
                                    } else {
                                        actualHealing = 0;
                                    }
                                }
                                
                                if (targetCreature && actualHealing && actualHealing > 0) {
                                    // Get field card name
                                    const { name, maxHp } = controllers.cardRepository.getCreature(targetCreature.cardId);
                                    const fieldCardName = name || 'Card';
                                    
                                    // Send healing result message
                                    controllers.players.messageAll(new HealResultMessage(
                                        fieldCardName,
                                        actualHealing,
                                        Math.max(0, (maxHp || 100) - targetCreature.damageTaken)
                                    ));
                                    
                                    controllers.players.messageAll({
                                        type: 'item-used',
                                        components: [`Player ${currentPlayer + 1} used ${itemData.name} on ${fieldCardName}!`]
                                    });
                                }
                            }
                        }
                    }
                    
                    // Don't end turn after using an item
                    controllers.turnState.setShouldEndTurn(false);
                } else if (card.type === 'supporter') {
                    // Get supporter data
                    const supporterData = controllers.cardRepository.getSupporter(card.cardId);
                    
                    if (supporterData && supporterData.actions && supporterData.actions.length > 0) {
                        // Use the first action by default
                        const action = supporterData.actions[0];
                        
                        // Handle different supporter actions
                        if (action.name === 'Research') {
                            // Draw 3 cards and track what was drawn
                            const drawnCards = [];
                            for (let i = 0; i < 3; i++) {
                                const card = controllers.hand.drawCard(currentPlayer);
                                if (card) {
                                    const cardName = controllers.cardRepository.getCreatureName(card.cardId);
                                    drawnCards.push(cardName);
                                }
                            }
                            
                            // Announce the supporter card use
                            controllers.players.messageAll({
                                type: 'supporter-used',
                                components: [`Player ${currentPlayer + 1} used ${supporterData.name}'s ${action.name} ability and drew 3 cards!`]
                            });
                            
                            // Announce the drawn cards to the player who drew them
                            if (drawnCards.length > 0) {
                                controllers.players.message(currentPlayer, {
                                    type: 'cards-drawn',
                                    components: [`You drew: ${drawnCards.join(', ')}`]
                                });
                            }
                            
                            // Mark that a supporter card has been played this turn
                            controllers.turnState.setSupporterPlayedThisTurn(true);
                        }
                    }
                    
                    // Don't end turn after using a supporter card
                    controllers.turnState.setShouldEndTurn(false);
                }
            }
        }
    }
});
