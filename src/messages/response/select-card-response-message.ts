import { Message } from '@cards-ts/core';

/**
 * Response message for selecting card(s).
 * Cards are identified by their template ID (e.g. "fire-blast") rather than
 * instance IDs, since players think of cards by name/type.  When multiple
 * copies of the same template are available the first unmatched copy is used.
 */
export class SelectCardResponseMessage extends Message {
    readonly type = 'select-card-response';

    constructor(
        public readonly cardTemplateIds: string[],
    ) {
        super([ `Selected ${cardTemplateIds.length} card(s): ${cardTemplateIds.join(', ')}` ]);
    }
}
