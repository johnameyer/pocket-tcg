import { GlobalController, GenericControllerProvider } from '@cards-ts/core';
import { Effect } from '../repository/effect-types.js';
import { EffectContext } from '../effects/effect-context.js';

/**
 * Represents a pending effect that needs to be applied.
 * Used for effects that trigger other effects (e.g., damage effects triggering reactions).
 */
export type PendingEffect = {
    effects: Effect[];
    context: EffectContext;
};

export type EffectState = {
    /**
     * Queue of effects that need to be applied.
     * Effects are pushed when they trigger other effects and popped one by one for processing.
     */
    immediatelyPendingEffects: PendingEffect[];
};

type EffectControllerDependencies = {};

export class EffectControllerProvider implements GenericControllerProvider<EffectState, EffectControllerDependencies, EffectController> {
    controller(state: EffectState, controllers: EffectControllerDependencies): EffectController {
        return new EffectController(state, controllers);
    }
    
    initialState(): EffectState {
        return {
            immediatelyPendingEffects: [],
        };
    }
    
    dependencies() {
        return {} as const;
    }
}

export class EffectController extends GlobalController<EffectState, EffectControllerDependencies> {
    validate() {
        return true;
    }

    /**
     * Push a pending effect to the queue.
     * Should be called when an effect triggers another effect.
     * 
     * @param effects Array of effects to apply
     * @param context Context for the effects
     */
    public pushPendingEffect(effects: Effect[], context: EffectContext): void {
        this.state.immediatelyPendingEffects.push({ effects, context });
    }

    /**
     * Pop the next pending effect from the queue.
     * Returns undefined if the queue is empty.
     * 
     * @returns The next pending effect or undefined
     */
    public popPendingEffect(): PendingEffect | undefined {
        return this.state.immediatelyPendingEffects.shift();
    }

    /**
     * Check if there are any pending effects in the queue.
     * 
     * @returns True if there are pending effects, false otherwise
     */
    public hasPendingEffects(): boolean {
        return this.state.immediatelyPendingEffects.length > 0;
    }

    /**
     * Clear all pending effects from the queue.
     * Useful for cleanup or error recovery.
     */
    public clearPendingEffects(): void {
        this.state.immediatelyPendingEffects = [];
    }
}
