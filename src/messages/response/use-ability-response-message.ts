import { Message } from '@cards-ts/core';

export class UseAbilityResponseMessage extends Message {
    readonly type = 'use-ability-response';

    // TODO fieldCard only have one ability - this should also ideally use the name
    constructor(
        public readonly abilityIndex: number,
        public readonly fieldCardPosition: number // 0 = active, 1+ = bench
    ) {
        super([`Using ability ${abilityIndex} on FieldCard at position ${fieldCardPosition}`]);
    }
}