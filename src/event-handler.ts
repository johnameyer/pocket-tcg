// @ts-nocheck
import { Controllers } from './controllers/controllers.js';
import { ResponseMessage } from './messages/response-message.js';
import { EventHandler, buildEventHandler } from '@cards-ts/core';
import { SelectActiveCardResponseMessage, SetupCompleteResponseMessage, EvolveResponseMessage, AttackResponseMessage, PlayCardResponseMessage, EndTurnResponseMessage, AttachEnergyResponseMessage, UseAbilityResponseMessage, SelectTargetResponseMessage, RetreatResponseMessage } from './messages/response/index.js';
import { AttackResultMessage, HealResultMessage, EvolutionMessage } from './messages/status/index.js';
import { GameCard } from './controllers/card-types.js';
import { EffectApplier } from './effects/effect-applier.js';
import { EffectContextFactory } from './effects/effect-context.js';
import { TriggerProcessor } from './effects/trigger-processor.js';
import { AttachableEnergyType } from './controllers/energy-controller.js';
import { AttackDamageResolver } from './effects/attack-damage-resolver.js';
import { ActionValidator } from './effects/action-validator.js';
import { ControllerUtils } from './utils/controller-utils.js';
import { TargetResolver } from './effects/target-resolver.js';
import { effectHandlers } from './effects/handlers/effect-handlers-map.js';
import { EffectQueueProcessor } from './effects/effect-queue-processor.js';

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
 * - SelectActivecreatureResponseMessage: Corrects invalid bench index to valid one
 * - SetupCompleteResponseMessage: Provides fallback creature selection
 * - EndTurnResponseMessage: Always valid, no correction needed
 */
