import { Message } from '@cards-ts/core';

export class AttachEnergyResponseMessage extends Message {
    readonly type = 'attach-energy-response';

    constructor(public readonly fieldPosition: number) {
        super([`Chose to attach energy to position ${fieldPosition}`]);
    }
}
