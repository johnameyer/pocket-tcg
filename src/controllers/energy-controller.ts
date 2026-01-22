import { GenericControllerProvider, GenericHandlerController, GlobalController, Serializable, SystemHandlerParams } from '@cards-ts/core';
import { ResponseMessage } from '../messages/response-message.js';
import { GameHandlerParams } from '../game-handler-params.js';

// TODO: Energy system needs user choice for energy discard (retreat, attack effects)
// Can we create a string const array and define off that as typeof?
import { AttachableEnergyType, EnergyRequirementType } from '../repository/energy-types.js';
import { TurnCounterController } from './turn-counter-controller.js';

export { AttachableEnergyType };

export type EnergyDictionary = {
    [K in AttachableEnergyType]: number;
};

export type AttachedEnergy = {
    type: AttachableEnergyType;
};

export type EnergyState = {
    // Current energy available for attachment per player
    currentEnergy: (AttachableEnergyType | null)[];
    
    // Next turn's energy preview per player
    nextEnergy: (AttachableEnergyType | null)[];
    
    // Energy attached to card instances (indexed by instance ID)
    attachedEnergyByInstance: { [instanceId: string]: EnergyDictionary };
    
    // Energy types available for generation (based on deck)
    availableTypes: AttachableEnergyType[][];
    
    // Track if this is the very first turn of the game
    isAbsoluteFirstTurn: boolean;
}

type EnergyDependencies = { 
    players: GenericHandlerController<ResponseMessage, GameHandlerParams & SystemHandlerParams>,
    turnCounter: TurnCounterController
};

export class EnergyControllerProvider implements GenericControllerProvider<EnergyState, EnergyDependencies, EnergyController> {
    controller(state: EnergyState, controllers: EnergyDependencies): EnergyController {
        return new EnergyController(state, controllers);
    }

    initialState(controllers: EnergyDependencies): EnergyState {
        return {
            currentEnergy: new Array(controllers.players.count).fill(null),
            nextEnergy: new Array(controllers.players.count).fill(null),
            attachedEnergyByInstance: {},
            availableTypes: new Array(controllers.players.count).fill(undefined).map(() => 
                ['fire', 'water', 'lightning', 'grass', 'psychic', 'fighting', 'darkness', 'metal']
            ),
            isAbsoluteFirstTurn: true
        };
    }

    dependencies() {
        return { players: true, turnCounter: true } as const;
    }
}

export class EnergyController extends GlobalController<EnergyState, EnergyDependencies> {
    public static emptyEnergyDict(): EnergyDictionary {
        return {
            grass: 0, fire: 0, water: 0, lightning: 0,
            psychic: 0, fighting: 0, darkness: 0, metal: 0
        };
    }

    // Static helper functions for handlers to work with energy state directly
    static getTotalEnergyByInstance(energyState: EnergyState, instanceId: string): number {
        const attached = energyState.attachedEnergyByInstance[instanceId];
        if (!attached) return 0;
        return Object.values(attached as EnergyDictionary).reduce((sum, count) => sum + count, 0);
    }

    static getAttachedEnergyByInstance(energyState: EnergyState, instanceId: string): EnergyDictionary {
        return energyState.attachedEnergyByInstance[instanceId] || EnergyController.emptyEnergyDict();
    }

    static canUseAttackByInstance(energyState: EnergyState, instanceId: string, requiredEnergy: { type: string, amount: number }[]): boolean {
        const attached = EnergyController.getAttachedEnergyByInstance(energyState, instanceId);
        const totalEnergy = EnergyController.getTotalEnergyByInstance(energyState, instanceId);
        
        for (const requirement of requiredEnergy) {
            if (requirement.type === 'any' || requirement.type === 'colorless') {
                if (totalEnergy < requirement.amount) {
                    return false;
                }
            } else {
                if ((attached[requirement.type as AttachableEnergyType] || 0) < requirement.amount) {
                    return false;
                }
            }
        }
        return true;
    }

    // Static helper to get the current energy type available for a player (used by handlers)
    static getAvailableEnergyTypes(energyState: EnergyState, playerId: number): AttachableEnergyType[] {
        const currentEnergy = energyState.currentEnergy[playerId];
        return currentEnergy ? [currentEnergy] : [];
    }
    validate() {
        if (!Array.isArray(this.state.currentEnergy)) {
            throw new Error('Shape of object is wrong');
        }
    }

    // Generate energy for a player's turn
    public generateEnergy(playerId: number): AttachableEnergyType {
        const availableTypes = this.state.availableTypes[playerId];
        
        // If no available types, default to fire
        if (!availableTypes || availableTypes.length === 0) {
            const defaultType: AttachableEnergyType = 'fire';
            
            // Set current energy
            this.state.currentEnergy[playerId] = defaultType;
            
            // Generate next energy preview
            this.state.nextEnergy[playerId] = defaultType;
            
            return defaultType;
        }
        
        // Generate random energy for current turn
        const randomType = availableTypes[Math.floor(Math.random() * availableTypes.length)];
        
        // Set current energy
        this.state.currentEnergy[playerId] = randomType;
        
        // Generate next energy preview
        const nextRandomType = availableTypes[Math.floor(Math.random() * availableTypes.length)];
        this.state.nextEnergy[playerId] = nextRandomType;
        
        return randomType;
    }

