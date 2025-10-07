import { EffectHandler, EffectHandlerMap } from '../interfaces/effect-handler-interface.js';
import { hpEffectHandler } from './hp-effect-handler.js';
import { statusEffectHandler } from './status-effect-handler.js';

export const effectHandlers: EffectHandlerMap = {
    'hp': hpEffectHandler,
    'status': statusEffectHandler,
};
