import { GenericControllerProvider, GenericHandlerController, GlobalController, Serializable } from '@cards-ts/core';

export type EnergyType = 'grass' | 'fire' | 'water' | 'lightning' | 'psychic' | 'fighting' | 'darkness' | 'metal';

export interface AttachedEnergy {
    [key: string]: Serializable;
    
    type: EnergyType;
}

export interface EnergyState {
    [key: string]: Serializable;
    
    // Current energy available for attachment
    currentEnergy: EnergyType[];
    
    // Next turn's energy preview
    nextEnergy: EnergyType[];
    
    // Energy attached to field positions (indexed by player, then by position: 0=active, 1-3=bench)
    attachedEnergy: AttachedEnergy[][][];
    
    // Energy types available for generation (based on deck)
    availableTypes: EnergyType[][];
    
    // Whether energy has been attached this turn
    energyAttachedThisTurn: boolean[];
    
    // Track if this is the very first turn of the game
    isAbsoluteFirstTurn: boolean;
}

type EnergyDependencies = { 
    players: GenericHandlerController<any, any>,
    turnCounter: any
};

export class EnergyControllerProvider implements GenericControllerProvider<EnergyState, EnergyDependencies, EnergyController> {
    controller(state: EnergyState, controllers: EnergyDependencies): EnergyController {
        return new EnergyController(state, controllers);
    }

    initialState(controllers: EnergyDependencies): EnergyState {
        return {
            currentEnergy: new Array(controllers.players.count).fill('colorless'),
            nextEnergy: new Array(controllers.players.count).fill('colorless'),
            attachedEnergy: new Array(controllers.players.count).fill(undefined).map(() => 
                new Array(4).fill(undefined).map(() => [])
            ),
            availableTypes: new Array(controllers.players.count).fill(undefined).map(() => 
                ['fire', 'water', 'lightning', 'grass', 'psychic', 'fighting', 'darkness', 'metal']
            ),
            energyAttachedThisTurn: new Array(controllers.players.count).fill(false),
            isAbsoluteFirstTurn: true
        };
    }

    dependencies() {
        return { players: true, turnCounter: true } as const;
    }
}

export class EnergyController extends GlobalController<EnergyState, EnergyDependencies> {
    validate() {
        if (!Array.isArray(this.state.currentEnergy)) {
            throw new Error('Shape of object is wrong');
        }
    }

    // Generate energy for a player's turn
    public generateEnergy(playerId: number): EnergyType {
        const availableTypes = this.state.availableTypes[playerId];
        
        // Generate random current energy if first time
        if (!availableTypes.includes(this.state.currentEnergy[playerId] as EnergyType)) {
            this.state.currentEnergy[playerId] = availableTypes[Math.floor(Math.random() * availableTypes.length)];
        } else {
            // Move next energy to current
            this.state.currentEnergy[playerId] = this.state.nextEnergy[playerId];
        }
        
        // Generate new random next energy
        this.state.nextEnergy[playerId] = availableTypes[Math.floor(Math.random() * availableTypes.length)];
        
        return this.state.currentEnergy[playerId];
    }

    // Get current energy
    public getCurrentEnergy(playerId: number): EnergyType | null {
        return this.state.currentEnergy[playerId] || null;
    }

    // Get preview energy (next turn)
    public getPreviewEnergy(playerId: number): EnergyType | null {
        return this.state.nextEnergy[playerId] || null;
    }

    // Attach energy to a field position
    public attachEnergy(playerId: number, fieldPosition: number): boolean {
        if (this.state.energyAttachedThisTurn[playerId]) {
            return false;
        }

        const currentEnergy = this.getCurrentEnergy(playerId);
        if (!currentEnergy) {
            return false;
        }

        if (fieldPosition < 0 || fieldPosition >= 4) {
            return false;
        }

        this.state.attachedEnergy[playerId][fieldPosition].push({ type: currentEnergy });
        this.state.energyAttachedThisTurn[playerId] = true;
        // Energy is consumed when attached, no longer available

        return true;
    }

    // Get attached energy for a field position
    public getAttachedEnergy(playerId: number, fieldPosition: number): AttachedEnergy[] {
        if (playerId < 0 || playerId >= this.state.attachedEnergy.length) {
            return [];
        }
        if (fieldPosition < 0 || fieldPosition >= 4) {
            return [];
        }
        return this.state.attachedEnergy[playerId][fieldPosition];
    }

    // Count energy of specific type attached to field position
    public countEnergyType(playerId: number, fieldPosition: number, energyType: EnergyType): number {
        const attached = this.getAttachedEnergy(playerId, fieldPosition);
        return attached.filter(energy => energy.type === energyType).length;
    }

    // Count total energy attached to field position
    public getTotalEnergy(playerId: number, fieldPosition: number): number {
        return this.getAttachedEnergy(playerId, fieldPosition).length;
    }

    // Check if field position has enough energy for an attack
    public canUseAttack(playerId: number, fieldPosition: number, requiredEnergy: { type: EnergyType | 'any' | 'colorless', amount: number }[]): boolean {
        for (const requirement of requiredEnergy) {
            if (requirement.type === 'any' || requirement.type === 'colorless') {
                if (this.getTotalEnergy(playerId, fieldPosition) < requirement.amount) {
                    return false;
                }
            } else {
                if (this.countEnergyType(playerId, fieldPosition, requirement.type) < requirement.amount) {
                    return false;
                }
            }
        }
        return true;
    }

    // Reset turn-specific flags
    public resetTurnFlags(playerId: number): void {
        this.state.energyAttachedThisTurn[playerId] = false;
    }

    // Set available energy types for a player (based on deck)
    public setAvailableTypes(playerId: number, types: EnergyType[]): void {
        if (playerId >= 0 && playerId < this.state.availableTypes.length) {
            this.state.availableTypes[playerId] = types;
        }
    }

    // Check if energy can be attached this turn
    public canAttachEnergy(playerId: number): boolean {
        const currentEnergy = this.getCurrentEnergy(playerId);
        const availableTypes = this.state.availableTypes[playerId];
        return !this.state.energyAttachedThisTurn[playerId] && 
               currentEnergy !== null && 
               availableTypes.includes(currentEnergy as EnergyType);
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