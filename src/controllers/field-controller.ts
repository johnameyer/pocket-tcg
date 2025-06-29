import { GenericControllerProvider, GenericHandlerController, GlobalController, Serializable } from '@cards-ts/core';
import { CardRepositoryController } from './card-repository-controller.js';

export interface FieldCard {
    [key: string]: Serializable;
    
    id: number;
    damageTaken: number;
    cardId: string;
}

export interface FieldState {
    [key: string]: Serializable;
    
    // Active cards for each player
    activeCards: FieldCard[];
    
    // Benched cards for each player (up to 3 per player)
    benchedCards: FieldCard[][];
}

type FieldDependencies = { 
    players: GenericHandlerController<any, any>,
    cardRepository: CardRepositoryController
};

export class FieldControllerProvider implements GenericControllerProvider<FieldState, FieldDependencies, FieldController> {
    controller(state: FieldState, controllers: FieldDependencies): FieldController {
        return new FieldController(state, controllers);
    }

    initialState(controllers: FieldDependencies): FieldState {
        // Initialize with active and benched cards for each player
        return {
            activeCards: new Array(controllers.players.count).fill(undefined),
            benchedCards: new Array(controllers.players.count).fill(undefined)
                .map(() => [])
        };
    }

    dependencies() {
        return { players: true, cardRepository: true } as const;
    }
}

export class FieldController extends GlobalController<FieldState, FieldDependencies> {
    validate() {
        if (!Array.isArray(this.state.activeCards)) {
            throw new Error('Shape of object is wrong');
        }
    }

    // Get the active card for a player
    public getActiveCard(playerId: number) {
        const card = this.state.activeCards[playerId];
        
        // Check if card exists
        if (!card) {
            throw new Error(`No active card found for player ${playerId}`);
        }
        
        const { name, maxHp } = this.controllers.cardRepository.getCreature(card.cardId);
        
        return {
            ...card,
            name: name,
            hp: Math.max(0, maxHp - card.damageTaken),
            maxHp
        };
    }

    // Apply damage to a card and return the actual damage applied
    public applyDamage(playerId: number, damage: number): number {
        if (playerId < 0 || playerId >= this.state.activeCards.length) {
            throw new Error(`Invalid player ID: ${playerId}`);
        }
        
        const card = this.state.activeCards[playerId];
        
        // Check if card exists
        if (!card) {
            throw new Error(`No active card found for player ${playerId} when applying damage`);
        }
        
        // Check if cardId exists
        if (!card.cardId) {
            throw new Error(`No cardId found for player ${playerId}'s active card when applying damage`);
        }
        
        const { maxHp } = this.controllers.cardRepository.getCreature(card.cardId);
        
        // Cap damage to prevent health from going negative
        const actualDamage = Math.min(maxHp - card.damageTaken, damage);
        if (actualDamage > 0) {
            this.state.activeCards[playerId].damageTaken += actualDamage;
        }
        
        return actualDamage;
    }
    
    // Heal a card and return the actual healing done
    public healDamage(playerId: number, healing: number): number {
        if (playerId < 0 || playerId >= this.state.activeCards.length) {
            throw new Error(`Invalid player ID: ${playerId}`);
        }
        
        const card = this.state.activeCards[playerId];
        
        // Check if card exists
        if (!card) {
            throw new Error(`No active card found for player ${playerId} when healing damage`);
        }
        
        // Cap healing to prevent health from going above max
        const actualHealing = Math.min(card.damageTaken, healing);
        if (actualHealing > 0) {
            this.state.activeCards[playerId].damageTaken -= actualHealing;
        }
        
        return actualHealing;
    }
    
    // Heal a benched card and return the actual healing done
    public healBenchedCard(playerId: number, benchIndex: number, healing: number): number {
        if (playerId < 0 || playerId >= this.state.benchedCards.length) {
            throw new Error(`Invalid player ID: ${playerId}`);
        }
        
        if (benchIndex < 0 || benchIndex >= this.state.benchedCards[playerId].length) {
            throw new Error(`Invalid bench index: ${benchIndex}`);
        }
        
        const card = this.state.benchedCards[playerId][benchIndex];
        
        // Cap healing to prevent health from going above max
        const actualHealing = Math.min(card.damageTaken, healing);
        if (actualHealing > 0) {
            this.state.benchedCards[playerId][benchIndex].damageTaken -= actualHealing;
        }
        
        return actualHealing;
    }
    

    
    // Attack the opponent's card
    public attack(attackerId: number, attackIndex: number) {
        // Find the target (opponent)
        const targetId = (attackerId + 1) % this.controllers.players.count;
        const attackerCard = this.state.activeCards[attackerId];
        
        // Check if attacker card exists
        if (!attackerCard) {
            throw new Error(`No active card found for attacker ${attackerId}`);
        }
        
        // Check if target card exists
        if (!this.state.activeCards[targetId]) {
            throw new Error(`No active card found for target ${targetId}`);
        }
        
        // Get card data and attack
        const cardData = this.controllers.cardRepository.getCreature(attackerCard.cardId);
        if (attackIndex >= cardData.attacks.length) {
            throw new Error(`Invalid attack index for card ID ${attackerCard.cardId}`);
        }
        
        const attack = cardData.attacks[attackIndex];
        
        const actualDamage = this.applyDamage(targetId, attack.damage);
        
        // Check if knocked out
        const isKnockedOut = this.isKnockedOut(targetId);
        
        // Return the result of the attack
        return {
            attacker: this.getActiveCard(attackerId),
            target: this.getActiveCard(targetId),
            damage: actualDamage,
            isKnockedOut: isKnockedOut
        };
    }

