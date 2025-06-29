import { Message } from '@cards-ts/core';

export class AttackResponseMessage extends Message {
    readonly type = 'attack-response';

    constructor(
        public readonly attackIndex: number
    ) {
        super([`Chose to attack with move ${attackIndex + 1}`]);
    }
}