import { AbstractController, GenericControllerProvider, GlobalController, Serializable, ParamsController } from '@cards-ts/core';
import { GameParams } from '../game-params.js';

export type TurnCounterState = {
    turnNumber: number;
};

type TurnCounterDependencies = {
    params: ParamsController<GameParams>;
};

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
        return { params: true } as const;
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
    
    public isMaxTurnsReached(): boolean {
        const params = this.controllers.params.get();
        const maxTurns = params.maxTurns ?? 30;
        return this.state.turnNumber >= maxTurns;
    }
}