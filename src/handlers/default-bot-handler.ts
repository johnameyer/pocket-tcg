import { HandlerResponsesQueue } from '@cards-ts/core';
import { GameHandler, HandlerData } from '../game-handler.js';
import { SelectActiveCardResponseMessage, SetupCompleteResponseMessage, EvolveResponseMessage, AttackResponseMessage, PlayCardResponseMessage, EndTurnResponseMessage, AttachEnergyResponseMessage, SelectTargetResponseMessage, SelectEnergyResponseMessage, SelectCardResponseMessage, SelectChoiceResponseMessage } from '../messages/response/index.js';
import { ResponseMessage } from '../messages/response-message.js';
import { CardRepository } from '../repository/card-repository.js';
import { getCurrentTemplateId, getCurrentInstanceId } from '../utils/field-card-utils.js';
import { isPendingEnergySelection, isPendingCardSelection, isPendingChoiceSelection, isPendingFieldSelection } from '../effects/pending-selection-types.js';
import { ActionValidator } from '../effects/action-validator.js';

export class DefaultBotHandler extends GameHandler {
    private cardRepository: CardRepository;
    
    constructor(cardRepository?: CardRepository) {
        super();
        this.cardRepository = cardRepository || new CardRepository();
    }
    
    handleAction(handlerData: HandlerData, responsesQueue: HandlerResponsesQueue<ResponseMessage>): void {
        const currentPlayer = handlerData.turn;
        const hand = handlerData.hand.hand;

        // 1. Attach energy if available
        if (handlerData.energy) {
            const hasCurrentEnergy = handlerData.energy.currentEnergy[currentPlayer] != null;
            if (hasCurrentEnergy && !handlerData.energy.isAbsoluteFirstTurn) {
                responsesQueue.push(new AttachEnergyResponseMessage(0));
                return;
            }
        }

        // 2. Attack if ready
        const activeCard = handlerData.field.creatures[currentPlayer]?.[0];
        if (activeCard && handlerData.energy) {
            const creatureData = this.cardRepository.getCreature(getCurrentTemplateId(activeCard));
            const attack = creatureData?.attacks[0];
            if (attack) {
                const instanceId = getCurrentInstanceId(activeCard);
                const attachedEnergy = handlerData.energy.attachedEnergyByInstance?.[instanceId] ?? {};
                const totalEnergy = Object.values(attachedEnergy).reduce((sum: number, count: unknown) => sum + (typeof count === 'number' ? count : 0), 0);
                let canAttack = true;
                for (const requirement of attack.energyRequirements) {
                    if (requirement.type === 'any' || requirement.type === 'colorless') {
                        if (totalEnergy < requirement.amount) { canAttack = false; break; }
                    } else {
                        const typeCount = typeof attachedEnergy[requirement.type as keyof typeof attachedEnergy] === 'number'
                            ? attachedEnergy[requirement.type as keyof typeof attachedEnergy] as number : 0;
                        if (typeCount < requirement.amount) { canAttack = false; break; }
                    }
                }
                if (canAttack) {
                    responsesQueue.push(new AttackResponseMessage(0));
                    return;
                }
            }
        }

        // 3. Bench basic creatures (validated)
        const benchCreature = hand.find(card =>
            card.type === 'creature' && ActionValidator.canPlayCard(handlerData, this.cardRepository, card.templateId, currentPlayer),
        );
        if (benchCreature) {
            responsesQueue.push(new PlayCardResponseMessage(benchCreature.templateId, 'creature'));
            return;
        }

        // 4. Evolve all field positions
        const fieldCreatures = handlerData.field.creatures[currentPlayer] ?? [];
        for (let pos = 0; pos < fieldCreatures.length; pos++) {
            const creature = fieldCreatures[pos];
            if (!creature) continue;
            if (!ActionValidator.canEvolveCreature(handlerData, this.cardRepository, currentPlayer, pos)) continue;
            const currentTemplateId = getCurrentTemplateId(creature);
            const creatureData = this.cardRepository.getCreature(currentTemplateId);
            const evolutionCard = hand.find(card => {
                try {
                    const data = this.cardRepository.getCreature(card.templateId);
                    return data?.previousStageName === creatureData.name || data?.previousStageName === currentTemplateId;
                } catch { return false; }
            });
            if (evolutionCard) {
                responsesQueue.push(new EvolveResponseMessage(evolutionCard.templateId, pos));
                return;
            }
        }

        // 5. Play supporter (validated)
        const supporterCard = hand.find(card =>
            card.type === 'supporter' && ActionValidator.canPlayCard(handlerData, this.cardRepository, card.templateId, currentPlayer),
        );
        if (supporterCard) {
            responsesQueue.push(new PlayCardResponseMessage(supporterCard.templateId, 'supporter'));
            return;
        }

        // 6. Play item (validated)
        const itemCard = hand.find(card =>
            card.type === 'item' && ActionValidator.canPlayCard(handlerData, this.cardRepository, card.templateId, currentPlayer),
        );
        if (itemCard) {
            responsesQueue.push(new PlayCardResponseMessage(itemCard.templateId, 'item', currentPlayer, 0));
            return;
        }

        // 7. Attach tool to first creature without one
        const toolCard = hand.find(card =>
            card.type === 'tool' && ActionValidator.canPlayCard(handlerData, this.cardRepository, card.templateId, currentPlayer),
        );
        if (toolCard) {
            const attachedTools = (handlerData as any).tools?.attachedTools ?? {};
            const targetPos = fieldCreatures.findIndex(c => c?.fieldInstanceId && !attachedTools[c.fieldInstanceId]);
            if (targetPos !== -1) {
                responsesQueue.push(new PlayCardResponseMessage(toolCard.templateId, 'tool', currentPlayer, targetPos));
                return;
            }
        }

        // 8. Play stadium (validated)
        const stadiumCard = hand.find(card =>
            card.type === 'stadium' && ActionValidator.canPlayCard(handlerData, this.cardRepository, card.templateId, currentPlayer),
        );
        if (stadiumCard) {
            responsesQueue.push(new PlayCardResponseMessage(stadiumCard.templateId, 'stadium'));
            return;
        }

        responsesQueue.push(new EndTurnResponseMessage());
    }
    
