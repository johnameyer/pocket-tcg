import { AbstractController, GenericControllerProvider, GenericHandlerController, GlobalController, Serializable } from '@cards-ts/core';

export interface SetupState {
    [key: string]: Serializable;
    
    playersReady: boolean[];
}

type SetupDependencies = {
    players: GenericHandlerController<any, any>,
    field: any
};

export class SetupControllerProvider implements GenericControllerProvider<SetupState, SetupDependencies, SetupController> {
    controller(state: SetupState, controllers: SetupDependencies): SetupController {
        return new SetupController(state, controllers);
    }
    
    initialState(controllers: SetupDependencies): SetupState {
        return {
            playersReady: new Array(controllers.players.count).fill(false)
        };
    }
    
    dependencies() {
        return { players: true, field: true } as const;
    }
}

export class SetupController extends GlobalController<SetupState, SetupDependencies> {
    validate() {
        // No validation needed
    }
    
    public isPlayerReady(playerId: number): boolean {
        return this.state.playersReady[playerId];
    }
    
    public setPlayerReady(playerId: number): void {
        this.state.playersReady[playerId] = true;
    }
    
    public canPlayerFinishSetup(playerId: number, controllers: SetupDependencies): boolean {
        // Player must have at least one creature (active)
        try {
            const activeCard = controllers.field.getActiveCard(playerId);
            return activeCard && activeCard.cardId !== 'basic-creature';
        } catch {
            return false;
        }
    }
    
    public isSetupComplete(): boolean {
        return this.state.playersReady.every(ready => ready);
    }
}
