import { EvolutionRestrictions } from '../../repository/effect-types.js';

export type EvolutionRestrictionContext = {
    isBasicCreature: boolean;
    isFirstTurn: boolean;
    playedThisTurn: boolean;
};

type RestrictionCheck = (context: EvolutionRestrictionContext) => boolean;

export const EVOLUTION_RESTRICTION_CHECKS: Record<keyof EvolutionRestrictions, RestrictionCheck> = {
    basicCreatureOnly: (context) => context.isBasicCreature,
    notFirstTurn: (context) => !context.isFirstTurn,
    notPlayedThisTurn: (context) => !context.playedThisTurn,
};

export function satisfiesEvolutionRestrictions(
    restrictions: EvolutionRestrictions | undefined,
    context: EvolutionRestrictionContext,
): boolean {
    if (!restrictions) {
        return true;
    }
    const activeRestrictions = Object.entries(restrictions).filter(([ , enabled ]) => enabled === true) as Array<
        [keyof EvolutionRestrictions, true]
    >;
    return activeRestrictions.every(([ restriction ]) => EVOLUTION_RESTRICTION_CHECKS[restriction](context));
}
