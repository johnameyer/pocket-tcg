import { GenericControllerProvider, GlobalController, GenericHandlerController, SystemHandlerParams } from '@cards-ts/core';
import { ResponseMessage } from '../messages/response-message.js';
import { GameHandlerParams } from '../game-handler-params.js';

type KnockoutCountDependencies = {
    players: GenericHandlerController<ResponseMessage, GameHandlerParams & SystemHandlerParams>;
};

export class KnockoutCountControllerProvider implements GenericControllerProvider<number[], KnockoutCountDependencies, KnockoutCountController> {
    controller(state: number[], controllers: KnockoutCountDependencies): KnockoutCountController {
        return new KnockoutCountController(state, controllers);
    }

    initialState(controllers: KnockoutCountDependencies): number[] {
        return new Array(controllers.players.count).fill(0);
    }

    dependencies() {
        return { players: true } as const;
    }
}

/**
 * Tracks how many of each player's own Pokemon have been knocked out during the game.
 * Used by cards like Kingambit whose damage scales with own KO count.
 */
export class KnockoutCountController extends GlobalController<number[], KnockoutCountDependencies> {
    validate(): void {}

    public getKnockoutCount(playerId: number): number {
        return this.state[playerId] ?? 0;
    }

    public incrementKnockoutCount(playerId: number): void {
        if (playerId >= 0 && playerId < this.state.length) {
            this.state[playerId]++;
        }
    }
}
