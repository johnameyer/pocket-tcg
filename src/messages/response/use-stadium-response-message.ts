import { Message } from '@cards-ts/core';

export class UseStadiumResponseMessage extends Message {
    readonly type = 'use-stadium-response';

    constructor() {
        super([ 'Using stadium ability' ]);
    }
}
