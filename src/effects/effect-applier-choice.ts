import { Controllers } from '../controllers/controllers.js';
import { Effect } from '../repository/effect-types.js';
import { EffectApplier } from './effect-applier.js';
import { effectHandlers, EffectHandler } from './effect-handler.js';
import { PendingChoiceSelection } from './pending-choice-selection.js';

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
        const { effect, originalContext, availableOptions } = pendingSelection;
        
        if (selectedIndex < 0 || selectedIndex >= availableOptions.length) {
            console.warn(`Invalid choice index: ${selectedIndex}, must be between 0 and ${availableOptions.length - 1}`);
            return;
        }
        
        // Get the selected sub-effect
        const selectedEffect = availableOptions[selectedIndex];
        
        // Apply the selected sub-effect through the normal pipeline
        // This allows choice effects to contain effects with targets
        EffectApplier.applyEffects([selectedEffect], controllers, {
            ...originalContext,
            selectedChoiceIndex: selectedIndex
        } as any);
    }
}
