import { Intermediary } from '@cards-ts/core';
import { HandlerResponsesQueue } from '@cards-ts/core';
import { GameHandler, HandlerData } from '../game-handler.js';
import { ResponseMessage } from '../messages/response-message.js';
import { SelectActiveCardResponseMessage, SelectTargetResponseMessage, SelectEnergyResponseMessage, SelectCardResponseMessage, SelectChoiceResponseMessage } from '../messages/response/index.js';
import { SetupCompleteResponseMessage } from '../messages/response/index.js';
import { FieldCard } from '../controllers/field-controller.js';
import { CardRepository } from '../repository/card-repository.js';
import { toFieldCard } from '../utils/field-card-utils.js';
import { isPendingFieldSelection, isPendingEnergySelection, isPendingCardSelection, isPendingChoiceSelection, PendingFieldSelection, PendingEnergySelection, PendingCardSelection, PendingChoiceSelection } from '../effects/pending-selection-types.js';
import { SingleChoiceFieldTarget } from '../repository/targets/field-target.js';
import * as helpers from './intermediary-handler-helpers.js';

export class IntermediaryHandler extends GameHandler {
    
    constructor(private intermediary: Intermediary, private cardRepository: CardRepository) {
        super();
    }
    
    async handleAction(handlerData: HandlerData, responsesQueue: HandlerResponsesQueue<ResponseMessage>): Promise<void> {
        const currentPlayer = handlerData.turn;
        
        // Get the active card for the current player
        const activeCard = handlerData.field.creatures?.[currentPlayer]?.[0];
        
        if (!activeCard) {
            return;
        }

        // Show player status at start of turn
        await helpers.showPlayerStatus(this.cardRepository, this.intermediary, handlerData, currentPlayer);

        // Handle actions for all players
        await helpers.handleAction(this.cardRepository, this.intermediary, handlerData, responsesQueue);
    }
    
    async handleSelectActiveCard(handlerData: HandlerData, responsesQueue: HandlerResponsesQueue<ResponseMessage>): Promise<void> {
        // Get the player who needs to select a new active card
        const playerId = handlerData.players.position;
        const cardRepo = this.cardRepository;
        
        // Get benched cards for the player
        const benchedCardsData = handlerData.field.creatures[playerId].map(toFieldCard);
        
        // Convert raw card data to display format with names and HP
        const benchedCards = benchedCardsData.map((card: FieldCard) => {
            const { name, maxHp } = cardRepo.getCreature(card.templateId);
            return {
                ...card,
                name,
                hp: Math.max(0, maxHp - card.damageTaken),
            };
        });
        
        if (benchedCards && benchedCards.length > 0) {
            // Create options for each benched card
            const benchOptions = benchedCards.map((card: FieldCard, index: number) => {
                const cardData = this.cardRepository.getCreature(card.templateId);
                return {
                    name: `${cardData.name} (HP: ${cardData.maxHp})`,
                    value: index,
                };
            });
            
            const [ sent, received ] = this.intermediary.form({ 
                type: 'list', 
                message: [ `Player ${playerId + 1}, select a card to make active:` ],
                choices: benchOptions,
            });
            
            const benchIndex = (await received)[0] as number;
            responsesQueue.push(new SelectActiveCardResponseMessage(benchIndex));
        }
    }
    
