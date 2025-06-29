import { Message } from '@cards-ts/core';

export class EvolutionMessage extends Message {
    readonly type = 'evolution';

    constructor(
        public readonly fromName: string,
        public readonly toName: string,
        public readonly playerName: string
    ) {
        super([`${playerName}'s ${fromName} evolved into ${toName}!`]);
    }
}