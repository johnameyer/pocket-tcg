import { Message } from '@cards-ts/core';

export class StadiumPlayedMessage extends Message {
    readonly type = 'stadium-played';

    constructor(
        public readonly playerId: number,
        public readonly playerName: string,
        public readonly cardTemplateId: string,
        public readonly cardName: string,
    ) {
        super([ `${playerName} played ${cardName}!` ]);
    }
}
