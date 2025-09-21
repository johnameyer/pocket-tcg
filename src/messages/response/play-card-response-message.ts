import { Message } from '@cards-ts/core';

export class PlayCardResponseMessage extends Message {
    readonly type = 'play-card-response';

    constructor(
        public readonly templateId: string,
        public readonly cardType: 'creature' | 'item' | 'supporter' | 'tool',
        public readonly targetPlayerId?: number,
        public readonly targetFieldIndex?: number
    ) {
        super([`Chose to play card ${templateId}`]);
    }
}
