import { Message } from '@cards-ts/core';

/**
 * Response message for selecting energy to discard or move.
 * The selection is expressed as the creatures whose energy should be used;
 * the specific energy amounts are determined by the handler from the pending
 * selection's availableEnergy list.
 */
export class SelectEnergyResponseMessage extends Message {
    readonly type = 'select-energy-response';

    constructor(
        public readonly selectedTargets: Array<{ playerId: number; fieldIndex: number }>,
    ) {
        super([ `Selected energy from ${selectedTargets.length} creature${selectedTargets.length !== 1 ? 's' : ''}` ]);
    }
}
