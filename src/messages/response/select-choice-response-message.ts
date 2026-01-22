import { Message } from '@cards-ts/core';

/**
 * Response message for selecting from a list of named choices.
 */
export class SelectChoiceResponseMessage extends Message {
    readonly type = 'select-choice-response';

    constructor(
        public readonly choiceValues: string[]
    ) {
        super([`Selected choice(s): ${choiceValues.join(', ')}`]);
    }
}
