import { EffectHandlerMap } from '../interfaces/effect-handler-interface.js';
import { hpEffectHandler } from './hp-effect-handler.js';
import { statusEffectHandler } from './status-effect-handler.js';
import { drawEffectHandler } from './draw-effect-handler.js';
import { energyAttachEffectHandler } from './energy-attach-effect-handler.js';
import { energyDiscardEffectHandler } from './energy-discard-effect-handler.js';
import { searchEffectHandler } from './search-effect-handler.js';
import { shuffleEffectHandler } from './shuffle-effect-handler.js';
import { handDiscardEffectHandler } from './hand-discard-effect-handler.js';
import { switchEffectHandler } from './switch-effect-handler.js';
import { energyTransferEffectHandler } from './energy-transfer-effect-handler.js';
import { evolutionAccelerationEffectHandler } from './evolution-acceleration-effect-handler.js';
import { endTurnEffectHandler } from './end-turn-effect-handler.js';
import { coinFlipManipulationEffectHandler } from './coin-flip-manipulation-effect-handler.js';
import { toolDiscardEffectHandler } from './tool-discard-effect-handler.js';
import { statusRecoveryEffectHandler } from './status-recovery-effect-handler.js';
import { swapCardsEffectHandler } from './swap-cards-effect-handler.js';
import { removeFieldCardEffectHandler } from './remove-field-card-effect-handler.js';
import { pullEvolutionEffectHandler } from './pull-evolution-effect-handler.js';
import { conditionalDelegationEffectHandler } from './conditional-delegation-effect-handler.js';
import { choiceDelegationEffectHandler } from './choice-delegation-effect-handler.js';
import { passiveEffectHandler } from './passive-effect-handler.js';

export const effectHandlers: EffectHandlerMap = {
    hp: hpEffectHandler,
    status: statusEffectHandler,
    draw: drawEffectHandler,
    'energy-attach': energyAttachEffectHandler,
    'energy-discard': energyDiscardEffectHandler,
    search: searchEffectHandler,
    shuffle: shuffleEffectHandler,
    'hand-discard': handDiscardEffectHandler,
    switch: switchEffectHandler,
    'energy-transfer': energyTransferEffectHandler,
    'evolution-acceleration': evolutionAccelerationEffectHandler,
    'end-turn': endTurnEffectHandler,
    'coin-flip-manipulation': coinFlipManipulationEffectHandler,
    'tool-discard': toolDiscardEffectHandler,
    'status-recovery': statusRecoveryEffectHandler,
    'swap-cards': swapCardsEffectHandler,
    'remove-field-card': removeFieldCardEffectHandler,
    'pull-evolution': pullEvolutionEffectHandler,
    'conditional-delegation': conditionalDelegationEffectHandler,
    'choice-delegation': choiceDelegationEffectHandler,
    passive: passiveEffectHandler,
};