    // Get current energy of specific type
    public getCurrentEnergy(playerId: number, energyType: AttachableEnergyType): number {
        const current = this.state.currentEnergy[playerId];
        return current === energyType ? 1 : 0;
    }

    // Get preview energy of specific type (next turn)
    public getPreviewEnergy(playerId: number, energyType: AttachableEnergyType): number {
        const next = this.state.nextEnergy[playerId];
        return next === energyType ? 1 : 0;
    }

    // Attach energy to a card by instance ID
    public attachEnergyToInstance(playerId: number, instanceId: string, energyType: AttachableEnergyType): boolean {
        // Check first turn restriction
        if (this.state.isAbsoluteFirstTurn) {
            return false;
        }

        const currentEnergy = this.getCurrentEnergy(playerId, energyType);
        if (currentEnergy <= 0) {
            return false;
        }

        if (!this.state.attachedEnergyByInstance[instanceId]) {
            this.state.attachedEnergyByInstance[instanceId] = EnergyController.emptyEnergyDict();
        }

        this.state.attachedEnergyByInstance[instanceId][energyType] += 1;
        // Clear current energy after attachment
        this.state.currentEnergy[playerId] = null;

        return true;
    }
    
    // Attach specific energy type to a card by instance ID (for effects)
    public attachSpecificEnergyToInstance(instanceId: string, energyType: AttachableEnergyType, amount: number): boolean {
        if (!this.state.attachedEnergyByInstance[instanceId]) {
            this.state.attachedEnergyByInstance[instanceId] = EnergyController.emptyEnergyDict();
        }
        
        this.state.attachedEnergyByInstance[instanceId][energyType] += amount;
        return true;
    }
    
    // Transfer energy between card instances
    public transferEnergyBetweenInstances(sourceInstanceId: string, targetInstanceId: string, energyType?: AttachableEnergyType, amount: number = 1): boolean {
        const sourceEnergy = this.state.attachedEnergyByInstance[sourceInstanceId];
        if (!sourceEnergy) return false;
        
        // Make sure we have a valid energy type
        if (!energyType) {
            // Find the first available energy type
            for (const type of Object.keys(sourceEnergy) as AttachableEnergyType[]) {
                if (sourceEnergy[type] > 0) {
                    energyType = type;
                    break;
                }
            }
            
            // If no energy type found, return false
            if (!energyType) return false;
        }
        
        // Check if source has enough energy of the specified type
        if (sourceEnergy[energyType] < amount) return false;
        
        // Reduce energy from source
        sourceEnergy[energyType] -= amount;
        
        // Initialize target energy if needed
        if (!this.state.attachedEnergyByInstance[targetInstanceId]) {
            this.state.attachedEnergyByInstance[targetInstanceId] = EnergyController.emptyEnergyDict();
        }
        
        // Add energy to target
        this.state.attachedEnergyByInstance[targetInstanceId][energyType] += amount;
        
        return true;
    }

    public discardSpecificEnergyFromInstance(instanceId: string, energyType?: AttachableEnergyType, amount: number = 1): boolean {
        const attached = this.state.attachedEnergyByInstance[instanceId];
        if (!attached) return false;
        
        if (energyType) {
            const available = attached[energyType] || 0;
            const toDiscard = Math.min(available, amount);
            attached[energyType] -= toDiscard;
            return toDiscard > 0; // Return true if any energy was discarded
        } else {
            // Discard random energy
            const totalEnergy = this.getTotalEnergyByInstance(instanceId);
            if (totalEnergy < amount) return false;
            
            let remaining = amount;
            for (const type of Object.keys(attached) as AttachableEnergyType[]) {
                if (remaining <= 0) break;
                const available = attached[type];
                const toDiscard = Math.min(available, remaining);
                attached[type] -= toDiscard;
                remaining -= toDiscard;
            }
        }
        
        return true;
    }

    // Get attached energy dictionary for a card by instance ID
    public getAttachedEnergyByInstance(instanceId: string): EnergyDictionary {
        return this.state.attachedEnergyByInstance[instanceId] || EnergyController.emptyEnergyDict();
    }

    // Count energy of specific type attached to card by instance ID
    public countEnergyTypeByInstance(instanceId: string, energyType: AttachableEnergyType): number {
        const attached = this.getAttachedEnergyByInstance(instanceId);
        return attached[energyType] || 0;
    }

    // Count total energy attached to card by instance ID
    public getTotalEnergyByInstance(instanceId: string): number {
        const attached = this.getAttachedEnergyByInstance(instanceId);
        return Object.values(attached).reduce((sum, count) => sum + count, 0);
    }

