import { EffectHandler, EffectHandlerMap } from '../interfaces/effect-handler-interface.js';
import { hpEffectHandler } from './hp-effect-handler.js';

/**
 * Direct instantiation of the effect handlers map.
 * This ensures that all effect types are accounted for.
 */
export const effectHandlers: EffectHandlerMap = {
    'hp': hpEffectHandler
} as unknown as EffectHandlerMap;
