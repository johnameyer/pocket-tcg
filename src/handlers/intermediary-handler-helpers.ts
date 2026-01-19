import { Intermediary } from '@cards-ts/core';
import { HandlerData } from '../game-handler.js';
import { HandlerResponsesQueue } from '@cards-ts/core';
import { ResponseMessage } from '../messages/response-message.js';
import { CardRepository } from '../repository/card-repository.js';
import { EnergyController } from '../controllers/energy-controller.js';
import { ActionValidator } from '../effects/action-validator.js';
import { AttackResponseMessage, PlayCardResponseMessage, EndTurnResponseMessage, EvolveResponseMessage, AttachEnergyResponseMessage, RetreatResponseMessage, UseAbilityResponseMessage } from '../messages/response/index.js';
import { GameCard } from '../controllers/card-types.js';
import { FieldCard } from '../controllers/field-controller.js';
import { StatusEffect } from '../controllers/status-effect-controller.js';
import { EnergyDictionary } from '../controllers/energy-controller.js';

interface SelectionOption {
    name: string;
    value: string | number;
}

/**
 * Builds options for FieldCard selection.
 * 
 * @param fieldCard Array of FieldCard
 * @param prefix Prefix for option IDs
 * @returns Array of options for selection
 */
export function buildFieldCardOptions(cardRepository: CardRepository, field: FieldCard[], prefix: string): SelectionOption[] {
    return field.map((p, i) => {
        const fieldCardData = cardRepository.getCreature(p.templateId);
        const hp = Math.max(0, fieldCardData.maxHp - p.damageTaken);
        const maxHp = fieldCardData.maxHp;
        
        return {
            name: `${fieldCardData.name} (${hp}/${maxHp} HP)`,
            value: i
        };
    });
}

/**
 * Builds options for energy types.
 * 
 * @param energyTypes Array of energy types
 * @returns Array of options for selection
 */
export function buildEnergyOptions(energyTypes: string[]): SelectionOption[] {
    return energyTypes.map(type => ({
        name: `${type.charAt(0).toUpperCase() + type.slice(1)} Energy`,
        value: type
    }));
}

/**
 * Gets status display text for a player.
 * 
 * @param handlerData The handler data
 * @param playerId The player ID
 * @returns Status display text
 */
export function getStatusDisplayText(handlerData: HandlerData, playerId: number): string {
    const statusEffects = handlerData.statusEffects;
    return statusEffects ? 
        (statusEffects.activeStatusEffects[playerId] as unknown as StatusEffect[])?.length > 0 ? 
            ` [${(statusEffects.activeStatusEffects[playerId] as unknown as StatusEffect[]).map((e: StatusEffect) => e.type.toUpperCase()).join(', ')}]` : '' 
        : '';
}

/**
 * Handles the attack action.
 * 
 * @param intermediary The intermediary
 * @param handlerData The handler data
 * @param responsesQueue The responses queue
 */
