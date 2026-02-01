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
     * Effect lasts while a specific card is in play.
     * Cleared when that card leaves the field.
     */
    | { type: 'while-in-play'; instanceId: string }
    /**
     * Effect lasts while a tool is attached to a card.
     * Cleared when the tool is removed.
     */
    | { type: 'while-attached'; toolInstanceId: string; cardInstanceId: string };
