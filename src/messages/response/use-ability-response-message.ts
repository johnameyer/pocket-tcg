import { Message } from '@cards-ts/core';

export class UseAbilityResponseMessage extends Message {
    readonly type = 'use-ability-response';

    constructor(
        public readonly fieldCardPosition: number // 0 = active, 1+ = bench
    ) {
        super([`Using ability on FieldCard at position ${fieldCardPosition}`]);
    }
}