export async function handleAttack(cardRepository: CardRepository, intermediary: Intermediary, handlerData: HandlerData, responsesQueue: HandlerResponsesQueue<ResponseMessage>): Promise<void> {
    const currentPlayer = handlerData.turn;
    
    // Check if FieldCard can attack using ActionValidator
    // Get status effects for the current player
    const statusEffects = handlerData.statusEffects ? 
        (handlerData.statusEffects.activeStatusEffects[currentPlayer] as unknown as StatusEffect[]) : 
        [];
    const isAsleep = statusEffects.some((e: StatusEffect) => e.type === 'sleep');
    const isParalyzed = statusEffects.some((e: StatusEffect) => e.type === 'paralysis');
    
    if (isAsleep || isParalyzed) {
        const condition = isAsleep ? 'asleep' : 'paralyzed';
        await intermediary.form({ 
            type: 'print', 
            message: [`Your FieldCard is ${condition} and cannot attack!`] 
        });
        await handleAction(cardRepository, intermediary, handlerData, responsesQueue);
        return;
    }
    
    // Get the active FieldCard for the current player
    const activeFieldCard = handlerData.field.creatures[currentPlayer][0]; // Position 0 is active
    const fieldCardData = cardRepository.getCreature(activeFieldCard.templateId);
    
    if (!fieldCardData) {
        return;
    }
    
    // Get attacks from FieldCard with energy requirements
    const attackOptions = fieldCardData.attacks.map((attack, index) => {
        const energyText = ` [${attack.energyRequirements.map(req => `${req.amount} ${req.type}`).join(', ')}]`;
        const canUse = ActionValidator.canUseAttack(handlerData, cardRepository, currentPlayer, index);
        const statusText = canUse ? '' : ' (Not enough energy!)';
        
        return {
            name: `${attack.name} (${attack.damage} damage)${energyText}${statusText}`,
            value: index
        };
    });
    
    // Add back option
    attackOptions.push({ name: 'Back', value: -1 });
    
    // Show current energy on FieldCard
    const instanceId = activeFieldCard.instanceId;
    const energyCount = EnergyController.getTotalEnergyByInstance(handlerData.energy, instanceId);
    const attachedEnergy = EnergyController.getAttachedEnergyByInstance(handlerData.energy, instanceId);
    const energyTypes = Object.entries(attachedEnergy)
        .filter(([_, count]) => (count as number) > 0)
        .map(([type, count]) => `${count}${type.charAt(0).toUpperCase()}`)
        .join(', ');
    const energyTypesDisplay = energyTypes.length > 0 ? energyTypes : 'None';
    
    const [sent, received] = intermediary.form({ 
        type: 'list', 
        message: [
            `Player ${currentPlayer + 1}, choose your attack with ${fieldCardData.name}:`,
            `Current Energy: ${energyCount} (${energyTypes})`
        ],
        choices: attackOptions
    });
    
    const attackIndex = (await received)[0] as number;
    
    // Handle back option
    if (attackIndex === -1) {
        await handleAction(cardRepository, intermediary, handlerData, responsesQueue);
        return;
    }
    
    // Create an attack action
    responsesQueue.push(new AttackResponseMessage(attackIndex));
}

/**
 * Handles the play card action.
 * 
 * @param intermediary The intermediary
 * @param handlerData The handler data
 * @param responsesQueue The responses queue
 */
