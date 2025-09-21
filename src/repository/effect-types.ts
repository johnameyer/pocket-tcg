import { Target } from './target-types.js';
import { EffectValue } from './effect-value-types.js';

/**
 * Represents when an effect can be triggered.
 */
export type TriggerType = 'on-play' | 'on-attack' | 'on-damage' | 'on-knockout' | 'between-turns' | 'on-evolve' | 'damaged' | 'end-of-turn' | 'energy-attachment' | 'manual';

/**
 * Represents an effect that modifies a creature's HP (healing or damage).
 * @property {string} type - Always 'hp' to identify this effect type
 * @property {EffectValue} amount - The amount of HP to heal or damage
 * @property {Target} target - The target(s) of the effect
 * @property {string} operation - Whether to 'heal' or 'damage' the target
 * @example { type: 'hp', amount: { type: 'constant', value: 30 }, target: { type: 'fixed', player: 'self', position: 'active' }, operation: 'heal' }
 * // Heal 30 HP from your active creature
 */
export type HpEffect = {
    type: 'hp';
    amount: EffectValue;
    target: Target;
    operation: 'heal' | 'damage';
};

/**
 * Union type representing all possible effects that can be applied in the game.
 * This is used to define what an effect can do, from dealing damage to drawing cards.
 */
export type Effect = HpEffect;

/**
 * Represents an effect that requires target selection before it can be applied.
 * These effects are stored in a pending state until the target is selected.
 * @property {number} sourcePlayer - The player who initiated the effect
 * @property {string} effectName - The name of the effect (for display purposes)
 */
export type PendingTargetEffect = (HpEffect) & { sourcePlayer: number; effectName: string };
