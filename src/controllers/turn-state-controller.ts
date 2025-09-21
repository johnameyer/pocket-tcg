import { AbstractController, GenericControllerProvider, GlobalController, Serializable } from '@cards-ts/core';
import { PendingTargetSelection } from '../effects/pending-target-selection.js';
import { Condition } from '../repository/condition-types.js';
import { Target } from '../repository/target-types.js';

export interface TurnStateData {
    [key: string]: Serializable;
    
    shouldEndTurn: boolean;
    supporterPlayedThisTurn: boolean;
    retreatedThisTurn: boolean;
    evolvedInstancesThisTurn: string[]; // Track evolved creatures by instance ID
    pendingTargetSelection?: Serializable;
    // TODO: Rare candy should immediately require selection of the card to evolve so shouldn't be kept long term - pending effect?
}

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
            pendingTargetSelection: undefined,
        };
    }
    
    dependencies() {
        return {} as const;
    }
}

export class TurnStateController extends GlobalController<TurnStateData, TurnStateDependencies> {
    validate() {
        // No validation needed
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
    
    public resetTurnState(): void {
        this.state.shouldEndTurn = false;
        this.state.supporterPlayedThisTurn = false;
        this.state.evolvedInstancesThisTurn = [];
        this.state.retreatedThisTurn = false;
    }
    
    public markEvolvedThisTurn(instanceId: string): void {
        if (!this.state.evolvedInstancesThisTurn.includes(instanceId)) {
            this.state.evolvedInstancesThisTurn.push(instanceId);
        }
    }
    
    public hasEvolvedThisTurn(instanceId: string): boolean {
        return this.state.evolvedInstancesThisTurn.includes(instanceId);
    }
    
    public setRetreatedThisTurn(value: boolean): void {
        this.state.retreatedThisTurn = value;
    }
    
    public hasRetreatedThisTurn(): boolean {
        return this.state.retreatedThisTurn;
    }

    public clearPersistentEffects(): void {
        // No persistent effects to clear
    }

    public setPendingTargetSelection(selection: PendingTargetSelection): void {
        this.state.pendingTargetSelection = selection as unknown as Serializable;
    }

    public getPendingTargetSelection(): PendingTargetSelection | null {
        return this.state.pendingTargetSelection as unknown as PendingTargetSelection || null;
    }

    public clearPendingTargetSelection(): void {
        this.state.pendingTargetSelection = undefined;
    }
}