export async function handlePlayCard(cardRepository: CardRepository, intermediary: Intermediary, handlerData: HandlerData, responsesQueue: HandlerResponsesQueue<ResponseMessage>): Promise<void> {
    const currentPlayer = handlerData.turn;
    
    // Get the player's hand
    const hand = handlerData.hand;
    
    if (!hand || hand.length === 0) {
        await intermediary.form({ type: 'print', message: ['Your hand is empty. Wait for your next turn to draw a card.'] });
        // Return to action selection instead of sending an invalid play action
        await handleAction(cardRepository, intermediary, handlerData, responsesQueue);
        return;
    }
    
    // Create options for each card in hand with type information
    const cardOptions = hand.map((card: GameCard, index) => {
        let cardName: string;
        let cardDescription = '';
        
        if (card.type === 'creature') {
            const fieldCardData = cardRepository.getCreature(card.templateId);
            if (!fieldCardData) {
                throw new Error(`FieldCard not found: ${card.templateId}`);
            }
            cardName = fieldCardData.name;
            
            // Check if card can be played using ActionValidator
            if (!ActionValidator.canPlayCard(handlerData, cardRepository, card.templateId, currentPlayer)) {
                if (fieldCardData.evolvesFrom) {
                    cardDescription = ' (Cannot play evolved FieldCard directly!)';
                } else {
                    cardDescription = ' (Bench is full!)';
                }
            }
        } else if (card.type === 'item') {
            const itemData = cardRepository.getItem(card.templateId);
            if (!itemData) {
                throw new Error(`Item not found: ${card.templateId}`);
            }
            cardName = itemData.name;
            
            // Check if card can be played using ActionValidator
            if (!ActionValidator.canPlayCard(handlerData, cardRepository, card.templateId, currentPlayer)) {
                if (itemData.templateId === 'potion') {
                    cardDescription = ' (No FieldCard need healing!)';
                } else {
                    cardDescription = ' (Cannot play this card now)';
                }
            } else {
                // Get the effect type if available
                cardDescription = itemData.effects && itemData.effects.length > 0 && itemData.effects[0].type ? 
                    ` - ${itemData.effects[0].type}` : 
                    ' - Unknown effect';
            }
        } else if (card.type === 'supporter') {
            const supporterData = cardRepository.getSupporter(card.templateId);
            if (!supporterData) {
                throw new Error(`Supporter not found: ${card.templateId}`);
            }
            cardName = supporterData.name;
            
            // Check if card can be played using ActionValidator
            if (!ActionValidator.canPlayCard(handlerData, cardRepository, card.templateId, currentPlayer)) {
                if (handlerData.turnState.supporterPlayedThisTurn) {
                    cardDescription = ' (Already played a Supporter this turn!)';
                } else if (supporterData.templateId === 'sabrina') {
                    cardDescription = ' (Opponent has no bench FieldCard!)';
                } else if (supporterData.templateId === 'lillie') {
                    cardDescription = ' (No FieldCard need healing!)';
                } else {
                    cardDescription = ' (Cannot play this card now)';
                }
            } else if (supporterData.effects && supporterData.effects.length > 0) {
                cardDescription = ` - ${supporterData.effects[0].type}`;
            }
        } else if (card.type === 'tool') {
            const toolData = cardRepository.getTool(card.templateId);
            if (!toolData) {
                throw new Error(`Tool not found: ${card.templateId}`);
            }
            cardName = toolData.name;
            
            // Check if card can be played using ActionValidator
            if (!ActionValidator.canPlayCard(handlerData, cardRepository, card.templateId, currentPlayer)) {
                cardDescription = ' (Cannot attach tool now)';
            } else if (toolData.effects && toolData.effects.length > 0) {
                cardDescription = ` - ${toolData.effects[0].type}`;
            }
        } else {
            // This should never happen if all card types are handled above
            const exhaustiveCheck: never = card;
            throw new Error(`Unknown card type: ${(exhaustiveCheck as GameCard).type}`);
        }
        
        return {
            name: `[${card.type.toUpperCase()}] ${cardName}${cardDescription} (Card ${index + 1})`,
            value: index
        };
    });
    
    // Add back option
    cardOptions.push({ name: 'Back', value: -1 });
    
    const [sent, received] = intermediary.form({
        type: 'list',
        message: [`Player ${currentPlayer + 1}, choose a card to play:`],
        choices: cardOptions
    });
    
    const cardIndex = (await received)[0] as number;
    
    // Handle back option
    if (cardIndex === -1) {
        await handleAction(cardRepository, intermediary, handlerData, responsesQueue);
        return;
    }
    
    const selectedCard = hand[cardIndex];
    
    // For item cards, ask for a target
    let targetPlayerId = currentPlayer; // Default to self
    let targetFieldCardIndex = 0; // Default to active FieldCard
    
    if (selectedCard.type === 'item') {
        const itemData = cardRepository.getItem(selectedCard.templateId);
        
        // Only ask for target if it's a healing item like potion
        if (itemData && itemData.templateId === 'potion') {
            // Create options for player's FieldCard (active + bench)
            const fieldCardOptions = [];
            
            // Add active FieldCard
            const activeFieldCard = handlerData.field.creatures[currentPlayer][0]; // Position 0 is active
            const activeCreatureData = cardRepository.getCreature(activeFieldCard.templateId);
            const activeHp = Math.max(0, activeCreatureData.maxHp - activeFieldCard.damageTaken);
            fieldCardOptions.push({
                name: `${activeCreatureData.name} (${activeHp} HP) - Active`,
                value: 0
            });
            
            // Add benched FieldCard
            const benchedFieldCards = handlerData.field.creatures[currentPlayer].slice(1); // Positions 1+ are benched
            benchedFieldCards.forEach((fieldCard, index: number) => {
                const fieldCardData = cardRepository.getCreature(fieldCard.templateId);
                const hp = Math.max(0, fieldCardData.maxHp - fieldCard.damageTaken);
                fieldCardOptions.push({
                    name: `${fieldCardData.name} (${hp} HP) - Bench`,
                    value: index + 1
                });
            });
            
            // Add back option
            fieldCardOptions.push({ name: 'Back', value: -1 });
            
            const [targetSent, targetReceived] = intermediary.form({
                type: 'list',
                message: [`Choose a FieldCard to heal with your ${itemData.name}:`],
                choices: fieldCardOptions
            });
            
            targetFieldCardIndex = (await targetReceived)[0] as number;
            
            // Handle back option
            if (targetFieldCardIndex === -1) {
                await handlePlayCard(cardRepository, intermediary, handlerData, responsesQueue);
                return;
            }
        }
    }
    
    // Create a play card action
    if (selectedCard.type === 'creature' || selectedCard.type === 'supporter' || selectedCard.type === 'item') {
        responsesQueue.push(new PlayCardResponseMessage(selectedCard.templateId, selectedCard.type, targetPlayerId, targetFieldCardIndex));
    } else {
        // Handle tool cards or other unsupported types
        await intermediary.form({ type: 'print', message: [`Cannot play ${selectedCard.type} cards yet.`] });
        await handleAction(cardRepository, intermediary, handlerData, responsesQueue);
    }
}