export const eventHandler = buildEventHandler<Controllers, ResponseMessage>({
    'select-active-card-response': {
        validateEvent: {
            validators: [
                EventHandler.validate('Invalid bench index', (controllers: Controllers, source: number, message: SelectActiveCardResponseMessage) => {
                    const benchedCards = controllers.field.getCards(source).slice(1);
                    return message.benchIndex < 0 || message.benchIndex >= benchedCards.length;
                }),
            ],
            fallback: (controllers: Controllers, source: number, message: SelectActiveCardResponseMessage) => {
                // Smart fallback: correct invalid bench index to valid one
                const benchedCards = controllers.field.getCards(source).slice(1);
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
            
            const newActiveCard = controllers.field.getCardByPosition(sourceHandler, 0);
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
                    const playerCard = controllers.field.getCardByPosition(source, 0);
                    const cardData = controllers.cardRepository.getCreature(playerCard.templateId);
                    return message.attackIndex < 0 || message.attackIndex >= cardData.attacks.length;
                }),
                EventHandler.validate('Insufficient energy for attack', (controllers: Controllers, source: number, message: AttackResponseMessage) => {
                    const fieldInstanceId = controllers.field.getFieldInstanceId(source, 0);
                    if (!fieldInstanceId) return true; // No card, can't attack
                    const playerCard = controllers.field.getCardByPosition(source, 0);
                    const { attacks } = controllers.cardRepository.getCreature(playerCard.templateId);
                    const attack = attacks[message.attackIndex];
                    
                    return !controllers.energy.canUseAttackByInstance(fieldInstanceId, attack.energyRequirements);
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
            
            const playerCard = controllers.field.getCardByPosition(sourceHandler, 0);
            const creatureData = controllers.cardRepository.getCreature(playerCard.templateId);
            const attack = creatureData.attacks[message.attackIndex];
            
            // Check for confusion before attacking
            const confusionResult = controllers.statusEffects.handleConfusionAttack(sourceHandler);
            if (!confusionResult.canAttack) {
                // Attack fails due to confusion, apply self-damage
                if (confusionResult.selfDamage > 0) {
                    controllers.field.applyDamage(sourceHandler, confusionResult.selfDamage, 0);
                }
                controllers.players.messageAll({
                    type: 'status',
                    components: [`${playerCard.templateId} is confused and hurt itself in its confusion!`]
                });
                controllers.turnState.setShouldEndTurn(true);
                return;
            }
            
            // Get target information
            const targetId = (sourceHandler + 1) % controllers.players.count;
            const targetCard = controllers.field.getCardByPosition(targetId, 0);
            
            // Process passive abilities for damage reduction BEFORE the attack
            if (targetCard) {
                const targetCreatureData = controllers.cardRepository.getCreature(targetCard.templateId);
                if (targetCreatureData.ability) {
                    const ability = targetCreatureData.ability;
                    if (ability.trigger.type === 'passive' && ability.effects) {
                        const effectName = `${targetCreatureData.name}'s ${ability.name}`;
                        const context = EffectContextFactory.createAttackContext(targetId, effectName, targetCard.instanceId);
                        
                        EffectApplier.applyEffects(ability.effects, controllers, context);
                    }
                }
            }
            
            // Use AttackDamageResolver to calculate damage including coin flips
            const resolvedDamage = AttackDamageResolver.resolveDamage(
                controllers,
                sourceHandler,
                message.attackIndex,
                playerCard.instanceId
            );
            
            const attackResult = controllers.field.attack(sourceHandler, message.attackIndex, resolvedDamage);
            
            // Trigger when-damaged effects for tools (Rocky Helmet, Poison Barb, etc.)
            if (attackResult.damage > 0 && attackResult.target.instanceId) {
                // Determine the player ID from the field
                let targetPlayerId = -1;
                for (let playerId = 0; playerId < 2; playerId++) {
                    const fieldCards = controllers.field.getCards(playerId);
                    if (fieldCards.some(card => card?.instanceId === attackResult.target.instanceId)) {
                        targetPlayerId = playerId;
                        break;
                    }
                }
                
                if (targetPlayerId !== -1) {
                    TriggerProcessor.processWhenDamaged(
                        controllers,
                        targetPlayerId,
                        attackResult.target.instanceId,
                        attackResult.target.templateId,
                        attackResult.damage
                    );
                    
                    // Process any effects that were triggered by the damage
                    EffectQueueProcessor.processQueue(controllers);
                }
            }
            
            // Process all non-damage boost attack effects AFTER the attack
            if (attack.effects) {
                const effectName = `${playerCard.templateId}'s ${attack.name}`;
                const context = EffectContextFactory.createAttackContext(sourceHandler, effectName, playerCard.instanceId);
                
                // Apply all attack effects (no damage boost effects to filter)
                if (attack.effects && attack.effects.length > 0) {
                    EffectApplier.applyEffects(attack.effects, controllers, context);
                    
                    // Process any effects that were triggered by the attack effects
                    EffectQueueProcessor.processQueue(controllers);
                }
            }
            
            controllers.players.messageAll(new AttackResultMessage(
                attackResult.attacker.name,
                attack.name,
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
                    return !hand.some(card => card.templateId === message.templateId);
                }),
                EventHandler.validate('Supporter already played this turn', (controllers: Controllers, source: number, message: PlayCardResponseMessage) => {
                    return message.cardType === 'supporter' && controllers.turnState.hasSupporterBeenPlayedThisTurn();
                }),
                EventHandler.validate('Cannot play evolved creature directly', (controllers: Controllers, source: number, message: PlayCardResponseMessage) => {
                    if (message.cardType === 'creature') {
                        const creatureData = controllers.cardRepository.getCreature(message.templateId);
                        return creatureData.evolvesFrom !== undefined;
                    }
                    return false;
                }),
                EventHandler.validate('Bench is full', (controllers: Controllers, source: number, message: PlayCardResponseMessage) => {
                    const benchSize = controllers.field.getCards(source).slice(1).length;
                    return message.cardType === 'creature' && benchSize >= 3;
                }),
                EventHandler.validate('Cannot attach tool when creature already has one', (controllers: Controllers, source: number, message: PlayCardResponseMessage) => {
                    if (message.cardType !== 'tool') return false;
                    const targetPlayerId = message.targetPlayerId ?? source;
                    const targetFieldIndex = message.targetFieldIndex ?? 0;
                    const fieldInstanceId = controllers.field.getFieldInstanceId(targetPlayerId, targetFieldIndex);
                    if (!fieldInstanceId) return true;
                    return !controllers.tools.canAttachTool(fieldInstanceId);
                }),
                EventHandler.validate('Item effects cannot be applied', (controllers: Controllers, source: number, message: PlayCardResponseMessage) => {
                    if (message.cardType !== 'item') return false;
                    
                    // Create proper HandlerData structure from controllers
                    const handlerData = ControllerUtils.createPlayerView(controllers, source);
                    
                    // Use ActionValidator to check if the item can be played
                    return !ActionValidator.canPlayCard(handlerData, controllers.cardRepository, message.templateId, source);
                }),
                EventHandler.validate('Supporter effects cannot be applied', (controllers: Controllers, source: number, message: PlayCardResponseMessage) => {
                    if (message.cardType !== 'supporter') return false;
                    
                    // Create proper HandlerData structure from controllers
                    const handlerData = ControllerUtils.createPlayerView(controllers, source);
                    
                    // Use ActionValidator to check if the supporter can be played
                    return !ActionValidator.canPlayCard(handlerData, controllers.cardRepository, message.templateId, source);
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
            
            // Use playCard to handle card removal properly and preserve instanceId
            const hand = controllers.hand.getHand(sourceHandler);
            const cardIndex = hand.findIndex(card => card.templateId === message.templateId);
            let cardInstanceId: string | undefined;
            let playedCard: GameCard | undefined;
            if (cardIndex !== -1) {
                playedCard = controllers.hand.playCard(sourceHandler, cardIndex);
                cardInstanceId = playedCard?.instanceId;
            }
            
            if (message.cardType === 'creature') {
                controllers.field.addToBench(sourceHandler, message.templateId, cardInstanceId);
                const { name } = controllers.cardRepository.getCreature(message.templateId);
                controllers.players.messageAll({
                    type: 'card-played',
                    components: [`Player ${sourceHandler + 1} played ${name} to the bench!`]
                });
            } else if (message.cardType === 'supporter') {
                controllers.turnState.setSupporterPlayedThisTurn(true);
                
                // Apply supporter effects
                const supporterData = controllers.cardRepository.getSupporter(message.templateId);
                const context = EffectContextFactory.createCardContext(sourceHandler, supporterData.name, 'supporter');
                
                // Add target information if provided
                if (message.targetPlayerId !== undefined) {
                    context.targetPlayerId = message.targetPlayerId;
                }
                if (message.targetFieldIndex !== undefined) {
                    context.targetFieldCardIndex = message.targetFieldIndex;
                }
                
                EffectApplier.applyEffects(supporterData.effects, controllers, context);
                
                // Process any effects that were triggered by the supporter effects
                EffectQueueProcessor.processQueue(controllers);
                
                // Discard the played supporter card
                if (playedCard) {
                    controllers.discard.discardCard(sourceHandler, playedCard);
                }
            } else if (message.cardType === 'item') {
                // Apply item effects
                const itemData = controllers.cardRepository.getItem(message.templateId);
                const context = EffectContextFactory.createCardContext(sourceHandler, itemData.name, 'item');
                
                // Add target information if provided
                if (message.targetPlayerId !== undefined) {
                    context.targetPlayerId = message.targetPlayerId;
                }
                if (message.targetFieldIndex !== undefined) {
                    context.targetFieldCardIndex = message.targetFieldIndex;
                }
                
                EffectApplier.applyEffects(itemData.effects, controllers, context);
                
                // Process any effects that were triggered by the item effects
                EffectQueueProcessor.processQueue(controllers);
                
                // Discard the played item card
                if (playedCard) {
                    controllers.discard.discardCard(sourceHandler, playedCard);
                }
            } else if (message.cardType === 'tool') {
                // Attach tool to target creature
                const toolData = controllers.cardRepository.getTool(message.templateId);
                const targetPlayerId = message.targetPlayerId ?? sourceHandler;
                const targetFieldIndex = message.targetFieldIndex ?? 0;
                
                // Get the target creature (raw InstancedFieldCard to access fieldInstanceId)
                const rawTargetCard = controllers.field.state.creatures[targetPlayerId]?.[targetFieldIndex];
                
                if (rawTargetCard) {
                    // Generate a unique tool instance ID
                    const toolInstanceId = `${message.templateId}-${Date.now()}`;
                    // Use fieldInstanceId for tool attachment so it persists through evolution
                    controllers.tools.attachTool(rawTargetCard.fieldInstanceId, message.templateId, toolInstanceId);
                    
                    const targetCard = controllers.field.getCards(targetPlayerId)[targetFieldIndex];
                    controllers.players.messageAll({
                        type: 'card-played',
                        components: [`Player ${sourceHandler + 1} attached ${toolData.name} to ${targetCard.templateId}!`]
                    });
                }
            }
        }
    },
    'end-turn-response': {
        canRespond: EventHandler.isTurn('turn'),
        merge: (controllers: Controllers, sourceHandler: number, message: EndTurnResponseMessage) => {
            const currentPlayer = sourceHandler;
            
            // Trigger end-of-turn effects for active card (tools + abilities)
            const activeCard = controllers.field.getCardByPosition(currentPlayer, 0);
            if (activeCard) {
                TriggerProcessor.processEndOfTurn(
                    controllers,
                    currentPlayer,
                    activeCard.instanceId,
                    activeCard.templateId
                );
                
                // Process any effects that were triggered by end-of-turn
                EffectQueueProcessor.processQueue(controllers);
            }
            
            // Clear guaranteed coin flip heads at end of turn (Will supporter effect)
            controllers.coinFlip.clearGuaranteedHeads();
            
            // Clear retreat preventions that expire at end of turn
            // TODO: Implement proper duration tracking instead of clearing all
            controllers.turnState.clearRetreatPreventions();

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
                    return !hand.some(card => card.templateId === message.activeCardId && card.type === 'creature');
                }),
                EventHandler.validate('Invalid bench cards', (controllers: Controllers, source: number, message: SetupCompleteResponseMessage) => {
                    const hand = controllers.hand.getHand(source);
                    return message.benchCardIds.some(cardId => 
                        !hand.some(card => card.templateId === cardId && card.type === 'creature')
                    );
                }),
            ],
            fallback: (controllers: Controllers, source: number, message: SetupCompleteResponseMessage) => {
                // Smart fallback: provide fallback creature selection
                const hand = controllers.hand.getHand(source);
                const creatureCards = hand.filter(card => card.type === 'creature');
                
                if (creatureCards.length > 0) {
                    const activeCardId = creatureCards[0].templateId;
                    const benchCardIds = creatureCards.slice(1, Math.min(4, creatureCards.length)).map(card => card.templateId);
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
            
            // Find and play the active card from hand
            const activeCardIndex = hand.findIndex(card => 
                card.templateId === message.activeCardId && card.type === 'creature'
            );
            let activeInstanceId: string | undefined;
            if (activeCardIndex !== -1) {
                const activeCard = controllers.hand.playCard(source, activeCardIndex);
                activeInstanceId = activeCard?.instanceId;
                controllers.field.setActiveCard(source, message.activeCardId, activeInstanceId);
            }
            
            // Find and play bench cards from hand
            for (const cardId of message.benchCardIds) {
                const benchCardIndex = hand.findIndex(card => 
                    card.templateId === cardId && card.type === 'creature'
                );
                if (benchCardIndex !== -1) {
                    const benchCard = controllers.hand.playCard(source, benchCardIndex);
                    controllers.field.addToBench(source, cardId, benchCard?.instanceId);
                }
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
                    return !hand.some(card => card.templateId === message.evolutionId);
                }),
                EventHandler.validate('Invalid evolution target', (controllers: Controllers, source: number, message: EvolveResponseMessage) => {
                    if (message.position === 0) {
                        return !controllers.field.getCardByPosition(source, 0);
                    } else {
                        const benchedCards = controllers.field.getCards(source).slice(1);
                        return message.position < 1 || message.position > benchedCards.length;
                    }
                }),
                EventHandler.validate('Creature already evolved this turn', (controllers: Controllers, source: number, message: EvolveResponseMessage) => {
                    let targetCard;
                    if (message.position === 0) {
                        targetCard = controllers.field.state.creatures[source][0];
                    } else {
                        targetCard = controllers.field.state.creatures[source][message.position];
                    }
                    
                    if (targetCard) {
                        // Check evolution using the original instance ID (first in evolution stack)
                        const originalInstanceId = targetCard.evolutionStack[0]?.instanceId;
                        const hasEvolved = controllers.turnState.hasEvolvedThisTurn(originalInstanceId);
                        return hasEvolved ? new Error('Creature already evolved this turn') : undefined;
                    }
                    return undefined;
                }),
                EventHandler.validate('Invalid evolution chain', (controllers: Controllers, source: number, message: EvolveResponseMessage) => {
                    let targetCard;
                    if (message.position === 0) {
                        targetCard = controllers.field.getCardByPosition(source, 0);
                    } else {
                        const benchedCards = controllers.field.getCards(source).slice(1);
                        targetCard = benchedCards[message.position - 1];
                    }
                    
                    if (targetCard) {
                        const evolutionData = controllers.cardRepository.getCreature(message.evolutionId);
                        const currentData = controllers.cardRepository.getCreature(targetCard.templateId);
                        
                        const isValidEvolution = evolutionData.evolvesFrom === targetCard.templateId;
                        
                        return !isValidEvolution;
                    }
                    return true;
                }),
            ],
            fallback: (controllers: Controllers, source: number, message: EvolveResponseMessage) => {
                // Return undefined to ignore invalid evolution attempts
                return undefined as any;
            },
        },
        merge: (controllers: Controllers, sourceHandler: number, message: EvolveResponseMessage) => {
            controllers.waiting.removePosition(sourceHandler);
            
            const hand = controllers.hand.getHand(sourceHandler);
            const evolutionCardIndex = hand.findIndex(card => card.templateId === message.evolutionId);
            if (evolutionCardIndex === -1) return;
            
            // Get the evolution card's instanceId before playing it
            const evolutionCard = controllers.hand.playCard(sourceHandler, evolutionCardIndex);
            const evolutionInstanceId = evolutionCard?.instanceId;
            
            // Get the current turn number (default to 0 if not available)
            const turnNumber = controllers.turnCounter?.getTurn?.() ?? 0;
            
            if (message.position === 0) {
                const targetCard = controllers.field.getCardByPosition(sourceHandler, 0);
                if (targetCard) {
                    // Mark evolution using the original instance ID (not the current form)
                    const rawCard = controllers.field.state.creatures[sourceHandler]?.[0];
                    const originalInstanceId = rawCard?.evolutionStack?.[0]?.instanceId ?? targetCard.instanceId;
                    controllers.turnState.markEvolvedThisTurn(originalInstanceId);
                    controllers.statusEffects.clearAllStatusEffects(sourceHandler);
                }
                controllers.field.evolveActiveCard(sourceHandler, message.evolutionId, evolutionInstanceId, turnNumber);
            } else {
                const benchedCards = controllers.field.getCards(sourceHandler).slice(1);
                const targetCard = benchedCards[message.position - 1];
                if (targetCard) {
                    // Mark evolution using the original instance ID (not the current form)
                    const rawCard = controllers.field.state.creatures[sourceHandler]?.[message.position];
                    const originalInstanceId = rawCard?.evolutionStack?.[0]?.instanceId ?? targetCard.instanceId;
                    controllers.turnState.markEvolvedThisTurn(originalInstanceId);
                }
                controllers.field.evolveBenchedCard(sourceHandler, message.position - 1, message.evolutionId, evolutionInstanceId, turnNumber);
            }
            
            const { name } = controllers.cardRepository.getCreature(message.evolutionId);
            controllers.players.messageAll(new EvolutionMessage(
                'Previous Form',
                name,
                `Player ${sourceHandler + 1}`
            ));
        }
    },
    'attach-energy-response': {
        validateEvent: {
            validators: [
                EventHandler.validate('No energy available to attach', (controllers: Controllers, source: number, message: AttachEnergyResponseMessage) => {
                    return !controllers.energy.canAttachEnergy(source);
                }),
                EventHandler.validate('First turn restriction', (controllers: Controllers, source: number, message: AttachEnergyResponseMessage) => {
                    return controllers.energy.isFirstTurnRestricted();
                }),
            ],
            fallback: (controllers: Controllers, source: number, message: AttachEnergyResponseMessage) => {
                return new AttachEnergyResponseMessage(0);
            },
        },
        merge: (controllers: Controllers, sourceHandler: number, message: AttachEnergyResponseMessage) => {
            controllers.waiting.removePosition(sourceHandler);
            
            const currentPlayer = sourceHandler;
            // Get the current available energy type (don't generate new energy!)
            const availableTypes = controllers.energy.getAvailableEnergyTypes(currentPlayer);
            if (availableTypes.length === 0) {
                return; // No energy available
            }
            const energyType = availableTypes[0]; // Get the first (and only) available energy type
            
            // Get the field instance ID for energy attachment
            const fieldInstanceId = controllers.field.getFieldInstanceId(currentPlayer, message.fieldPosition);
            if (!fieldInstanceId) {
                return; // Invalid field position
            }
            
            const success = controllers.energy.attachEnergyToInstance(currentPlayer, fieldInstanceId, energyType);
            
            if (success) {
                controllers.players.messageAll({
                    type: 'energy-attached',
                    components: [`Player ${currentPlayer + 1} attached ${energyType} energy!`]
                });
                
                // Process energy-attachment triggers for all field cards (all players)
                for (let playerId = 0; playerId < controllers.players.count; playerId++) {
                    const fieldCards = controllers.field.getPlayedCards(playerId);
                    for (let fieldPosition = 0; fieldPosition < fieldCards.length; fieldPosition++) {
                        const card = fieldCards[fieldPosition];
                        const cardData = controllers.cardRepository.getCreature(card.templateId);
                        if (cardData.ability) {
                            const ability = cardData.ability;
                            if (ability.trigger?.type === 'energy-attachment' && 
                                (!ability.trigger.energyType || ability.trigger.energyType === energyType)) {
                                
                                const context = EffectContextFactory.createAbilityContext(
                                    playerId,
                                    `${cardData.name}'s ${ability.name}`,
                                    card.instanceId,
                                    fieldPosition
                                );
                                
                                EffectApplier.applyEffects(
                                    ability.effects,
                                    controllers,
                                    context
                                );
                            }
                        }
                    }
                }
                
                // Process any effects that were triggered by energy attachment
                EffectQueueProcessor.processQueue(controllers);
            }
            
        }
    },
    'use-ability-response': {
        canRespond: EventHandler.isTurn('turn'),
        validateEvent: {
            validators: [
                EventHandler.validate('Cannot use ability - invalid field position', (controllers: Controllers, source: number, message: UseAbilityResponseMessage) => {
                    const fieldCards = controllers.field.getPlayedCards(source);
                    return message.fieldCardPosition < 0 || message.fieldCardPosition >= fieldCards.length;
                }),
                EventHandler.validate('Cannot use ability - no ability', (controllers: Controllers, source: number, message: UseAbilityResponseMessage) => {
                    const fieldCards = controllers.field.getPlayedCards(source);
                    const fieldCard = fieldCards[message.fieldCardPosition];
                    if (!fieldCard) return true;
                    const cardData = controllers.cardRepository.getCreature(fieldCard.templateId);
                    return !cardData.ability;
                }),
                EventHandler.validate('Cannot use ability - already used this turn', (controllers: Controllers, source: number, message: UseAbilityResponseMessage) => {
                    const fieldCards = controllers.field.getPlayedCards(source);
                    const fieldCard = fieldCards[message.fieldCardPosition];
                    if (!fieldCard) return false;
                    const cardData = controllers.cardRepository.getCreature(fieldCard.templateId);
                    const ability = cardData.ability;
                    if (!ability) return false;
                    
                    // Allow unlimited abilities to be used multiple times
                    if (ability.trigger?.unlimited) {
                        return false;
                    }
                    
                    return controllers.turnState.hasAbilityBeenUsedThisTurn(fieldCard.instanceId, ability.name);
                })
            ],
            fallback: (controllers: Controllers, source: number, message: UseAbilityResponseMessage) => {
                controllers.waiting.removePosition(source);
                return undefined as any;
            }
        },
        merge: (controllers: Controllers, sourceHandler: number, message: UseAbilityResponseMessage) => {
            controllers.waiting.removePosition(sourceHandler);
            
            const fieldCards = controllers.field.getPlayedCards(sourceHandler);
            const fieldCard = fieldCards[message.fieldCardPosition];
            
            if (fieldCard) {
                const cardData = controllers.cardRepository.getCreature(fieldCard.templateId);
                const ability = cardData.ability;
                
                if (ability && ability.effects) {
                    // Mark ability as used this turn
                    controllers.turnState.markAbilityUsed(fieldCard.instanceId, ability.name);
                    
                    const effectName = `${cardData.name}'s ${ability.name}`;
                    const context = EffectContextFactory.createAbilityContext(
                        sourceHandler,
                        effectName,
                        fieldCard.instanceId,
                        message.fieldCardPosition
                    );
                    
                    EffectApplier.applyEffects(ability.effects, controllers, context);
                    
                    // Process any effects that were triggered by the ability
                    EffectQueueProcessor.processQueue(controllers);
                }
            }
            
        }
    },
    'retreat-response': {
        canRespond: EventHandler.isTurn('turn'),
        validateEvent: {
            validators: [
                EventHandler.validate('Already retreated this turn', (controllers: Controllers, source: number, message: RetreatResponseMessage) => {
                    return controllers.turnState.hasRetreatedThisTurn();
                }),
                EventHandler.validate('No bench creatures available', (controllers: Controllers, source: number, message: RetreatResponseMessage) => {
                    const benchCards = controllers.field.getCards(source).slice(1);
                    return benchCards.length === 0;
                }),
                EventHandler.validate('Invalid bench index', (controllers: Controllers, source: number, message: RetreatResponseMessage) => {
                    const benchCards = controllers.field.getCards(source).slice(1);
                    return message.benchIndex < 0 || message.benchIndex >= benchCards.length;
                }),
                EventHandler.validate('Insufficient energy for retreat', (controllers: Controllers, source: number, message: RetreatResponseMessage) => {
                    const fieldInstanceId = controllers.field.getFieldInstanceId(source, 0);
                    if (!fieldInstanceId) return true;
                    
                    const activeCard = controllers.field.getCardByPosition(source, 0);
                    if (!activeCard) return true;
                    
                    const creatureData = controllers.cardRepository.getCreature(activeCard.templateId);
                    const retreatCost = creatureData.retreatCost;
                    const attachedEnergy = controllers.energy.getAttachedEnergyByInstance(fieldInstanceId);
                    const totalEnergy = Object.values(attachedEnergy).reduce((sum, amount) => sum + amount, 0);
                    
                    return totalEnergy < retreatCost;
                }),
                EventHandler.validate('Cannot retreat while paralyzed', (controllers: Controllers, source: number, message: RetreatResponseMessage) => {
                    return controllers.statusEffects.hasStatusEffect(source, 0, 'paralyzed');
                }),
                EventHandler.validate('Cannot retreat - retreat prevented', (controllers: Controllers, source: number, message: RetreatResponseMessage) => {
                    const activeCard = controllers.field.getCardByPosition(source, 0);
                    if (!activeCard) return false;
                    
                    return controllers.turnState.isRetreatPrevented(activeCard.instanceId);
                }),
            ],
            fallback: (controllers: Controllers, source: number, message: RetreatResponseMessage) => {
                return undefined as any;
            },
        },
        merge: (controllers: Controllers, sourceHandler: number, message: RetreatResponseMessage) => {
            controllers.waiting.removePosition(sourceHandler);
            
            const activeCard = controllers.field.getCardByPosition(sourceHandler, 0);
            if (!activeCard) return;
            
            // Get field instance ID for energy operations
            const fieldInstanceId = controllers.field.getFieldInstanceId(sourceHandler, 0);
            if (!fieldInstanceId) return;
            
            // Calculate retreat cost after reductions
            const creatureData = controllers.cardRepository.getCreature(activeCard.templateId);
            const retreatCost = creatureData.retreatCost;
            
            // Consume energy for retreat
            const attachedEnergy = controllers.energy.getAttachedEnergyByInstance(fieldInstanceId);
            let energyToRemove = retreatCost;
            
            // Remove energy in order of availability
            for (const [energyType, amount] of Object.entries(attachedEnergy)) {
                if (energyToRemove <= 0) break;
                const toRemove = Math.min(amount, energyToRemove);
                controllers.energy.discardSpecificEnergyFromInstance(sourceHandler, fieldInstanceId, energyType as AttachableEnergyType, toRemove);
                energyToRemove -= toRemove;
            }
            
            // Clear status effects on retreat
            controllers.statusEffects.clearAllStatusEffects(sourceHandler, 0);
            
            // Switch active creature with bench creature
            controllers.field.retreat(sourceHandler, message.benchIndex);
            
            // Mark that retreat has been used this turn
            controllers.turnState.setRetreatedThisTurn(true);
            
        }
    },
    'select-target-response': {
        canRespond: EventHandler.isTurn('turn'),
        validateEvent: {
            validators: [
                EventHandler.validate('Invalid target selection', (controllers: Controllers, source: number, message: SelectTargetResponseMessage) => {
                    const pendingSelection = controllers.turnState.getPendingTargetSelection();
                    if (!pendingSelection) {
                        return true; // No pending selection - validation fails (return true)
                    }
                    
                    // Validate the target selection using TargetResolver
                    const { effect, originalContext } = pendingSelection;
                    
                    // Find the target that requires validation based on resolution order
                    let targetToValidate: Target | undefined = undefined;
                    
                    // Get resolution requirements to determine which target needs validation
                    const handler = effectHandlers[effect.type];
                    if (handler && 'getResolutionRequirements' in handler) {
                        const requirements = handler.getResolutionRequirements(effect);
                        
                        // Find the first unresolved requirement that needs selection
                        for (const requirement of requirements) {
                            const currentTarget = effect[requirement.targetProperty];
                            const target = requirement.target;
                            
                            if (target && typeof target === 'object' && 
                                (target.type === 'single-choice' || target.type === 'multi-choice') &&
                                (!currentTarget || currentTarget.type !== 'resolved')) {
                                targetToValidate = target;
                                break;
                            }
                        }
                    }
                    
                    // Fallback to old logic if no handler or requirements
                    if (!targetToValidate) {
                        if ('target' in effect && effect.target && 'criteria' in effect.target) {
                            targetToValidate = effect.target;
                        } else if ('switchWith' in effect && effect.switchWith && 'criteria' in effect.switchWith) {
                            targetToValidate = effect.switchWith;
                        } else if ('source' in effect && effect.source && 'criteria' in effect.source) {
                            targetToValidate = effect.source;
                        }
                    }
                    
                    if (targetToValidate) {
                        const isValidTarget = TargetResolver.validateTargetSelection(
                            targetToValidate,
                            message.targetPlayerId,
                            message.targetCreatureIndex,
                            controllers,
                            originalContext
                        );
                        return !isValidTarget; // Return true when validation FAILS (EventHandler convention)
                    }
                    
                    return false; // No target to validate, so it's valid (return false)
                })
            ],
            fallback: (controllers: Controllers, source: number, message: SelectTargetResponseMessage) => {
                controllers.waiting.removePosition(source);
                controllers.turnState.clearPendingTargetSelection(); // Clear pending selection on validation failure
                return undefined as any;
            }
        },
        merge: (controllers: Controllers, sourceHandler: number, message: SelectTargetResponseMessage) => {
            controllers.waiting.removePosition(sourceHandler);
            
            const pendingSelection = controllers.turnState.getPendingTargetSelection();
            
            if (pendingSelection) {
                const hasNewPendingSelection = EffectApplier.resumeEffectWithSelection(
                    controllers,
                    pendingSelection,
                    message.targetPlayerId,
                    message.targetCreatureIndex
                );
                
                // Only clear pending selection if we didn't set up a new one
                if (!hasNewPendingSelection) {
                    controllers.turnState.clearPendingTargetSelection();
                }
            }
            
        }
    }
});
