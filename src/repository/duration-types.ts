/**
 * Represents how long a passive effect should remain active.
 */
export type Duration = 
    /**
     * Effect lasts until the end of the current turn.
     * Cleared at the start of the next turn.
     */
    | { type: 'until-end-of-turn' }
    /**
     * Effect lasts until the end of the next turn.
     * Cleared at the start of the turn after next.
     */
    | { type: 'until-end-of-next-turn' }
    /**
     * Effect lasts while the card is in play.
     * Removal is handled separately based on card state (e.g., leaves field, tool detached).
     * Instance IDs are populated at effect application time, not at card definition.
     */
    | { type: 'while-in-play' };
