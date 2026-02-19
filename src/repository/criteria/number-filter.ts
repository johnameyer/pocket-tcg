/**
 * Number filter for flexible numeric filtering.
 * Supports exact match, min/max ranges, and allowed value lists.
 * 
 * @example { max: 1 } // Values 1 or less
 * @example { min: 2 } // Values 2 or greater
 * @example [0, 1, 2] // Only values 0, 1, or 2
 * @example 1 // Exactly 1
 */
export type NumberFilter = 
    | { max: number }
    | { min: number }
    | number[]
    | number;
