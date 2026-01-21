import { GenericControllerProvider, GenericHandlerController, GlobalController, Serializable, SystemHandlerParams } from '@cards-ts/core';
import { CardRepositoryController } from './card-repository-controller.js';
import { ToolController } from './tool-controller.js';
import { EnergyController } from './energy-controller.js';
import { StatusEffectController } from './status-effect-controller.js';
import { DiscardController } from './discard-controller.js';
import { CreatureData, InstancedFieldCard } from '../repository/card-types.js';
import { AttackDamageResolver } from '../effects/attack-damage-resolver.js';
import { ResponseMessage } from '../messages/response-message.js';
import { GameHandlerParams } from '../game-handler-params.js';
import { getCurrentInstanceId, getCurrentTemplateId, toFieldCard, createInstancedFieldCard, addEvolution } from '../utils/field-card-utils.js';

export type FieldCard = {
    instanceId: string; // Unique instance ID for this specific card copy
    damageTaken: number;
    templateId: string; // Card template ID for the card
    turnPlayed?: number; // Track when the card was played for evolution restrictions
};

export type EnrichedFieldCard = FieldCard & { data: CreatureData };

export type FieldState = {
    // Creatures for each player - position 0 is active, 1+ are bench
    // Internal state uses InstancedFieldCard for evolution tracking
    creatures: InstancedFieldCard[][];
    // Track if each player can evolve their active card
    canEvolveActive?: boolean[];
};

type FieldDependencies = { 
    players: GenericHandlerController<ResponseMessage, GameHandlerParams & SystemHandlerParams>,
    cardRepository: CardRepositoryController,
    tools: ToolController,
    energy: EnergyController,
    statusEffects: StatusEffectController,
    discard: DiscardController
};

export class FieldControllerProvider implements GenericControllerProvider<FieldState, FieldDependencies, FieldController> {
    controller(state: FieldState, controllers: FieldDependencies): FieldController {
        return new FieldController(state, controllers);
    }

    initialState(controllers: FieldDependencies): FieldState {
        // Initialize with creatures array for each player
        return {
            creatures: new Array(controllers.players.count).fill(undefined)
                .map(() => []),
            canEvolveActive: new Array(controllers.players.count).fill(false)
        };
    }

    dependencies() {
        return { players: true, cardRepository: true, tools: true, energy: true, statusEffects: true, discard: true } as const;
    }
}

export class FieldController extends GlobalController<FieldState, FieldDependencies> {
    validate() {
        if (!Array.isArray(this.state.creatures)) {
            throw new Error('Shape of object is wrong');
        }
    }

    // Get the card at a specific position for a player
    public getCardByPosition(playerId: number, position: number): EnrichedFieldCard | undefined {
        const card = this.state.creatures[playerId]?.[position];
        if (!card) return undefined;
        
        const fieldCard = toFieldCard(card);
        const data = this.controllers.cardRepository.getCreature(fieldCard.templateId);
        return { ...fieldCard, data };
    }

    // Get all cards for a player
    public getCards(playerId: number): EnrichedFieldCard[] {
        return this.state.creatures[playerId]?.map(card => {
            const fieldCard = toFieldCard(card);
            const data = this.controllers.cardRepository.getCreature(fieldCard.templateId);
            return { ...fieldCard, data };
        }) || [];
    }

    // Get raw field card data (without enrichment) - for internal use
    public getRawCardByPosition(playerId: number, position: number): FieldCard | undefined {
        const card = this.state.creatures[playerId]?.[position];
        if (!card) return undefined;
        return toFieldCard(card);
    }

