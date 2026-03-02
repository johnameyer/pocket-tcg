import { FieldTargetCriteria } from '../criteria/field-target-criteria.js';

export { FieldTargetCriteria };

/**
 * Represents a fixed target that doesn't require selection.
 */
export type FixedFieldTarget = {
    type: 'fixed';
    player: 'self' | 'opponent';
    position: 'active' | 'source';
};

/**
 * A target that refers to a named creature from the execution context.
 *
 * The generic parameter `TRef` is constrained by the card definition container
 * (e.g. `CreatureAbility`, `ToolData`, `CreatureAttack`) to only the references
 * that are valid for that execution context, enforcing correctness at compile time.
 *
 * Valid reference values per context:
 *  - `'defender'`       — attack effects (`CreatureAttack.effects`)
 *  - `'attacker'`       — `damaged` / `before-knockout` trigger effects
 *  - `'trigger-target'` — `energy-attachment` trigger effects
 *
 * @example { type: 'contextual', reference: 'defender' }
 * // The creature being attacked (valid in CreatureAttack effects)
 *
 * @example { type: 'contextual', reference: 'attacker' }
 * // The creature that dealt the damage (valid in 'damaged' trigger effects)
 *
 * @example { type: 'contextual', reference: 'trigger-target' }
 * // The creature energy was attached to (valid in 'energy-attachment' trigger effects)
 */
export type ContextualFieldTarget<TRef extends string = string> = {
    type: 'contextual';
    reference: TRef;
};

/**
 * Represents a target that has been resolved to a specific card.
 */
export type ResolvedFieldTarget = {
    type: 'resolved';
    targets: Array<{
        playerId: number;
        fieldIndex: number;
    }>;
};

/**
 * Represents a target that requires a single choice from available options.
 */
export type SingleChoiceFieldTarget = {
    type: 'single-choice';
    chooser: 'self' | 'opponent';
    criteria: FieldTargetCriteria;
};

/**
 * Represents a target that requires multiple choices from available options.
 */
export type MultiChoiceFieldTarget = {
    type: 'multi-choice';
    chooser: 'self' | 'opponent';
    criteria: FieldTargetCriteria;
    count: number;
};

/**
 * Represents a target that matches all creature meeting certain criteria.
 *
 * When `random: true` and `count` are provided, picks `count` times randomly
 * (with replacement) instead of returning all matching creatures.  The same
 * creature can be picked multiple times; HP effect handlers aggregate hits per
 * creature so on-damage triggers fire only once.
 */
export type AllMatchingFieldTarget = {
    type: 'all-matching';
    criteria: FieldTargetCriteria;
} & (
    | { random?: false; count?: never }
    | { random: true; count: number }
);

/**
 * Union type for single targets (fixed, resolved, or choice-based).
 * Uses the default `ContextualFieldTarget<string>` — permissive for framework use.
 * Prefer the generic `FieldTarget<TContextualRefs>` when authoring card definitions.
 */
export type SingleFieldTarget = FixedFieldTarget | SingleChoiceFieldTarget | ResolvedFieldTarget | ContextualFieldTarget<string>;

/**
 * Union type for multi-targets (choice-based or all-matching).
 */
export type MultiFieldTarget = MultiChoiceFieldTarget | AllMatchingFieldTarget;

/**
 * Union type representing all possible field target specifications.
 *
 * The generic parameter `TContextualRefs` constrains which contextual `reference`
 * values are allowed.  When `TContextualRefs = never` no contextual targets are
 * permitted.  When it is omitted the default `string` is used (permissive — the
 * appropriate default for framework/handler code that resolves targets at runtime).
 *
 * Card-definition containers (`CreatureAbility`, `ToolData`, `CreatureAttack`)
 * derive the correct `TContextualRefs` from their execution context via
 * `TriggerContextualRefs`, providing compile-time enforcement.
 */
export type FieldTarget<TContextualRefs extends string = string> =
    | FixedFieldTarget
    | SingleChoiceFieldTarget
    | ResolvedFieldTarget
    | MultiChoiceFieldTarget
    | AllMatchingFieldTarget
    | ([TContextualRefs] extends [never] ? never : ContextualFieldTarget<TContextualRefs>);
