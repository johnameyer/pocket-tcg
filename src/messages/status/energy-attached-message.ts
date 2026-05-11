import { Message, Presentable } from '@cards-ts/core';
import { getEnergyName } from '../../utils/energy-name-utils.js';
import { EnergyRequirementType } from '../../repository/energy-types.js';

function generateMessage(
    energyType: EnergyRequirementType,
    creatureName: string,
    player?: string | number,
): Presentable[] {
    const energyName = getEnergyName(energyType);
    const playerStr = player !== undefined ? ` (${player})` : '';
    return [ `An ${energyName} energy was attached to ${creatureName}${playerStr}` ];
}

/**
 * Message for when energy is attached to a creature
 */
export class EnergyAttachedMessage extends Message {
    readonly type = 'energy-attached-message';

    constructor(
        public readonly energyType: EnergyRequirementType,
        public readonly creatureName: string,
        public readonly player?: string | number,
    ) {
        super(generateMessage(energyType, creatureName, player));
    }
}
