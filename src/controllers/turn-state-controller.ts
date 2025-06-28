import { AbstractController, GenericControllerProvider, GlobalController, Serializable } from '@cards-ts/core';

export interface TurnStateData {
    [key: string]: Serializable;
    
    shouldEndTurn: boolean;
    supporterPlayedThisTurn: boolean;
}

type TurnStateDependencies = {};

export class TurnStateControllerProvider implements GenericControllerProvider<TurnStateData, TurnStateDependencies, TurnStateController> {
    controller(state: TurnStateData, controllers: TurnStateDependencies): TurnStateController {
        return new TurnStateController(state, controllers);
    }
    
    initialState(): TurnStateData {
        return {
            shouldEndTurn: false,
            supporterPlayedThisTurn: false
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
    }
}