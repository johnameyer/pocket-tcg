import { Message } from '@cards-ts/core';

export class ToolPlayedMessage extends Message {
    readonly type = 'tool-played';

    constructor(
        public readonly playerId: number,
        public readonly playerName: string,
        public readonly cardTemplateId: string,
        public readonly cardName: string,
        public readonly targetPlayerId: number,
        public readonly targetFieldPosition: number,
        public readonly targetCardTemplateId: string,
    ) {
        super([ `${playerName} attached ${cardName} to ${targetCardTemplateId}!` ]);
    }
}