/**
 * Handles the evolve action.
 * 
 * @param intermediary The intermediary
 * @param handlerData The handler data
 * @param responsesQueue The responses queue
 */
export async function handleEvolve(cardRepository: CardRepository, intermediary: Intermediary, handlerData: HandlerData, responsesQueue: HandlerResponsesQueue<ResponseMessage>): Promise<void> {
    const currentPlayer = handlerData.turn;
    const allFieldCard = cardRepository.getAllCreatureIds();
    const fieldCardOptions = [];
    
    // Check all FieldCard positions for evolution using ActionValidator
    const allFieldCards = handlerData.field.creatures[currentPlayer] || [];
    
    allFieldCards.forEach((fieldCard, position) => {
        if (ActionValidator.canEvolveCreature(handlerData, cardRepository, currentPlayer, position)) {
            const evolution = allFieldCard.find(id => {
                const data = cardRepository.getCreature(id);
                return data.evolvesFrom === fieldCard.templateId;
            });
            
            if (evolution) {
                const currentData = cardRepository.getCreature(fieldCard.templateId);
                const evolutionData = cardRepository.getCreature(evolution);
                
                if (position === 0) { // Active FieldCard
                    fieldCardOptions.push({
                        name: `${currentData?.name} → ${evolutionData?.name} (Active)`,
                        value: { evolutionId: evolution, isActive: true }
                    });
                } else { // Bench FieldCard
                    fieldCardOptions.push({
                        name: `${currentData?.name} → ${evolutionData?.name} (Bench)`,
                        value: { evolutionId: evolution, isActive: false, benchIndex: position - 1 }
                    });
                }
            }
        }
    });
    
    if (fieldCardOptions.length === 0) {
        await intermediary.form({ type: 'print', message: ['No FieldCard can evolve right now.'] });
        await handleAction(cardRepository, intermediary, handlerData, responsesQueue);
        return;
    }
    
    fieldCardOptions.push({ name: 'Back', value: null });
    
    const [sent, received] = intermediary.form({
        type: 'list',
        message: [`Choose a FieldCard to evolve:`],
        choices: fieldCardOptions
    });
    
    const selection = (await received)[0] as { evolutionId: string; isActive: boolean; benchIndex?: number } | null;
    
    if (!selection) {
        await handleAction(cardRepository, intermediary, handlerData, responsesQueue);
        return;
    }
    
    // Calculate position: 0 for active, 1+ for bench
    const position = selection.isActive ? 0 : (selection.benchIndex! + 1);
    
    responsesQueue.push(new EvolveResponseMessage(selection.evolutionId, position));
}

/**
 * Handles the attach energy action.
 * 
 * @param intermediary The intermediary
 * @param handlerData The handler data
 * @param responsesQueue The responses queue
 */
