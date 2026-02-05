import { GlobalController, GenericControllerProvider } from '@cards-ts/core';
import { PendingSelection } from '../effects/pending-selection-types.js';

export type TurnStateData = {
    shouldEndTurn: boolean;
    supporterPlayedThisTurn: boolean;
    stadiumPlayedThisTurn: boolean;
    retreatedThisTurn: boolean;
    evolvedInstancesThisTurn: string[]; // Track evolved creatures by instance ID
    usedAbilitiesThisTurn: string[]; // Track ability usage by "instanceId-abilityName"
    pendingSelection?: PendingSelection;
};

type TurnStateDependencies = {};

export class TurnStateControllerProvider implements GenericControllerProvider<TurnStateData, TurnStateDependencies, TurnStateController> {
    controller(state: TurnStateData, controllers: TurnStateDependencies): TurnStateController {
        return new TurnStateController(state, controllers);
    }
    
    initialState(): TurnStateData {
        return {
            shouldEndTurn: false,
            supporterPlayedThisTurn: false,
            stadiumPlayedThisTurn: false,
            retreatedThisTurn: false,
            evolvedInstancesThisTurn: [],
            usedAbilitiesThisTurn: [],
            pendingSelection: undefined,
        };
    }
    
    dependencies() {
        return {} as const;
    }
}

export class TurnStateController extends GlobalController<TurnStateData, TurnStateDependencies> {
    validate() {
        return true;
    }

    public setShouldEndTurn(value: boolean): void {
        this.state.shouldEndTurn = value;
    }

    public getShouldEndTurn(): boolean {
        return this.state.shouldEndTurn;
    }

    public setSupporterPlayedThisTurn(value: boolean): void {
        this.state.supporterPlayedThisTurn = value;
    }

    public hasSupporterBeenPlayedThisTurn(): boolean {
        return this.state.supporterPlayedThisTurn;
    }

    public setStadiumPlayedThisTurn(value: boolean): void {
        this.state.stadiumPlayedThisTurn = value;
    }

    public hasStadiumBeenPlayedThisTurn(): boolean {
        return this.state.stadiumPlayedThisTurn;
    }

    public startTurn(): void {
        this.state.shouldEndTurn = false;
        this.state.supporterPlayedThisTurn = false;
        this.state.stadiumPlayedThisTurn = false;
        this.state.retreatedThisTurn = false;
        this.state.evolvedInstancesThisTurn = [];
        this.state.usedAbilitiesThisTurn = [];
    }
    
    public markEvolvedThisTurn(instanceId: string): void {
        if (!this.state.evolvedInstancesThisTurn.includes(instanceId)) {
            this.state.evolvedInstancesThisTurn.push(instanceId);
        }
    }
    
    public hasEvolvedThisTurn(instanceId: string): boolean {
        return this.state.evolvedInstancesThisTurn.includes(instanceId);
    }
    
    public markAbilityUsed(instanceId: string, abilityName: string): void {
        const abilityKey = `${instanceId}-${abilityName}`;
        if (!this.state.usedAbilitiesThisTurn) {
            this.state.usedAbilitiesThisTurn = [];
        }
        if (!this.state.usedAbilitiesThisTurn.includes(abilityKey)) {
            this.state.usedAbilitiesThisTurn.push(abilityKey);
        }
    }
    
    public hasAbilityBeenUsedThisTurn(instanceId: string, abilityName: string): boolean {
        const abilityKey = `${instanceId}-${abilityName}`;
        return this.state.usedAbilitiesThisTurn?.includes(abilityKey) || false;
    }

    public setRetreatedThisTurn(value: boolean): void {
        this.state.retreatedThisTurn = value;
    }
    
    public hasRetreatedThisTurn(): boolean {
        return this.state.retreatedThisTurn;
    }

    public setPendingSelection(selection: PendingSelection | undefined): void {
        this.state.pendingSelection = selection;
    }
    
    public getPendingSelection(): PendingSelection | undefined {
        return this.state.pendingSelection;
    }
    
    public clearPendingSelection(): void {
        this.state.pendingSelection = undefined;
    }
}
