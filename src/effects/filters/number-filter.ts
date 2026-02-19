import { NumberFilter as NumberFilterType } from '../../repository/criteria/number-filter.js';

/**
 * Utility class for matching numeric values against NumberFilter criteria.
 * Supports exact match, min/max ranges, and allowed value lists.
 */
export class NumberFilter {
    /**
     * Checks if a numeric value matches the provided filter criteria.
     * 
     * @param value The numeric value to check
     * @param filter The filter criteria (exact, min, max, or array)
     * @returns True if the value matches the filter, false otherwise
     */
    static matches(value: number, filter: NumberFilterType | undefined): boolean {
        // No filter means all values match
        if (filter === undefined) {
            return true;
        }

        // Exact number match
        if (typeof filter === 'number') {
            return value === filter;
        }

        // Array of allowed values
        if (Array.isArray(filter)) {
            return filter.includes(value);
        }

        // Object with min or max
        if ('min' in filter) {
            return value >= filter.min;
        }

        if ('max' in filter) {
            return value <= filter.max;
        }

        return true;
    }
}