export async function handleAttachEnergy(cardRepository: CardRepository, intermediary: Intermediary, handlerData: HandlerData, responsesQueue: HandlerResponsesQueue<ResponseMessage>): Promise<void> {
    const currentPlayer = handlerData.turn;
    
    // Check if energy can be attached using ActionValidator
    if (!ActionValidator.canAttachEnergy(handlerData, cardRepository, currentPlayer)) {
        const message = handlerData.energy.isAbsoluteFirstTurn ? 
            'Cannot attach energy on first turn as first player.' : 
            'Cannot attach energy this turn.';
        await intermediary.form({ type: 'print', message: [message] });
        await handleAction(cardRepository, intermediary, handlerData, responsesQueue);
        return;
    }
    
    // Get available energy types
    const availableTypes = EnergyController.getAvailableEnergyTypes(handlerData.energy, currentPlayer);
    if (availableTypes.length === 0) {
        await intermediary.form({ type: 'print', message: ['No energy available to attach.'] });
        await handleAction(cardRepository, intermediary, handlerData, responsesQueue);
        return;
    }
    
    // If multiple energy types available, let player choose
    let selectedEnergyType = availableTypes[0];
    if (availableTypes.length > 1) {
        const energyOptions = availableTypes.map((type: string) => ({
            name: type.charAt(0).toUpperCase() + type.slice(1),
            value: type
        }));
        energyOptions.push({ name: 'Back', value: 'back' });
        
        const [energySent, energyReceived] = intermediary.form({
            type: 'list',
            message: ['Choose energy type to attach:'],
            choices: energyOptions
        });
        
        selectedEnergyType = (await energyReceived)[0] as string;
        if (selectedEnergyType === 'back') {
            await handleAction(cardRepository, intermediary, handlerData, responsesQueue);
            return;
        }
    }
    
    const fieldCardOptions = [];
    
    // Add active FieldCard
    const activeFieldCard = handlerData.field.creatures[currentPlayer][0]; // Position 0 is active
    const activeCreatureData = cardRepository.getCreature(activeFieldCard.templateId);
    fieldCardOptions.push({
        name: `${activeCreatureData.name} (Active)`,
        value: 0
    });
    
    // Add benched FieldCard
    const benchedFieldCards = handlerData.field.creatures[currentPlayer].slice(1); // Positions 1+ are benched
    benchedFieldCards.forEach((fieldCard, index: number) => {
        const fieldCardData = cardRepository.getCreature(fieldCard.templateId);
        fieldCardOptions.push({
            name: `${fieldCardData.name} (Bench)`,
            value: index + 1
        });
    });
    
    fieldCardOptions.push({ name: 'Back', value: -1 });
    
    const [sent, received] = intermediary.form({
        type: 'list',
        message: [`Attach ${selectedEnergyType} energy to which FieldCard?`],
        choices: fieldCardOptions
    });
    
    const fieldCardPosition = (await received)[0] as number;
    
    if (fieldCardPosition === -1) {
        await handleAction(cardRepository, intermediary, handlerData, responsesQueue);
        return;
    }
    
    responsesQueue.push(new AttachEnergyResponseMessage(fieldCardPosition));
}

/**
 * Handles the retreat action.
 * 
 * @param intermediary The intermediary
 * @param handlerData The handler data
 * @param responsesQueue The responses queue
 */
