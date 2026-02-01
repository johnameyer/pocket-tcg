import { Message } from '@cards-ts/core';

export class EndTurnResponseMessage extends Message {
    readonly type = 'end-turn-response';

    constructor() {
        super([ 'Chose to end turn' ]);
    }
}
