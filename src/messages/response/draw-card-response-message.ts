import { Message } from '@cards-ts/core';

export class DrawCardResponseMessage extends Message {
    readonly type = 'draw-card-response';

    constructor() {
        super(['Drew a card from deck']);
    }
}