import { Effect } from '../repository/effect-types.js';
import { EffectContext } from './effect-context.js';
import { PendingTargetSelection } from './pending-target-selection.js';

/**
 * Represents a pending choice selection for an effect.
 * This is used when an effect requires the player to choose between multiple options.
 */
// TODO: Can we move into the pending target file and use our effect patterns of unions / intersections?
export type PendingChoiceSelection = PendingTargetSelection & {
    /** The type of selection */
    type: 'choice';
    
    /** The available options to choose from */
    availableOptions: Effect[];
    
    /** The index of the selected option (if a choice has been made) */
    selectedIndex?: number;
};

/**
 * Adds a selectedChoiceIndex property to the effect context.
 * This is used to track which choice was selected when resuming a choice effect.
 */
export type ChoiceEffectContext = EffectContext & {
    /** The index of the selected choice */
    selectedChoiceIndex?: number;
};