    async handleSetup(handlerData: HandlerData, responsesQueue: HandlerResponsesQueue<ResponseMessage>): Promise<void> {
        const currentPlayer = handlerData.turn;
        const hand = handlerData.hand;
        
        await this.intermediary.form({
            type: 'print',
            message: [ `Player ${currentPlayer + 1}, setup phase: Select cards for your team.` ],
        });
        
        const creatureCards = hand.filter(card => card.type === 'creature');
        
        if (creatureCards.length === 0) {
            await this.intermediary.form({
                type: 'print',
                message: [ 'No creature cards in hand. Finishing setup.' ],
            });
            responsesQueue.push(new SetupCompleteResponseMessage('basic-creature', []));
            return;
        }
        
        // Let player select multiple creature cards using checkbox
        const creatureOptions = creatureCards.map((card, index) => {
            const creatureData = this.cardRepository.getCreature(card.templateId);
            const originalIndex = hand.findIndex(handCard => handCard === card);
            return {
                name: creatureData?.name || 'Creature',
                value: originalIndex,
            };
        });
        
        const [ checkboxSent, checkboxReceived ] = this.intermediary.form({
            type: 'checkbox',
            message: [ 'Select creatures for your team (1 active + up to 3 bench):' ],
            choices: creatureOptions,
            validate: (selected: number[]) => {
                if (selected.length === 0) {
                    return 'Must select at least one creature'; 
                }
                if (selected.length > 4) {
                    return 'Can select maximum 4 creatures (1 active + 3 bench)'; 
                }
                return true;
            },
        });
        
        const selectedIndices = (await checkboxReceived)[0] as number[];
        
        if (selectedIndices.length === 0) {
            // Default to first creature
            selectedIndices.push(creatureOptions[0].value);
        }
        
        // Choose which creature to make active
        const activeOptions = selectedIndices.map(index => {
            const card = hand[index];
            const creatureData = this.cardRepository.getCreature(card.templateId);
            return {
                name: creatureData?.name || 'Creature',
                value: card.templateId,
            };
        });
        
        const [ activeSent, activeReceived ] = this.intermediary.form({
            type: 'list',
            message: [ 'Choose your active creature:' ],
            choices: activeOptions,
        });
        
        const activeCardId = (await activeReceived)[0] as string;
        const benchCardIds = selectedIndices
            .map(index => hand[index].templateId)
            .filter(cardId => cardId !== activeCardId);
        
        responsesQueue.push(new SetupCompleteResponseMessage(activeCardId, benchCardIds));
    }
    
    async handleSelectTarget(handlerData: HandlerData, responsesQueue: HandlerResponsesQueue<SelectTargetResponseMessage>): Promise<void> {
        const pendingSelection = handlerData.turnState.pendingSelection;
        if (!pendingSelection || !isPendingFieldSelection(pendingSelection)) {
            return;
        }
        
        await this.handleTargetSelection(handlerData, responsesQueue, pendingSelection);
    }
    
    async handleSelectEnergy(handlerData: HandlerData, responsesQueue: HandlerResponsesQueue<SelectEnergyResponseMessage>): Promise<void> {
        const pendingSelection = handlerData.turnState.pendingSelection;
        if (!pendingSelection || !isPendingEnergySelection(pendingSelection)) {
            return;
        }
        
        await this.handleEnergySelection(handlerData, responsesQueue, pendingSelection);
    }
    
    async handleSelectCard(handlerData: HandlerData, responsesQueue: HandlerResponsesQueue<SelectCardResponseMessage>): Promise<void> {
        const pendingSelection = handlerData.turnState.pendingSelection;
        if (!pendingSelection || !isPendingCardSelection(pendingSelection)) {
            return;
        }
        
        await this.handleCardInHandSelection(handlerData, responsesQueue, pendingSelection);
    }
    
    async handleSelectChoice(handlerData: HandlerData, responsesQueue: HandlerResponsesQueue<SelectChoiceResponseMessage>): Promise<void> {
        const pendingSelection = handlerData.turnState.pendingSelection;
        if (!pendingSelection || !isPendingChoiceSelection(pendingSelection)) {
            return;
        }
        
        await this.handleChoiceSelection(handlerData, responsesQueue, pendingSelection);
    }
    
