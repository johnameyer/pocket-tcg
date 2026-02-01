import { Message } from '@cards-ts/core';

/**
 * Response message for selecting card(s) from hand.
 */
export class SelectCardResponseMessage extends Message {
    readonly type = 'select-card-response';

    constructor(
        public readonly cardIndices: number[],
    ) {
        super([ `Selected ${cardIndices.length} card(s) from hand at indices: ${cardIndices.join(', ')}` ]);
    }
}
