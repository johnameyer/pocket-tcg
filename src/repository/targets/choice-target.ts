/**
 * A single named, selectable choice. `value` is what round-trips through the player's
 * selection and back into `ResolvedChoiceTarget`; `name` is the human-readable label shown
 * to the player. Modeled on `card-target.ts`'s style so choice-based effects (e.g.
 * choice-delegation) can plug into the generic `ResolutionRequirement` pipeline the same
 * way `CardTarget`/`FieldTarget` do.
 */
export type ChoiceOption = {
    name: string;
    value: string;
};

/**
 * A choice target requiring a single choice among the given named `choices`. Deliberately
 * carries only `name`/`value` per option - not the effects/behavior behind each choice - so
 * the target itself stays free of whatever data the choosing effect associates with a pick
 * (e.g. `ChoiceDelegationEffect.options[].effects`); the resolver just needs enough to
 * identify which option was picked, and the owning effect looks the rest up by `value`.
 */
export type SingleChoiceChoiceTarget = {
    type: 'single-choice';
    chooser: 'self' | 'opponent';
    choices: ChoiceOption[];
};

/**
 * Represents a choice target that has been resolved to a single selected value.
 */
export type ResolvedChoiceTarget = {
    type: 'resolved';
    value: string;
};

/**
 * Union type representing all possible choice target specifications.
 */
export type ChoiceTarget = SingleChoiceChoiceTarget | ResolvedChoiceTarget;
