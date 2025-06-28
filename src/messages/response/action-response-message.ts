import { Message } from '@cards-ts/core';

export type Action = 
    | {
        type: 'attack';
        attackIndex: number;
    }
    | {
        type: 'play';
        cardIndex: number;
        targetPlayerId?: number; // Optional target for item cards
        targetFieldIndex?: number; // Optional field card target (0 = active, 1+ = bench)
    }
    | {
        type: 'endTurn';
    }

export class ActionResponseMessage extends Message {
    readonly type = 'action-response';

    constructor(
        public readonly action: Action
    ) {
        super([`Chose action: ${action.type}`]);
    }
}
