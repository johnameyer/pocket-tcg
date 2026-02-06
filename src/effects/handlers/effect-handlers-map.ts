import { EffectHandlerMap } from '../interfaces/effect-handler-interface.js';
import { hpEffectHandler } from './hp-effect-handler.js';
import { statusEffectHandler } from './status-effect-handler.js';
import { drawEffectHandler } from './draw-effect-handler.js';
import { energyEffectHandler } from './energy-effect-handler.js';
import { searchEffectHandler } from './search-effect-handler.js';
import { shuffleEffectHandler } from './shuffle-effect-handler.js';
import { handDiscardEffectHandler } from './hand-discard-effect-handler.js';
import { switchEffectHandler } from './switch-effect-handler.js';
import { energyTransferEffectHandler } from './energy-transfer-effect-handler.js';
import { preventDamageEffectHandler } from './prevent-damage-effect-handler.js';
import { damageReductionEffectHandler } from './damage-reduction-effect-handler.js';
import { retreatPreventionEffectHandler } from './retreat-prevention-effect-handler.js';
import { evolutionAccelerationEffectHandler } from './evolution-acceleration-effect-handler.js';
import { evolutionFlexibilityEffectHandler } from './evolution-flexibility-effect-handler.js';
import { endTurnEffectHandler } from './end-turn-effect-handler.js';
import { coinFlipManipulationEffectHandler } from './coin-flip-manipulation-effect-handler.js';
import { damageBoostEffectHandler } from './damage-boost-effect-handler.js';
import { hpBonusEffectHandler } from './hp-bonus-effect-handler.js';
import { retreatCostReductionEffectHandler } from './retreat-cost-reduction-effect-handler.js';
import { retreatCostIncreaseEffectHandler } from './retreat-cost-increase-effect-handler.js';
import { preventPlayingEffectHandler } from './prevent-playing-effect-handler.js';
import { preventAttackEffectHandler } from './prevent-attack-effect-handler.js';
import { preventEnergyAttachmentEffectHandler } from './prevent-energy-attachment-effect-handler.js';
import { attackEnergyCostModifierEffectHandler } from './attack-energy-cost-modifier-effect-handler.js';

export const effectHandlers: EffectHandlerMap = {
    hp: hpEffectHandler,
    status: statusEffectHandler,
    draw: drawEffectHandler,
    energy: energyEffectHandler,
    search: searchEffectHandler,
    shuffle: shuffleEffectHandler,
    'hand-discard': handDiscardEffectHandler,
    switch: switchEffectHandler,
    'energy-transfer': energyTransferEffectHandler,
    'prevent-damage': preventDamageEffectHandler,
    'damage-reduction': damageReductionEffectHandler,
    'retreat-prevention': retreatPreventionEffectHandler,
    'evolution-acceleration': evolutionAccelerationEffectHandler,
    'evolution-flexibility': evolutionFlexibilityEffectHandler,
    'end-turn': endTurnEffectHandler,
    'coin-flip-manipulation': coinFlipManipulationEffectHandler,
    'damage-boost': damageBoostEffectHandler,
    'hp-bonus': hpBonusEffectHandler,
    'retreat-cost-reduction': retreatCostReductionEffectHandler,
    'retreat-cost-increase': retreatCostIncreaseEffectHandler,
    'prevent-playing': preventPlayingEffectHandler,
    'prevent-attack': preventAttackEffectHandler,
    'prevent-energy-attachment': preventEnergyAttachmentEffectHandler,
    'attack-energy-cost-modifier': attackEnergyCostModifierEffectHandler,
};
