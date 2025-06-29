import { Message } from '@cards-ts/core';

export class EvolveResponseMessage extends Message {
    readonly type = 'evolve-response';

    constructor(
        public readonly evolutionId: string,
        public readonly isActive: boolean,
        public readonly benchIndex?: number
    ) {
        super([`Evolving creature to ${evolutionId}`]);
    }
}
