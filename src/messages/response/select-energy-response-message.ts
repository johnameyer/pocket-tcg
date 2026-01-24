import { Message } from '@cards-ts/core';
import { AttachableEnergyType } from '../../repository/energy-types.js';

/**
 * Response message for selecting energy to discard or move.
 */
export class SelectEnergyResponseMessage extends Message {
    readonly type = 'select-energy-response';

    constructor(
        public readonly selectedEnergy: Array<AttachableEnergyType>
    ) {
        super([`Selected ${selectedEnergy.length} energy: ${selectedEnergy.join(', ')}`]);
    }
}
