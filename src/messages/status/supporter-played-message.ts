import { Message } from '@cards-ts/core';

export class SupporterPlayedMessage extends Message {
    readonly type = 'supporter-played';

    constructor(
        public readonly playerId: number,
        public readonly playerName: string,
        public readonly cardTemplateId: string,
        public readonly cardName: string,
    ) {
        super([ `${playerName} played ${cardName}.` ]);
    }
}
