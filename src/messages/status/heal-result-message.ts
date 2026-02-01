import { Message } from '@cards-ts/core';

export class HealResultMessage extends Message {
    readonly type = 'heal-result';

    constructor(
        public readonly fieldCardName: string,
        public readonly healing: number,
        public readonly currentHp: number,
    ) {
        super([ `${fieldCardName} was healed for ${healing} HP! (Current HP: ${currentHp})` ]);
    }
}