export async function handleRetreat(cardRepository: CardRepository, intermediary: Intermediary, handlerData: HandlerData, responsesQueue: HandlerResponsesQueue<ResponseMessage>): Promise<void> {
    const currentPlayer = handlerData.turn;
    const activeFieldCard = handlerData.field.creatures[currentPlayer][0]; // Position 0 is active
    const fieldCardData = cardRepository.getCreature(activeFieldCard.templateId);
    const benchedFieldCards = handlerData.field.creatures[currentPlayer].slice(1); // Positions 1+ are benched
    
    // Check if retreat is possible using ActionValidator
    if (!ActionValidator.canRetreat(handlerData, cardRepository, currentPlayer)) {
        if (benchedFieldCards.length === 0) {
            await intermediary.form({ type: 'print', message: ['No bench FieldCard to retreat to.'] });
        } else {
            const retreatCost = fieldCardData.retreatCost;
            const energyCount = EnergyController.getTotalEnergyByInstance(handlerData.energy, activeFieldCard.instanceId);
            await intermediary.form({ 
                type: 'print', 
                message: [`Cannot retreat: Need ${retreatCost} energy, but only have ${energyCount} attached.`] 
            });
        }
        await handleAction(cardRepository, intermediary, handlerData, responsesQueue);
        return;
    }
    
    const benchOptions = benchedFieldCards.map((fieldCard, index: number) => {
        const data = cardRepository.getCreature(fieldCard.templateId);
        const hp = Math.max(0, data.maxHp - fieldCard.damageTaken);
        return {
            name: `${data.name} (${hp} HP)`,
            value: index
        };
    });
    
    benchOptions.push({ name: 'Back', value: -1 });
    
    // Get retreat cost
    const retreatCost = fieldCardData.retreatCost || 0;
    
    const [sent, received] = intermediary.form({
        type: 'list',
        message: [`Retreat ${fieldCardData.name} (Cost: ${retreatCost} energy) - Choose replacement:`],
        choices: benchOptions
    });
    
    const benchIndex = (await received)[0] as number;
    
    if (benchIndex === -1) {
        await handleAction(cardRepository, intermediary, handlerData, responsesQueue);
        return;
    }
    
    // For now, retreat functionality is not fully implemented
    await intermediary.form({ type: 'print', message: ['Retreat functionality coming soon!'] });
    await handleAction(cardRepository, intermediary, handlerData, responsesQueue);
}

/**
 * Handles the ability action.
 * 
 * @param intermediary The intermediary
 * @param handlerData The handler data
 * @param responsesQueue The responses queue
 * @param actionType The action type
 */
export async function handleAbility(cardRepository: CardRepository, intermediary: Intermediary, handlerData: HandlerData, responsesQueue: HandlerResponsesQueue<ResponseMessage>, actionType: string): Promise<void> {
    const parts = actionType.split('-');
    const position = parts[1]; // 'active' or 'bench'
    
    let fieldCardPosition = 0;
    if (position === 'bench') {
        fieldCardPosition = parseInt(parts[2]) + 1; // bench index + 1
    }
    
    responsesQueue.push(new UseAbilityResponseMessage(fieldCardPosition));
}

/**
 * Handles the main action selection.
 * 
 * @param intermediary The intermediary
 * @param handlerData The handler data
 * @param responsesQueue The responses queue
 */
