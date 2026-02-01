import { Controllers } from '../controllers/controllers.js';
import { EffectApplier } from './effect-applier.js';

/**
 * Processes the queue of pending effects.
 * This should be called from the event handler or state machine after effects are applied.
 * 
 * The processor continues to pop effects from the queue and apply them until the queue is empty.
 * This ensures that all triggered effects are processed recursively.
 */
export class EffectQueueProcessor {
    /**
     * Process all pending effects in the queue.
     * 
     * @param controllers Game controllers
     */
    static processQueue(controllers: Controllers): void {
        /*
         * Process effects one by one until the queue is empty
         * Using a while loop ensures that effects triggered by other effects are also processed
         */
        while(controllers.effects.hasPendingEffects()) {
            const pendingEffect = controllers.effects.popPendingEffect();
            
            if(!pendingEffect) {
                break; // Queue is empty
            }
            
            const { effects, context } = pendingEffect;
            
            // Apply the effects - this may add more effects to the queue
            EffectApplier.applyEffects(effects, controllers, context);
        }
    }
}
