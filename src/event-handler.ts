import { Controllers } from './controllers/controllers.js';
import { ResponseMessage } from './messages/response-message.js';
import { EventHandler, buildEventHandler } from '@cards-ts/core';
import { SelectActiveCardResponseMessage, SetupCompleteResponseMessage, EvolveResponseMessage, AttackResponseMessage, PlayCardResponseMessage, EndTurnResponseMessage } from './messages/response/index.js';
import { AttackResultMessage, HealResultMessage, EvolutionMessage } from './messages/status/index.js';
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
 * - SelectActiveCardResponseMessage: Corrects invalid bench index to valid one
 * - SetupCompleteResponseMessage: Provides fallback card selection
 * - EndTurnResponseMessage: Always valid, no correction needed
 */
export const eventHandler = buildEventHandler<Controllers, ResponseMessage>({
    'select-active-card-response': {
        validateEvent: {
            validators: [
                EventHandler.validate('Invalid bench index', (controllers: Controllers, source: number, message: SelectActiveCardResponseMessage) => {
                    const benchedCards = controllers.field.getBenchedCards(source);
                    return message.benchIndex < 0 || message.benchIndex >= benchedCards.length;
                }),
            ],
            fallback: (controllers: Controllers, source: number, message: SelectActiveCardResponseMessage) => {
                // Smart fallback: correct invalid bench index to valid one
                const benchedCards = controllers.field.getBenchedCards(source);
                if (benchedCards.length > 0) {
                    const validIndex = Math.max(0, Math.min(message.benchIndex, benchedCards.length - 1));
                    return new SelectActiveCardResponseMessage(validIndex);
                }
                // No valid cards available - forfeit
                controllers.waiting.removePosition(source);
                controllers.turnState.setShouldEndTurn(true);
                return undefined as any;
            },
        },
        merge: (controllers: Controllers, sourceHandler: number, message: SelectActiveCardResponseMessage) => {
            controllers.waiting.removePosition(sourceHandler);
            controllers.field.promoteToBattle(sourceHandler, message.benchIndex);
            
            const newActiveCard = controllers.field.getActiveCard(sourceHandler);
            controllers.players.messageAll({
                type: 'card-switch',
                components: [`Player ${sourceHandler + 1} sent out ${newActiveCard.name}!`]
            });
        }
    },
    'attack-response': {
        canRespond: EventHandler.isTurn('turn'),
        validateEvent: {
            validators: [
                EventHandler.validate('Invalid attack index', (controllers: Controllers, source: number, message: AttackResponseMessage) => {
                    const playerCard = controllers.field.getActiveCard(source);
                    const cardData = controllers.cardRepository.getCreature(playerCard.cardId);
                    return message.attackIndex < 0 || message.attackIndex >= cardData.attacks.length;
                }),
            ],
            fallback: (controllers: Controllers, source: number, message: AttackResponseMessage) => {
                // Forfeit on invalid attack
                controllers.waiting.removePosition(source);
                controllers.turnState.setShouldEndTurn(true);
                return undefined as any;
            },
        },
        merge: (controllers: Controllers, sourceHandler: number, message: AttackResponseMessage) => {
            controllers.waiting.removePosition(sourceHandler);
            
            const attackResult = controllers.field.attack(sourceHandler, message.attackIndex);
            const playerCard = controllers.field.getActiveCard(sourceHandler);
            const { attacks } = controllers.cardRepository.getCreature(playerCard.cardId);
            const attackName = attacks[message.attackIndex].name;
            
            controllers.players.messageAll(new AttackResultMessage(
                attackResult.attacker.name,
                attackName,
                attackResult.damage,
                attackResult.target.name,
                attackResult.target.hp
            ));
            
            controllers.turnState.setShouldEndTurn(true);
        }
    },
    'play-card-response': {
        canRespond: EventHandler.isTurn('turn'),
        validateEvent: {
            validators: [
                EventHandler.validate('Card not in hand', (controllers: Controllers, source: number, message: PlayCardResponseMessage) => {
                    const hand = controllers.hand.getHand(source);
                    return !hand.some(card => card.cardId === message.cardId);
                }),
                EventHandler.validate('Supporter already played this turn', (controllers: Controllers, source: number, message: PlayCardResponseMessage) => {
                    return message.cardType === 'supporter' && controllers.turnState.hasSupporterBeenPlayedThisTurn();
                }),
                EventHandler.validate('Bench is full', (controllers: Controllers, source: number, message: PlayCardResponseMessage) => {
                    const benchSize = controllers.field.getBenchedCards(source).length;
                    return message.cardType === 'creature' && benchSize >= 3;
                }),
            ],
            fallback: (controllers: Controllers, source: number, message: PlayCardResponseMessage) => {
                // Forfeit on invalid card play
                controllers.waiting.removePosition(source);
                controllers.turnState.setShouldEndTurn(true);
                return undefined as any;
            },
        },
        merge: (controllers: Controllers, sourceHandler: number, message: PlayCardResponseMessage) => {
            controllers.waiting.removePosition(sourceHandler);
            
            if (message.cardType === 'creature') {
                controllers.field.addToBench(sourceHandler, message.cardId);
                const { name } = controllers.cardRepository.getCreature(message.cardId);
                controllers.players.messageAll({
                    type: 'card-played',
                    components: [`Player ${sourceHandler + 1} played ${name} to the bench!`]
                });
            } else if (message.cardType === 'supporter') {
                controllers.turnState.setSupporterPlayedThisTurn(true);
            }
            
            const hand = controllers.hand.getHand(sourceHandler);
            const cardIndex = hand.findIndex(card => card.cardId === message.cardId);
            if (cardIndex !== -1) {
                controllers.hand.playCard(sourceHandler, cardIndex);
            }
            
            controllers.turnState.setShouldEndTurn(false);
        }
    },
    'end-turn-response': {
        canRespond: EventHandler.isTurn('turn'),
        merge: (controllers: Controllers, sourceHandler: number, message: EndTurnResponseMessage) => {
            controllers.players.messageAll({
                type: 'turn-ended',
                components: [`Player ${sourceHandler + 1} ended their turn.`]
            });
            controllers.turnState.setShouldEndTurn(true);
        }
    },
    'setup-complete': {
        canRespond: EventHandler.isTurn('turn'),
        validateEvent: {
            validators: [
                EventHandler.validate('Invalid active card', (controllers: Controllers, source: number, message: SetupCompleteResponseMessage) => {
                    const hand = controllers.hand.getHand(source);
                    return !hand.some(card => card.cardId === message.activeCardId && card.type === 'creature');
                }),
                EventHandler.validate('Invalid bench cards', (controllers: Controllers, source: number, message: SetupCompleteResponseMessage) => {
                    const hand = controllers.hand.getHand(source);
                    return message.benchCardIds.some(cardId => 
                        !hand.some(card => card.cardId === cardId && card.type === 'creature')
                    );
                }),
            ],
            fallback: (controllers: Controllers, source: number, message: SetupCompleteResponseMessage) => {
                // Smart fallback: provide fallback card selection
                const hand = controllers.hand.getHand(source);
                const creatureCards = hand.filter(card => card.type === 'creature');
                
                if (creatureCards.length > 0) {
                    const activeCardId = creatureCards[0].cardId;
                    const benchCardIds = creatureCards.slice(1, Math.min(4, creatureCards.length)).map(card => card.cardId);
                    return new SetupCompleteResponseMessage(activeCardId, benchCardIds);
                }
                
                // No creatures available - forfeit
                controllers.waiting.removePosition(source);
                controllers.turnState.setShouldEndTurn(true);
                return undefined as any;
            },
        },
        merge: (controllers: Controllers, source: number, message: SetupCompleteResponseMessage) => {
            controllers.waiting.removePosition(source);
            
            const hand = controllers.hand.getHand(source);
            const activeCardToRemove = { id: message.activeCardId, cardId: message.activeCardId, type: 'creature' as const };
            controllers.hand.removeCards(source, [activeCardToRemove]);
            controllers.field.setActiveCard(source, message.activeCardId);
            
            for (const cardId of message.benchCardIds) {
                const benchCardToRemove = { id: cardId, cardId, type: 'creature' as const };
                controllers.hand.removeCards(source, [benchCardToRemove]);
                controllers.field.addToBench(source, cardId);
            }
            
            controllers.setup.setPlayerReady(source);
        }
    },
    'evolve-response': {
        canRespond: EventHandler.isTurn('turn'),
        validateEvent: {
            validators: [
                EventHandler.validate('Evolution card not in hand', (controllers: Controllers, source: number, message: EvolveResponseMessage) => {
                    const hand = controllers.hand.getHand(source);
                    return !hand.some(card => card.cardId === message.evolutionId);
                }),
                EventHandler.validate('Invalid evolution target', (controllers: Controllers, source: number, message: EvolveResponseMessage) => {
                    if (message.isActive) {
                        return !controllers.field.getActiveCard(source);
                    } else if (message.benchIndex !== undefined) {
                        const benchedCards = controllers.field.getBenchedCards(source);
                        return message.benchIndex < 0 || message.benchIndex >= benchedCards.length;
                    }
                    return true; // Neither active nor valid bench specified
                }),
            ],
            fallback: (controllers: Controllers, source: number, message: EvolveResponseMessage) => {
                // Forfeit on invalid evolution
                controllers.waiting.removePosition(source);
                controllers.turnState.setShouldEndTurn(true);
                return undefined as any;
            },
        },
        merge: (controllers: Controllers, sourceHandler: number, message: EvolveResponseMessage) => {
            controllers.waiting.removePosition(sourceHandler);
            
            const hand = controllers.hand.getHand(sourceHandler);
            const evolutionCardIndex = hand.findIndex(card => card.cardId === message.evolutionId);
            if (evolutionCardIndex === -1) return;
            
            if (message.isActive) {
                controllers.field.evolveActiveCard(sourceHandler, message.evolutionId);
            } else if (message.benchIndex !== undefined) {
                controllers.field.evolveBenchedCard(sourceHandler, message.benchIndex, message.evolutionId);
            }
            
            controllers.hand.playCard(sourceHandler, evolutionCardIndex);
            
            const { name } = controllers.cardRepository.getCreature(message.evolutionId);
            controllers.players.messageAll(new EvolutionMessage(
                'Previous Form',
                name,
                `Player ${sourceHandler + 1}`
            ));
            
            controllers.turnState.setShouldEndTurn(false);
        }
    }
});
