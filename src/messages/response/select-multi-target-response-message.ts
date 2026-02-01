import { Message } from '@cards-ts/core';

/**
 * Response message for selecting multiple targets on the field.
 */
export class SelectMultiTargetResponseMessage extends Message {
    readonly type = 'select-multi-target-response';

    constructor(
        public readonly targets: Array<{ playerId: number; fieldIndex: number }>,
    ) {
        super([ `Selected ${targets.length} target(s)` ]);
    }
}
