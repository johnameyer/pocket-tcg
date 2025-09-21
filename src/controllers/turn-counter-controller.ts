import { AbstractController, GenericControllerProvider, GlobalController, Serializable } from '@cards-ts/core';

export type TurnCounterState = {
    turnNumber: number;
};

type TurnCounterDependencies = {};

export class TurnCounterControllerProvider implements GenericControllerProvider<TurnCounterState, TurnCounterDependencies, TurnCounterController> {
    controller(state: TurnCounterState, controllers: TurnCounterDependencies): TurnCounterController {
        return new TurnCounterController(state, controllers);
    }
    
    initialState(): TurnCounterState {
        return {
            turnNumber: 0
        };
    }
    
    dependencies() {
        return {} as const;
    }
}

export class TurnCounterController extends GlobalController<TurnCounterState, TurnCounterDependencies> {
    validate() {
        // No validation needed
    }
    
    public getTurnNumber(): number {
        return this.state.turnNumber;
    }
    
    public advanceTurn(): void {
        this.state.turnNumber++;
    }
}