import { Message } from '@cards-ts/core';

export class SetupCompleteResponseMessage extends Message {
    readonly type = 'setup-complete';

    constructor(
        public readonly activeCardId: string,
        public readonly benchCardIds: string[] = []
    ) {
        super(['Setup complete']);
    }
}
