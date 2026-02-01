import { Message } from '@cards-ts/core';

/**
 * Response message for selecting card(s).
 */
export class SelectCardResponseMessage extends Message {
    readonly type = 'select-card-response';

    constructor(
        public readonly cardInstanceIds: string[],
    ) {
        super([ `Selected ${cardInstanceIds.length} card(s): ${cardInstanceIds.join(', ')}` ]);
    }
}