    // Check if a player's active card is knocked out
    public isKnockedOut(playerId: number): boolean {
        const card = this.state.activeCards[playerId];
        
        // If there's no active card, throw an error
        if (!card) {
            throw new Error(`No active card found for player ${playerId} when checking knockout status`);
        }
        
        const { maxHp } = this.controllers.cardRepository.getCreature(card.cardId);

        return card.damageTaken >= maxHp;
    }
    
    // Check if a player has any cards left (active or benched)
    public hasRemainingCards(playerId: number): boolean {
        return this.state.benchedCards[playerId].length > 0;
    }
    
    // Set the active card for a player
    public setActiveCard(playerId: number, cardId: string): void {
        if (playerId < 0 || playerId >= this.state.activeCards.length) {
            throw new Error(`Invalid player ID: ${playerId}`);
        }
        
        // Vet validity of card
        this.controllers.cardRepository.getCreature(cardId);
        
        this.state.activeCards[playerId] = {
            id: playerId,
            damageTaken: 0,
            cardId: cardId
        };
    }
    
    // Add a card to a player's bench
    public addToBench(playerId: number, cardId: string): boolean {
        if (playerId < 0 || playerId >= this.state.benchedCards.length) {
            throw new Error(`Invalid player ID: ${playerId}`);
        }
        
        // Check if bench is full (max 3)
        if (this.state.benchedCards[playerId].length >= 3) {
            return false;
        }
        
        // Vet validity of card
        this.controllers.cardRepository.getCreature(cardId);
        
        this.state.benchedCards[playerId].push({
            id: this.state.benchedCards[playerId].length,
            damageTaken: 0,
            cardId: cardId
        });
        
        return true;
    }
    
    // Get a player's benched cards
    public getBenchedCards(playerId: number) {
        if (playerId < 0 || playerId >= this.state.benchedCards.length) {
            throw new Error(`Invalid player ID: ${playerId}`);
        }
        
        return this.state.benchedCards[playerId].map(card => {
            const { name, maxHp } = this.controllers.cardRepository.getCreature(card.cardId);
            
            return {
                ...card,
                name,
                hp: Math.max(0, maxHp - card.damageTaken),
                maxHp
            };
        });
    }
    
    // Move a card from bench to active position
    public promoteToBattle(playerId: number, benchIndex: number) {
        if (playerId < 0 || playerId >= this.state.benchedCards.length) {
            throw new Error(`Invalid player ID: ${playerId}`);
        }
        
        if (benchIndex < 0 || benchIndex >= this.state.benchedCards[playerId].length) {
            throw new Error(`Invalid bench index: ${benchIndex}`);
        }
        
        // Get the card from bench
        const card = this.state.benchedCards[playerId][benchIndex];
        
        // Remove from bench
        this.state.benchedCards[playerId].splice(benchIndex, 1);
        
        // Set as active
        this.state.activeCards[playerId] = card;
    }
    
    // Evolve the active card for a player
    public evolveActiveCard(playerId: number, evolutionCardId: string): boolean {
        if (playerId < 0 || playerId >= this.state.activeCards.length) {
            throw new Error(`Invalid player ID: ${playerId}`);
        }
        
        const cardData = this.controllers.cardRepository.getCreature(evolutionCardId);
        if (!cardData) {
            throw new Error(`Card not found: ${evolutionCardId}`);
        }
        
        // Keep the damage taken from the previous card
        const damageTaken = this.state.activeCards[playerId].damageTaken;
        
        // Replace the card ID but keep the damage
        this.state.activeCards[playerId] = {
            ...this.state.activeCards[playerId],
            cardId: evolutionCardId
        };
        
        return true;
    }
    
    // Evolve a benched card for a player
    public evolveBenchedCard(playerId: number, benchIndex: number, evolutionCardId: string): boolean {
        if (playerId < 0 || playerId >= this.state.benchedCards.length) {
            throw new Error(`Invalid player ID: ${playerId}`);
        }
        
        if (benchIndex < 0 || benchIndex >= this.state.benchedCards[playerId].length) {
            throw new Error(`Invalid bench index: ${benchIndex}`);
        }
        
        const cardData = this.controllers.cardRepository.getCreature(evolutionCardId);
        if (!cardData) {
            throw new Error(`Card not found: ${evolutionCardId}`);
        }
        
        // Keep the damage taken from the previous card
        const damageTaken = this.state.benchedCards[playerId][benchIndex].damageTaken;
        
        // Replace the card ID but keep the damage
        this.state.benchedCards[playerId][benchIndex] = {
            ...this.state.benchedCards[playerId][benchIndex],
            cardId: evolutionCardId
        };
        
        return true;
    }
}