    // Apply damage to a card at any position and return the actual damage applied
    public applyDamage(playerId: number, damage: number, position: number = 0): number {
        if (playerId < 0 || playerId >= this.state.creatures.length) {
            throw new Error(`Invalid player ID: ${playerId}`);
        }
        
        const card = this.state.creatures[playerId]?.[position];
        
        // Check if card exists
        if (!card) {
            throw new Error(`No card found for player ${playerId} at position ${position} when applying damage`);
        }
        
        const templateId = getCurrentTemplateId(card);
        
        // Check if templateId exists
        if (!templateId) {
            throw new Error(`No templateId found for player ${playerId}'s card at position ${position} when applying damage`);
        }
        
        const { maxHp } = this.controllers.cardRepository.getCreature(templateId);
        
        // Get HP bonus from attached tools
        const instanceId = getCurrentInstanceId(card);
        const hpBonus = this.controllers.tools.getHpBonus(instanceId);
        const totalMaxHp = maxHp + hpBonus;
        
        // Cap damage to prevent health from going negative
        const actualDamage = Math.min(totalMaxHp - card.damageTaken, damage);
        if (actualDamage > 0) {
            this.state.creatures[playerId][position].damageTaken += actualDamage;
        }
        
        return actualDamage;
    }
    
    // Heal a card and return the actual healing done
    public healDamage(playerId: number, healing: number): number {
        if (playerId < 0 || playerId >= this.state.creatures.length) {
            throw new Error(`Invalid player ID: ${playerId}`);
        }
        
        const card = this.state.creatures[playerId]?.[0]; // Active card is at position 0
        
        // Check if card exists
        if (!card) {
            throw new Error(`No active card found for player ${playerId} when healing damage`);
        }
        
        // Cap healing to prevent health from going above max
        const actualHealing = Math.min(card.damageTaken, healing);
        if (actualHealing > 0) {
            this.state.creatures[playerId][0].damageTaken -= actualHealing;
        }
        
        return actualHealing;
    }
    
    // Heal a benched card and return the actual healing done
    public healBenchedCard(playerId: number, benchIndex: number, healing: number): number {
        if (playerId < 0 || playerId >= this.state.creatures.length) {
            throw new Error(`Invalid player ID: ${playerId}`);
        }
        
        const benchPosition = benchIndex + 1; // Bench starts at position 1
        if (benchPosition < 1 || benchPosition >= this.state.creatures[playerId].length) {
            throw new Error(`Invalid bench index: ${benchIndex}`);
        }
        
        const card = this.state.creatures[playerId][benchPosition];
        
        // Cap healing to prevent health from going above max
        const actualHealing = Math.min(card.damageTaken, healing);
        if (actualHealing > 0) {
            this.state.creatures[playerId][benchPosition].damageTaken -= actualHealing;
        }
        
        return actualHealing;
    }
    
    // Attack the opponent's card
    public attack(attackerId: number, attackIndex: number, resolvedDamage?: number) {
        // Find the target (opponent)
        const targetId = (attackerId + 1) % this.controllers.players.count;
        const attackerCard = this.state.creatures[attackerId]?.[0]; // Active card is at position 0
        
        // Check if attacker card exists
        if (!attackerCard) {
            throw new Error(`No active card found for attacker ${attackerId}`);
        }
        
        // Check if target card exists
        if (!this.state.creatures[targetId]?.[0]) {
            throw new Error(`No active card found for target ${targetId}`);
        }
        
        // Get card data and attack
        const attackerTemplateId = getCurrentTemplateId(attackerCard);
        const cardData = this.controllers.cardRepository.getCreature(attackerTemplateId);
        if (attackIndex >= cardData.attacks.length) {
            throw new Error(`Invalid attack index for card ID ${attackerTemplateId}`);
        }
        
        const attack = cardData.attacks[attackIndex];
        
        // Use resolved damage if provided, otherwise calculate simple damage
        let damageAmount: number;
        if (resolvedDamage !== undefined) {
            damageAmount = resolvedDamage;
        } else {
            // Fallback to simple damage calculation
            damageAmount = typeof attack.damage === 'number' ? attack.damage : 0;
        }
        
        const actualDamage = this.applyDamage(targetId, damageAmount);
        
        // Check if knocked out
        const isKnockedOut = this.isKnockedOut(targetId);
        
        // Return the result of the attack
        return {
            attacker: this.getCardByPosition(attackerId, 0),
            target: this.getCardByPosition(targetId, 0),
            damage: actualDamage,
            isKnockedOut: isKnockedOut
        };
    }