export async function handleAction(cardRepository: CardRepository, intermediary: Intermediary, handlerData: HandlerData, responsesQueue: HandlerResponsesQueue<ResponseMessage>): Promise<void> {
    const currentPlayer = handlerData.turn;
    
    // Define action options with availability checks using ActionValidator
    const actionOptions = [];
    
    // Check if any attacks are usable
    const activeFieldCard = handlerData.field.creatures[currentPlayer][0]; // Position 0 is active
    const fieldCardData = cardRepository.getCreature(activeFieldCard.templateId);
    
    // Use ActionValidator to check if attack is possible
    const hasUsableAttack = fieldCardData && fieldCardData.attacks && fieldCardData.attacks.some((_, index) => 
        ActionValidator.canUseAttack(handlerData, cardRepository, currentPlayer, index)
    );
    
    if (hasUsableAttack) {
        actionOptions.push({ name: 'Attack', value: 'attack' });
    }
    
    actionOptions.push({ name: 'Play a card', value: 'play' });
    
    // Check if any FieldCard can evolve
    const allFieldCards = [
        handlerData.field.creatures[currentPlayer],
        ...(handlerData.field.creatures[currentPlayer] || [])
    ].filter(Boolean);
    
    const canEvolve = allFieldCards.some((_, position) => 
        ActionValidator.canEvolveCreature(handlerData, cardRepository, currentPlayer, position)
    );
    
    if (canEvolve) {
        actionOptions.push({ name: 'Evolve FieldCard', value: 'evolve' });
    }
    
    // Check for usable abilities on active FieldCard
    const activeCreatureData = cardRepository.getCreature(activeFieldCard.templateId);
    if (activeCreatureData && activeCreatureData.ability) {
        if (ActionValidator.canUseAbility(handlerData, cardRepository, currentPlayer, 0)) {
            actionOptions.push({ name: `Use ${activeCreatureData.ability.name} (Active)`, value: `ability-active` });
        }
    }
    
    // Check bench FieldCard for abilities
    const benchFieldCards = handlerData.field.creatures[currentPlayer].slice(1); // Positions 1+ are benched
    benchFieldCards.forEach((fieldCard, benchIndex: number) => {
        const fieldCardData = cardRepository.getCreature(fieldCard.templateId);
        if (fieldCardData && fieldCardData.ability) {
            if (ActionValidator.canUseAbility(handlerData, cardRepository, currentPlayer, benchIndex + 1)) {
                actionOptions.push({ name: `Use ${fieldCardData.ability.name} (${fieldCardData.name})`, value: `ability-bench-${benchIndex}` });
            }
        }
    });
    
    // Check if energy can be attached
    if (ActionValidator.canAttachEnergy(handlerData, cardRepository, currentPlayer)) {
        actionOptions.push({ name: 'Attach Energy', value: 'attachEnergy' });
    }
    
    // Check if retreat is possible
    if (ActionValidator.canRetreat(handlerData, cardRepository, currentPlayer)) {
        actionOptions.push({ name: 'Retreat', value: 'retreat' });
    }
    
    actionOptions.push({ name: 'End turn', value: 'endTurn' });
    
    // Ask player to choose an action
    const [actionSent, actionReceived] = intermediary.form({
        type: 'list',
        message: [`Player ${currentPlayer + 1}, choose your action:`],
        choices: actionOptions
    });
    
    const actionType = (await actionReceived)[0] as string;
    
    if (actionType === 'attack') {
        await handleAttack(cardRepository, intermediary, handlerData, responsesQueue);
    } else if (actionType === 'play') {
        await handlePlayCard(cardRepository, intermediary, handlerData, responsesQueue);
    } else if (actionType === 'evolve') {
        await handleEvolve(cardRepository, intermediary, handlerData, responsesQueue);
    } else if (actionType === 'attachEnergy') {
        await handleAttachEnergy(cardRepository, intermediary, handlerData, responsesQueue);
    } else if (actionType === 'retreat') {
        await handleRetreat(cardRepository, intermediary, handlerData, responsesQueue);
    } else if (actionType.startsWith('ability-')) {
        await handleAbility(cardRepository, intermediary, handlerData, responsesQueue, actionType);
    } else if (actionType === 'endTurn') {
        // Inform the player
        await intermediary.form({ 
            type: 'print', 
            message: ['Ending your turn.'] 
        });
        
        // Send an endTurn action response
        responsesQueue.push(new EndTurnResponseMessage());
    }
}

/**
 * Shows the player's status.
 * 
 * @param intermediary The intermediary
 * @param handlerData The handler data
 * @param playerId The player ID
 */
