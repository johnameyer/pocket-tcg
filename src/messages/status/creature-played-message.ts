import { Message } from '@cards-ts/core';

export class CreaturePlayedMessage extends Message {
    readonly type = 'creature-played';

    constructor(
        public readonly playerId: number,
        public readonly playerName: string,
        public readonly cardTemplateId: string,
        public readonly cardName: string,
    ) {
        super([ `${playerName} played ${cardName} to the bench!` ]);
    }
}
