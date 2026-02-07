/**
 * Utility functions for resolving player targets and checking player-based effects.
 */

/**
 * Resolves a relative player target ('self' or 'opponent') to an absolute player ID.
 * 
 * @param relativeTarget The relative player target ('self' or 'opponent')
 * @param sourcePlayer The player ID that the effect originates from
 * @param playerCount Total number of players in the game
 * @returns The absolute player ID
 */
export function resolvePlayerTarget(
    relativeTarget: 'self' | 'opponent',
    sourcePlayer: number,
    playerCount: number,
): number {
    return relativeTarget === 'self' ? sourcePlayer : (sourcePlayer + 1) % playerCount;
}

/**
 * Checks if a player matches a player target specification.
 * 
 * @param playerId The player ID to check
 * @param target The target specification ('self', 'opponent', or 'both')
 * @param sourcePlayer The player ID that the effect originates from
 * @param playerCount Total number of players in the game
 * @returns True if the player matches the target specification
 */
export function matchesPlayerTarget(
    playerId: number,
    target: 'self' | 'opponent' | 'both',
    sourcePlayer: number,
    playerCount: number,
): boolean {
    if (target === 'both') {
        return true;
    }
    
    const targetPlayerId = resolvePlayerTarget(target, sourcePlayer, playerCount);
    return playerId === targetPlayerId;
}