    // Check if a player's active card is knocked out
    public isKnockedOut(playerId: number): boolean {
        const card = this.state.creatures[playerId]?.[0]; // Active card is at position 0
        
        // If there's no active card, throw an error
        if (!card) {
            throw new Error(`No active card found for player ${playerId} when checking knockout status`);
        }
        
        const templateId = getCurrentTemplateId(card);
        const { maxHp } = this.controllers.cardRepository.getCreature(templateId);

        return card.damageTaken >= maxHp;
    }

    // Remove a card from the bench (for knockouts) and discard it
    public removeBenchCard(playerId: number, benchIndex: number): void {
        const benchPosition = benchIndex + 1; // Bench starts at position 1
        if (benchPosition < this.state.creatures[playerId].length) {
            const removedCard = this.state.creatures[playerId][benchPosition];
            this.state.creatures[playerId].splice(benchPosition, 1);
            // Automatically discard the removed card
            this.controllers.discard.discardFieldCard(playerId, removedCard);
        }
    }

    // Retreat active creature with a bench creature
    public retreat(playerId: number, benchIndex: number): boolean {
        const activeCard = this.state.creatures[playerId]?.[0];
        const benchCards = this.state.creatures[playerId].slice(1);
        
        if (!activeCard || benchIndex < 0 || benchIndex >= benchCards.length) {
            return false;
        }
        
        const benchCard = benchCards[benchIndex];
        if (!benchCard) {
            return false;
        }
        
        // Note: Energy payment is handled by the event handler
        
        // Clear status effects on retreat
        this.controllers.statusEffects.clearAllStatusEffects(playerId);
        
        // Swap active and bench creature
        this.state.creatures[playerId][0] = benchCard;
        this.state.creatures[playerId][benchIndex + 1] = activeCard;
        
        return true;
    }
    
    // Check if a player has any cards left (benched cards)
    public hasRemainingCards(playerId: number): boolean {
        return this.state.creatures[playerId].length > 1; // More than just active card
    }
    
    // Set the active card for a player
    public setActiveCard(playerId: number, templateId: string, instanceId?: string): void {
        if (playerId < 0 || playerId >= this.state.creatures.length) {
            throw new Error(`Invalid player ID: ${playerId}`);
        }
        
        // Vet validity of card
        this.controllers.cardRepository.getCreature(templateId);
        
        // Ensure the player's creatures array exists
        if (!this.state.creatures[playerId]) {
            this.state.creatures[playerId] = [];
        }
        
        // Use provided instanceId or generate a new one
        const cardInstanceId = instanceId ?? `${templateId}-${Date.now()}-${Math.random()}`;
        
        this.state.creatures[playerId][0] = createInstancedFieldCard(
            cardInstanceId,
            templateId,
            0
        );
    }
    
    // Add a card to a player's bench
    public addToBench(playerId: number, templateId: string, instanceId?: string): boolean {
        if (playerId < 0 || playerId >= this.state.creatures.length) {
            throw new Error(`Invalid player ID: ${playerId}`);
        }
        
        // Ensure the player's creatures array exists
        if (!this.state.creatures[playerId]) {
            this.state.creatures[playerId] = [];
        }
        
        // Check if bench is full (max 3 benched + 1 active = 4 total)
        if (this.state.creatures[playerId].length >= 4) {
            return false;
        }
        
        // Vet validity of card
        this.controllers.cardRepository.getCreature(templateId);
        
        // Use provided instanceId or generate a new one
        const cardInstanceId = instanceId ?? `${templateId}-${Date.now()}-${Math.random()}`;
        
        this.state.creatures[playerId].push(createInstancedFieldCard(
            cardInstanceId,
            templateId,
            0
        ));
        
        return true;
    }

    
    // Move a card from bench to active position (discarding the old active card if it exists)
    public promoteToBattle(playerId: number, benchIndex: number) {
        if (playerId < 0 || playerId >= this.state.creatures.length) {
            throw new Error(`Invalid player ID: ${playerId}`);
        }
        
        const benchPosition = benchIndex + 1; // Bench starts at position 1
        if (benchPosition < 1 || benchPosition >= this.state.creatures[playerId].length) {
            throw new Error(`Invalid bench index: ${benchIndex}`);
        }
        
        // Get the card from bench
        const card = this.state.creatures[playerId][benchPosition];
        
        // Discard the old active card if it exists (e.g., when it's knocked out)
        const oldActiveCard = this.state.creatures[playerId][0];
        if (oldActiveCard) {
            this.controllers.discard.discardFieldCard(playerId, oldActiveCard);
        }
        
        // Remove from bench
        this.state.creatures[playerId].splice(benchPosition, 1);
        
        // Set as active (position 0)
        this.state.creatures[playerId][0] = card;
    }
    
