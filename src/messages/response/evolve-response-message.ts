import { Message } from '@cards-ts/core';

export class EvolveResponseMessage extends Message {
    readonly type = 'evolve-response';

    constructor(
        public readonly evolutionId: string,
        public readonly position: number // 0 = active, 1-3 = bench positions
    ) {
        super([`Evolving creature at position ${position} to ${evolutionId}`]);
    }
}