export async function showPlayerStatus(cardRepository: CardRepository, intermediary: Intermediary, handlerData: HandlerData, playerId: number): Promise<void> {
    const hand = handlerData.hand;
    const activeFieldCard = handlerData.field.creatures[playerId][0]; // Position 0 is active
    const benchedFieldCards = handlerData.field.creatures[playerId].slice(1); // Positions 1+ are benched
    const supporterPlayed = handlerData.turnState.supporterPlayedThisTurn;
    
    // Get active FieldCard info with energy
    const fieldCardData = cardRepository.getCreature(activeFieldCard.templateId);
    const fieldCardName = fieldCardData.name;
    const maxHp = fieldCardData.maxHp;
    const fieldCardHp = Math.max(0, maxHp - activeFieldCard.damageTaken);
    const activeEnergyCount = EnergyController.getTotalEnergyByInstance(handlerData.energy, activeFieldCard.instanceId);
    const attachedEnergy = EnergyController.getAttachedEnergyByInstance(handlerData.energy, activeFieldCard.instanceId);
    const activeEnergyTypes = Object.entries(attachedEnergy)
        .filter(([_, count]) => (count as number) > 0)
        .map(([type, count]) => `${count}${type.charAt(0).toUpperCase()}`)
        .join(',') || '';
    
    // Get bench FieldCard info with energy
    const benchInfo = benchedFieldCards.map((fieldCard) => {
        const data = cardRepository.getCreature(fieldCard.templateId);
        const name = data.name;
        const maxHp = data.maxHp;
        const hp = Math.max(0, maxHp - fieldCard.damageTaken);
        const energyCount = EnergyController.getTotalEnergyByInstance(handlerData.energy, fieldCard.instanceId);
        const energy = EnergyController.getAttachedEnergyByInstance(handlerData.energy, fieldCard.instanceId);
        const energyTypes = Object.entries(energy)
            .filter(([_, count]) => (count as number) > 0)
            .map(([type, count]) => `${count}${type.charAt(0).toUpperCase()}`)
            .join(',') || '';
        const energyDisplay = energyCount > 0 ? ` [${energyCount}${energyTypes ? ':' + energyTypes : ''}]` : '';
        return `${name} (${hp}/${maxHp})${energyDisplay}`;
    }).join(', ');
    
    // Get status effects display using computed field
    const statusEffectsData = handlerData.statusEffects;
    const statusText = statusEffectsData ? 
        (statusEffectsData.activeStatusEffects[playerId] as unknown as StatusEffect[])?.length > 0 ? 
            ` [${(statusEffectsData.activeStatusEffects[playerId] as unknown as StatusEffect[]).map((e: StatusEffect) => e.type.toUpperCase()).join(', ')}]` : '' 
        : '';
    
    // Get hand summary
    const handSummary = hand.map((card) => {
        if (card.type === 'creature') {
            const data = cardRepository.getCreature(card.templateId);
            return data.name;
        } else if (card.type === 'supporter') {
            const data = cardRepository.getSupporter(card.templateId);
            return data.name;
        } else if (card.type === 'item') {
            const data = cardRepository.getItem(card.templateId);
            return data.name;
        }
        return 'Unknown';
    });
    
    const globalTurn = handlerData.turnCounter.turnNumber;
    const currentEnergyDict = handlerData.energy.currentEnergy[playerId];
    const nextEnergyDict = handlerData.energy.nextEnergy[playerId];
    const energyAttached = handlerData.energy.energyAttachedThisTurn[playerId];
    
    // Format energy dictionary for display
    const formatEnergyDict = (energyDict: EnergyDictionary) => {
        const energyTypes = Object.entries(energyDict)
            .filter(([_, count]) => (count as number) > 0)
            .map(([type, count]) => `${count}${type.charAt(0).toUpperCase()}`)
            .join(' ');
        return energyTypes.length > 0 ? energyTypes : 'None';
    };
    
    const currentEnergy = formatEnergyDict(currentEnergyDict);
    const nextEnergy = formatEnergyDict(nextEnergyDict);
    
    const activeEnergyDisplay = activeEnergyCount > 0 ? ` [${activeEnergyCount}${activeEnergyTypes ? ':' + activeEnergyTypes : ''}]` : '';
    
    const statusLines = [
        `=== Your Turn (Turn: ${globalTurn}) ===`,
        `Active: ${fieldCardName} (${fieldCardHp}/${maxHp})${activeEnergyDisplay}${statusText}`,
        `Bench (${benchedFieldCards.length}/3): ${benchInfo || 'None'}`,
        `Energy Zone: ${currentEnergy} (Next: ${nextEnergy}) - Attached this turn: ${energyAttached ? 'Yes' : 'No'}`,
        `Hand (${hand.length} cards): ${handSummary.join(', ')}`,
        `Supporter played this turn: ${supporterPlayed ? 'Yes' : 'No'}`,
        `================`
    ].join('\n');
    
    await intermediary.form({
        type: 'print',
        message: [statusLines]
    });
}
