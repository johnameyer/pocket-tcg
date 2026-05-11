import { Message, Presentable } from '@cards-ts/core';
import { getEnergyName } from '../../utils/energy-name-utils.js';
import { EnergyRequirementType } from '../../repository/energy-types.js';

function generateMessage(
    count: number,
    energyType?: EnergyRequirementType,
    player?: string | number,
): Presentable[] {
    const energyStr = energyType ? `${getEnergyName(energyType)} energy` : 'energy';
    const playerStr = player !== undefined ? ` (${player})` : '';
    return [ `Discarded ${count} ${energyStr}${playerStr}` ];
}

/**
 * Message for when energy is discarded
 */
export class DiscardedEnergyMessage extends Message {
    readonly type = 'discarded-energy-message';

    constructor(
        public readonly energyType?: EnergyRequirementType,
        public readonly count: number = 1,
        public readonly player?: string | number,
    ) {
        super(generateMessage(count, energyType, player));
    }
}
