import { Message } from '@cards-ts/core';

export class RetreatResponseMessage extends Message {
    readonly type = 'retreat-response';
    
    constructor(public benchIndex: number) {
        super([ `Chose to retreat to bench position ${benchIndex}` ]);
    }
}
