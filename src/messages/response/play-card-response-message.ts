import { Message } from '@cards-ts/core';

export class PlayCardResponseMessage extends Message {
    readonly type = 'play-card-response';

    constructor(
        public readonly cardIndex: number
    ) {
        super(['Played a card from hand']);
    }
}