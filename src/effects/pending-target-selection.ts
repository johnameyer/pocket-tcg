import { Effect } from '../repository/effect-types.js';
import { EffectContext } from './effect-context.js';

/**
 * Represents a pending target selection for an effect.
 * This is used when an effect requires target selection before it can be applied.
 * Only stores essential information to avoid circular references during serialization.
 */
export type PendingTargetSelection = {
    /** The type of selection */
    type?: 'target' | 'choice';
    /** The effect that requires target selection */
    effect: Effect;
    /** The original context in which the effect was triggered */
    originalContext: EffectContext;
};
