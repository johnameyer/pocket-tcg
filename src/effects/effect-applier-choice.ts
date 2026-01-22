import { Controllers } from '../controllers/controllers.js';
import { EffectApplier } from './effect-applier.js';
import { effectHandlers, EffectHandler } from './effect-handler.js';
import { PendingChoiceSelection } from './pending-selection-types.js';
import { EffectContext } from './effect-context.js';

/**
 * Adds a selectedChoiceIndex property to the effect context.
 * This is used to track which choice was selected when resuming a choice effect.
 */
export type ChoiceEffectContext = EffectContext & {
    /** The index of the selected choice */
    selectedChoiceIndex?: number;
};

/**
 * Extension of EffectApplier to handle choice effects.
 * This is separated to avoid circular dependencies.
 */
export class EffectApplierChoice {
    /**
     * Method to resume effect application after choice selection.
     * 
     * @param controllers Game controllers
     * @param pendingSelection The pending choice selection
     * @param selectedIndex The index of the selected option
     */
    static resumeEffectWithChoice(controllers: Controllers, pendingSelection: PendingChoiceSelection, selectedIndex: number): void {
        const { effect, originalContext, choices } = pendingSelection;
        
        if (!choices || selectedIndex < 0 || selectedIndex >= choices.length) {
            console.warn(`Invalid choice index: ${selectedIndex}, must be between 0 and ${choices?.length ?? 0 - 1}`);
            return;
        }
        
        // For now, this is a placeholder
        // TODO: Implement proper choice effect handling when we add effects that need it
        console.warn('Choice effect handling not yet implemented');
    }
}