    handleSelectActiveCard(handlerData: HandlerData, responsesQueue: HandlerResponsesQueue<ResponseMessage>): void {
        // Bot always selects the first benched card
        responsesQueue.push(new SelectActiveCardResponseMessage(0));
    }
    
    handleSetup(handlerData: HandlerData, responsesQueue: HandlerResponsesQueue<ResponseMessage>): void {
        const hand = handlerData.hand.hand;
        const creatureCards = hand.filter(card => card.type === 'creature');
        
        if (creatureCards.length > 0) {
            // Bot selects first creature as active, others for bench (max 3 bench)
            const activeCard = creatureCards[0];
            const benchCards = creatureCards.slice(1, 4);
            
            // Create a setup complete message with the selected cards
            responsesQueue.push(new SetupCompleteResponseMessage(
                activeCard.templateId,
                benchCards.map(card => card.templateId),
            ));
        } else {
            // No creature cards in hand, just complete setup with default
            responsesQueue.push(new SetupCompleteResponseMessage(
                'basic-creature', // Use a default creature ID
                [],
            ));
        }
    }
    
    handleSelectTarget(handlerData: HandlerData, responsesQueue: HandlerResponsesQueue<SelectTargetResponseMessage>): void {
        const pendingSelection = handlerData.turnState.pendingSelection;
        if (!pendingSelection || !isPendingFieldSelection(pendingSelection)) {
            return;
        }
        
        const { availableTargets } = pendingSelection;
        if (availableTargets.length === 0) {
            return;
        }
        
        // For bot: select first N available targets up to count
        const targetCount = Math.min(pendingSelection.count || 1, availableTargets.length);
        const selectedTargets = availableTargets.slice(0, targetCount).map(t => ({
            playerId: t.playerId,
            fieldIndex: t.fieldIndex,
        }));
        
        responsesQueue.push(new SelectTargetResponseMessage(selectedTargets));
    }
    
    handleSelectEnergy(handlerData: HandlerData, responsesQueue: HandlerResponsesQueue<SelectEnergyResponseMessage>): void {
        const pendingSelection = handlerData.turnState.pendingSelection;
        if (!pendingSelection || !isPendingEnergySelection(pendingSelection)) {
            return;
        }
        
        const count = pendingSelection.count || 1;
        // Select the first N available energy options (creature-level)
        const selectedTargets = pendingSelection.availableEnergy.slice(0, count).map(opt => ({
            playerId: opt.playerId,
            fieldIndex: opt.fieldIndex,
        }));
        responsesQueue.push(new SelectEnergyResponseMessage(selectedTargets));
    }
    
    handleSelectCard(handlerData: HandlerData, responsesQueue: HandlerResponsesQueue<SelectCardResponseMessage>): void {
        const pendingSelection = handlerData.turnState.pendingSelection;
        if (!pendingSelection || !isPendingCardSelection(pendingSelection)) {
            return;
        }
        
        const cardCount = pendingSelection.count || 1;
        // Select the first N available cards from the pending selection's available cards
        const selectedTemplateIds = pendingSelection.availableCards.slice(0, cardCount).map((card) => card.templateId);
        responsesQueue.push(new SelectCardResponseMessage(selectedTemplateIds));
    }
    
    handleSelectChoice(handlerData: HandlerData, responsesQueue: HandlerResponsesQueue<SelectChoiceResponseMessage>): void {
        const pendingSelection = handlerData.turnState.pendingSelection;
        if (!pendingSelection || !isPendingChoiceSelection(pendingSelection)) {
            return;
        }
        
        const choiceCount = pendingSelection.count || 1;
        const selectedChoices = pendingSelection.choices?.slice(0, choiceCount).map((choice) => choice.value) || [];
        responsesQueue.push(new SelectChoiceResponseMessage(selectedChoices));
    }
}
