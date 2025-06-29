import { Message } from '@cards-ts/core';

export class PlayCardResponseMessage extends Message {
    readonly type = 'play-card-response';

    constructor(
        public readonly cardId: string,
        public readonly cardType: 'creature' | 'item' | 'supporter',
        public readonly targetPlayerId?: number,
        public readonly targetFieldIndex?: number
    ) {
        super([`Chose to play card ${cardId}`]);
    }
}
