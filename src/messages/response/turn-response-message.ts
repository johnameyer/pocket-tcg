import { Message } from '@cards-ts/core';

export class TurnResponseMessage extends Message {
    readonly type = 'turn-response';

    constructor(
        public readonly playerId: number,
        public readonly attackIndex: number
    ) {
        super([`Player ${playerId + 1} used an attack!`]);
    }
}