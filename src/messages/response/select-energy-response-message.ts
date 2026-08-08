import { Message } from '@cards-ts/core';
import { AttachableEnergyType } from '../../repository/energy-types.js';

/**
 * Response message for selecting energy to discard, move, or take from the discard pile.
 * Each entry selects an EnergyOption from the pending selection's availableEnergy list, matched
 * by (playerId, fieldIndex, energyType). `energyType` is set when the option represents choosing
 * a specific energy type from an already-known single source (e.g. discard pile with 2+ types);
 * it's omitted when the option represents choosing which creature to take energy from.
 */
export class SelectEnergyResponseMessage extends Message {
    readonly type = 'select-energy-response';

    constructor(
        public readonly selectedTargets: Array<{ playerId: number; fieldIndex: number; energyType?: AttachableEnergyType }>,
    ) {
        super([ `Selected energy from ${selectedTargets.length} option${selectedTargets.length !== 1 ? 's' : ''}` ]);
    }
}