    // Evolve the active card for a player
    public evolveActiveCard(playerId: number, evolutionTemplateId: string, evolutionInstanceId?: string, turnNumber?: number): boolean {
        if (playerId < 0 || playerId >= this.state.creatures.length) {
            throw new Error(`Invalid player ID: ${playerId}`);
        }
        
        const cardData = this.controllers.cardRepository.getCreature(evolutionTemplateId);
        if (!cardData) {
            throw new Error(`Card not found: ${evolutionTemplateId}`);
        }
        
        const oldCard = this.state.creatures[playerId][0];
        
        // Use provided instanceId or generate a new one for the evolution
        const newInstanceId = evolutionInstanceId ?? `${evolutionTemplateId}-${Date.now()}-${Math.random()}`;
        
        // Add the evolution to the stack (keeping previous forms)
        this.state.creatures[playerId][0] = addEvolution(
            oldCard,
            newInstanceId,
            evolutionTemplateId,
            turnNumber ?? 0
        );
        
        return true;
    }
    
    // Evolve a benched card for a player
    public evolveBenchedCard(playerId: number, benchIndex: number, evolutionTemplateId: string, evolutionInstanceId?: string, turnNumber?: number): boolean {
        if (playerId < 0 || playerId >= this.state.creatures.length) {
            throw new Error(`Invalid player ID: ${playerId}`);
        }
        
        const benchPosition = benchIndex + 1; // Bench starts at position 1
        if (benchPosition < 1 || benchPosition >= this.state.creatures[playerId].length) {
            throw new Error(`Invalid bench index: ${benchIndex}`);
        }
        
        const cardData = this.controllers.cardRepository.getCreature(evolutionTemplateId);
        if (!cardData) {
            throw new Error(`Card not found: ${evolutionTemplateId}`);
        }
        
        const oldCard = this.state.creatures[playerId][benchPosition];
        
        // Use provided instanceId or generate a new one for the evolution
        const newInstanceId = evolutionInstanceId ?? `${evolutionTemplateId}-${Date.now()}-${Math.random()}`;
        
        // Add the evolution to the stack (keeping previous forms)
        this.state.creatures[playerId][benchPosition] = addEvolution(
            oldCard,
            newInstanceId,
            evolutionTemplateId,
            turnNumber ?? 0
        );
        
        return true;
    }

    // Update evolution availability for a player
    public updateCanEvolveActive(playerId: number, canEvolve: boolean): void {
        if (!this.state.canEvolveActive) {
            this.state.canEvolveActive = new Array(this.controllers.players.count).fill(false);
        }
        this.state.canEvolveActive[playerId] = canEvolve;
    }

    public getPlayedCards(playerId: number): EnrichedFieldCard[] {
        // Return all cards on the field (active + bench)
        return this.getCards(playerId);
    }

    public forceEvolveCard(playerId: number, templateId: string): boolean {
        // Force evolve the active card
        return this.evolveActiveCard(playerId, templateId);
    }

    public forceSwitch(playerId: number, benchIndex: number): void {
        if (playerId < 0 || playerId >= this.state.creatures.length) {
            throw new Error(`Invalid player ID: ${playerId}`);
        }
        
        const benchPosition = benchIndex + 1; // Bench starts at position 1
        if (benchPosition < 1 || benchPosition >= this.state.creatures[playerId].length) {
            throw new Error(`Invalid bench index: ${benchIndex}`);
        }
        
        // Get the current active card and the bench card
        const activeCard = this.state.creatures[playerId][0];
        const benchCard = this.state.creatures[playerId][benchPosition];
        
        // Swap them
        this.state.creatures[playerId][0] = benchCard;
        this.state.creatures[playerId][benchPosition] = activeCard;
    }
}
