// Effect handler exports
export { 
    EffectHandler, 
    AbstractEffectHandler, 
    ResolutionRequirement,
    effectHandlers,
} from './effect-handler.js';

// Effect handler map type
export { EffectHandlerMap } from './handlers/index.js';

// Individual handler exports
export { hpEffectHandler } from './handlers/hp-effect-handler.js';

// Utility exports
export { 
    getEffectValue,
    getResolvedTargetPlayer,
    getResolvedTargetCreatureIndex,
    getOpponentPlayerId,
    isTargetActiveCreature,
    getBenchIndexFromcreatureIndex,
    evaluateConditionWithContext,
    getCreatureFromTarget,
} from './effect-utils.js';

// Resolver exports
export { AttackDamageResolver } from './attack-damage-resolver.js';
export { FieldTargetResolver as TargetResolver } from './target-resolvers/field-target-resolver.js';
