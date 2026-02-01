import { GlobalController, GenericControllerProvider } from '@cards-ts/core';
import { PendingTargetSelection } from '../effects/pending-target-selection.js';

export type TurnStateData = {
    shouldEndTurn: boolean;
    supporterPlayedThisTurn: boolean;
    retreatedThisTurn: boolean;
    evolvedInstancesThisTurn: string[]; // Track evolved creatures by instance ID
    usedAbilitiesThisTurn: string[]; // Track ability usage by "instanceId-abilityName"
    pendingTargetSelection?: PendingTargetSelection;
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
            retreatedThisTurn: false,
            evolvedInstancesThisTurn: [],
            usedAbilitiesThisTurn: [],
            pendingTargetSelection: undefined,
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

    public startTurn(): void {
        this.state.shouldEndTurn = false;
        this.state.supporterPlayedThisTurn = false;
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

    public setPendingTargetSelection(selection: PendingTargetSelection | undefined): void {
        this.state.pendingTargetSelection = selection;
    }
    
    public getPendingTargetSelection(): PendingTargetSelection | undefined {
        return this.state.pendingTargetSelection;
    }
    
    public clearPendingTargetSelection(): void {
        this.state.pendingTargetSelection = undefined;
    }
}