    private async handleTargetSelection(handlerData: HandlerData, responsesQueue: HandlerResponsesQueue<SelectTargetResponseMessage | ResponseMessage>, pendingSelection: PendingFieldSelection): Promise<void> {
        const { count = 1, minTargets, maxTargets, availableTargets } = pendingSelection;
        
        if (availableTargets.length === 0) {
            return;
        }
        
        // Convert available targets to options for the form
        const targetOptions = availableTargets.map((target, index) => ({
            name: `${target.name} (${target.hp} HP) - ${target.position === 'active' ? 'Active' : 'Bench'}`,
            value: index,
        }));
        
        // Determine the appropriate message based on the effect type
        let effectMessage = count > 1 ? `Select ${count} target(s):` : 'Choose target for the effect:';
        if (pendingSelection.effect.type === 'switch') {
            const target = 'target' in pendingSelection.effect ? pendingSelection.effect.target : undefined;
            if (target && typeof target === 'object' && 'type' in target && (target as SingleChoiceFieldTarget).type === 'single-choice' && (target as SingleChoiceFieldTarget).chooser === 'opponent') {
                effectMessage = 'Choose which of your FieldCard to switch in:';
            } else {
                effectMessage = 'Choose which FieldCard to force into battle:';
            }
        }
        
        if (count === 1) {
            // Single selection
            const [ sent, received ] = this.intermediary.form({
                type: 'list',
                message: [ effectMessage ],
                choices: targetOptions,
            });
            
            const selectedIndex = (await received)[0] as number;
            const selectedTarget = availableTargets[selectedIndex];
            responsesQueue.push(new SelectTargetResponseMessage([{
                playerId: selectedTarget.playerId,
                fieldIndex: selectedTarget.fieldIndex,
            }]));
        } else {
            // Multiple selection
            const minCount = minTargets || count;
            const maxCount = maxTargets || count;
            
            const [ sent, received ] = this.intermediary.form({
                type: 'checkbox',
                message: [ effectMessage ],
                choices: targetOptions,
                validate: (selected: number[]) => {
                    if (selected.length < minCount) {
                        return `Must select at least ${minCount} targets`;
                    }
                    if (selected.length > maxCount) {
                        return `Cannot select more than ${maxCount} targets`;
                    }
                    return true;
                },
            });
            
            const selectedIndices = (await received)[0] as number[];
            const targets = selectedIndices.map(index => {
                const targetOption = availableTargets[index];
                return {
                    playerId: targetOption.playerId,
                    fieldIndex: targetOption.fieldIndex,
                };
            });
            
            responsesQueue.push(new SelectTargetResponseMessage(targets));
        }
    }
    
    private async handleEnergySelection(handlerData: HandlerData, responsesQueue: HandlerResponsesQueue<ResponseMessage>, pendingSelection: PendingEnergySelection): Promise<void> {
        const { count, availableEnergy } = pendingSelection;
        
        if (availableEnergy.length === 0) {
            return;
        }
        
        // Build one option per available creature (each EnergyOption is a creature with matching energy)
        const energyOptions = availableEnergy.map((opt, index) => {
            const energySummary = Object.entries(opt.availableEnergy)
                .filter(([ , amount ]) => amount && amount > 0)
                .map(([ type, amount ]) => `${amount}x ${type}`)
                .join(', ');
            return {
                name: `${opt.displayName} (${energySummary})`,
                value: index,
            };
        });
        
        const prompt = pendingSelection.prompt || `Select ${count} creature${count !== 1 ? 's' : ''} to take energy from:`;
        
        if (count === 1) {
            const [ sent, received ] = this.intermediary.form({
                type: 'list',
                message: [ prompt ],
                choices: energyOptions,
            });
            
            const selectedIndex = (await received)[0] as number;
            const selectedOpt = availableEnergy[selectedIndex];
            responsesQueue.push(new SelectEnergyResponseMessage([{
                playerId: selectedOpt.playerId,
                fieldIndex: selectedOpt.fieldIndex,
            }]));
        } else {
            const [ sent, received ] = this.intermediary.form({
                type: 'checkbox',
                message: [ prompt ],
                choices: energyOptions,
                validate: (selected: number[]) => {
                    if (selected.length !== count) {
                        return `Must select exactly ${count} creature${count !== 1 ? 's' : ''}`;
                    }
                    return true;
                },
            });
            
            const selectedIndices = (await received)[0] as number[];
            const selectedTargets = selectedIndices.map(index => ({
                playerId: availableEnergy[index].playerId,
                fieldIndex: availableEnergy[index].fieldIndex,
            }));
            responsesQueue.push(new SelectEnergyResponseMessage(selectedTargets));
        }
    }
    
