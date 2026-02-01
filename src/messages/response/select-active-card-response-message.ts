import { Message } from '@cards-ts/core';

export class SelectActiveCardResponseMessage extends Message {
    readonly type = 'select-active-card-response';

    constructor(
        public readonly benchIndex: number,
    ) {
        super([ 'Selected a new active card!' ]);
    }
}
