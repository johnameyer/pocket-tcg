import { Message } from '@cards-ts/core';

// TODO rename to be more meaningful for non-creature choices (Eevee bag) or split entirely (split seems likely given the message)
export class SelectTargetResponseMessage extends Message {
    readonly type = 'select-target-response';

    constructor(
        public readonly targetPlayerId: number,
        public readonly targetCreatureIndex: number, // 0 = active, 1+ = bench
    ) {
        super([ `Selected target: Player ${targetPlayerId + 1}, creature ${targetCreatureIndex === 0 ? 'Active' : `Bench ${targetCreatureIndex}`}` ]);
    }
}