    // Check if card has enough energy for an attack by instance ID
    public canUseAttackByInstance(instanceId: string, requiredEnergy: { type: EnergyRequirementType | 'any', amount: number }[]): boolean {
        const attached = this.getAttachedEnergyByInstance(instanceId);
        const totalEnergy = this.getTotalEnergyByInstance(instanceId);

        // Calculate total required energy and specific type requirements
        let totalRequired = 0;
        let specificRequired: { [key: string]: number } = {};
        let colorlessRequired = 0;

        for (const requirement of requiredEnergy) {
            if (requirement.type === 'any' || requirement.type === 'colorless') {
                colorlessRequired += requirement.amount;
                totalRequired += requirement.amount;
            } else {
                specificRequired[requirement.type] = (specificRequired[requirement.type] || 0) + requirement.amount;
                totalRequired += requirement.amount;
            }
        }

        // Check if we have enough total energy
        if (totalEnergy < totalRequired) {
            return false;
        }

        // First, check if we have enough of each specific type
        let specificEnergyUsed = 0;
        for (const [type, amount] of Object.entries(specificRequired)) {
            const energyType = type as EnergyRequirementType;
            // Skip colorless energy as it's handled separately
            if (energyType === 'colorless') continue;
            
            const attachedAmount = attached[energyType as AttachableEnergyType] || 0;
            if (attachedAmount < amount) {
                return false;
            }
            specificEnergyUsed += amount;
        }

        // Check if we have enough total energy for all requirements (specific + colorless)
        if (totalEnergy < (specificEnergyUsed + colorlessRequired)) {
            return false;
        }

        return true;
    }

    // Check if energy can be attached this turn
    public canAttachEnergy(playerId: number, energyType?: AttachableEnergyType): boolean {
        const currentEnergy = this.state.currentEnergy[playerId];
        
        // No energy available
        if (currentEnergy === null) {
            return false;
        }
        
        // Check for specific energy type if provided
        if (energyType) {
            return currentEnergy === energyType;
        }
        
        // Any energy is available
        return true;
    }

    // Get available energy types for attachment
    public getAvailableEnergyTypes(playerId: number): AttachableEnergyType[] {
        const currentEnergy = this.state.currentEnergy[playerId];
        return currentEnergy ? [currentEnergy] : [];
    }
    
    // Remove all energy from a card instance (for knockouts)
    public removeAllEnergyFromInstance(instanceId: string): void {
        if (this.state.attachedEnergyByInstance[instanceId]) {
            delete this.state.attachedEnergyByInstance[instanceId];
        }
    }
    
    // Discard energy from a card by instance ID (for retreat cost)
    public discardEnergyFromInstance(instanceId: string, amount: number): boolean {
        const attached = this.state.attachedEnergyByInstance[instanceId];
        if (!attached) return false;
        
        const totalEnergy = this.getTotalEnergyByInstance(instanceId);
        if (totalEnergy < amount) return false;
        
        // Discard energy in order of availability
        let remaining = amount;
        for (const type of Object.keys(attached) as AttachableEnergyType[]) {
            if (remaining <= 0) break;
            const available = attached[type];
            const toDiscard = Math.min(available, remaining);
            attached[type] -= toDiscard;
            remaining -= toDiscard;
        }
        
        return true;
    }

    // Check if card can pay retreat cost
    public canPayRetreatCost(instanceId: string, retreatCost: number): boolean {
        const totalEnergy = this.getTotalEnergyByInstance(instanceId);
        return totalEnergy >= retreatCost;
    }

    // Pay retreat cost by removing energy
    public payRetreatCost(instanceId: string, retreatCost: number): boolean {
        if (!this.canPayRetreatCost(instanceId, retreatCost)) {
            return false;
        }

        const attached = this.getAttachedEnergyByInstance(instanceId);
        let remaining = retreatCost;

        // Remove energy in any order until retreat cost is paid
        for (const energyType of Object.keys(attached) as (keyof EnergyDictionary)[]) {
            const available = attached[energyType] || 0;
            const toRemove = Math.min(available, remaining);
            
            if (toRemove > 0) {
                this.state.attachedEnergyByInstance[instanceId][energyType] = (this.state.attachedEnergyByInstance[instanceId][energyType] || 0) - toRemove;
                remaining -= toRemove;
                
                if (remaining <= 0) {
                    break;
                }
            }
        }

        return remaining <= 0;
    }
    
    // Set available energy types for a player (based on deck)
    public setAvailableTypes(playerId: number, types: AttachableEnergyType[]): void {
        if (playerId >= 0 && playerId < this.state.availableTypes.length) {
            this.state.availableTypes[playerId] = types;
        }
    }
    
    // Check if first turn restrictions apply (only absolute first turn)
    public isFirstTurnRestricted(): boolean {
        return this.state.isAbsoluteFirstTurn;
    }
    
    // Mark that the first turn has passed
    public markFirstTurnComplete(): void {
        this.state.isAbsoluteFirstTurn = false;
    }
}