    private async handleCardInHandSelection(handlerData: HandlerData, responsesQueue: HandlerResponsesQueue<ResponseMessage>, pendingSelection: PendingCardSelection): Promise<void> {
        const { count, availableCards } = pendingSelection;
        
        if (availableCards.length === 0) {
            return;
        }
        
        // Create options for each available card using templateIds from the pending selection
        const cardOptions = availableCards.map((card) => {
            let cardName = card.templateId;
            
            // Try to get the card name from repository
            try {
                if (card.type === 'creature') {
                    cardName = this.cardRepository.getCreature(card.templateId).name;
                } else if (card.type === 'supporter') {
                    cardName = this.cardRepository.getSupporter(card.templateId).name;
                } else if (card.type === 'item') {
                    cardName = this.cardRepository.getItem(card.templateId).name;
                } else if (card.type === 'tool') {
                    cardName = this.cardRepository.getTool(card.templateId).name;
                }
            } catch (e) {
                // Keep templateId if lookup fails
            }
            
            return {
                name: cardName,
                value: card.templateId,
            };
        });
        
        const prompt = pendingSelection.prompt || `Select ${count} card(s):`;
        
        if (count === 1) {
            // Single selection
            const [ sent, received ] = this.intermediary.form({
                type: 'list',
                message: [ prompt ],
                choices: cardOptions,
            });
            
            const selected = (await received)[0] as string;
            responsesQueue.push(new SelectCardResponseMessage([ selected ]));
        } else {
            // Multiple selection
            const minCount = pendingSelection.minCount ?? count;
            const maxCount = pendingSelection.maxCount ?? count;
            
            const [ sent, received ] = this.intermediary.form({
                type: 'checkbox',
                message: [ prompt ],
                choices: cardOptions,
                validate: (selected: string[]) => {
                    if (selected.length < minCount) {
                        return `Must select at least ${minCount} card${minCount !== 1 ? 's' : ''}`;
                    }
                    if (selected.length > maxCount) {
                        return `Cannot select more than ${maxCount} card${maxCount !== 1 ? 's' : ''}`;
                    }
                    return true;
                },
            });
            
            const selected = (await received)[0] as string[];
            responsesQueue.push(new SelectCardResponseMessage(selected));
        }
    }
    
    private async handleChoiceSelection(handlerData: HandlerData, responsesQueue: HandlerResponsesQueue<ResponseMessage>, pendingSelection: PendingChoiceSelection): Promise<void> {
        const { choices, count, maxCount } = pendingSelection;
        
        if (!choices || choices.length === 0) {
            return;
        }
        
        const prompt = pendingSelection.prompt || 'Make a selection:';
        const allowMultiple = count > 1 || (maxCount && maxCount > 1);
        
        if (!allowMultiple) {
            // Single selection
            const [ sent, received ] = this.intermediary.form({
                type: 'list',
                message: [ prompt ],
                choices: choices,
            });
            
            const selected = (await received)[0] as string;
            responsesQueue.push(new SelectChoiceResponseMessage([ selected ]));
        } else {
            // Multiple selection
            const [ sent, received ] = this.intermediary.form({
                type: 'checkbox',
                message: [ prompt ],
                choices: choices,
            });
            
            const selected = (await received)[0] as string[];
            responsesQueue.push(new SelectChoiceResponseMessage(selected));
        }
    }
}
