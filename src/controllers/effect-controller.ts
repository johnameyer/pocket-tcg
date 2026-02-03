import { GlobalController, GenericControllerProvider } from '@cards-ts/core';
import { Effect, ModifierEffect } from '../repository/effect-types.js';
import { EffectContext } from '../effects/effect-context.js';
import { Duration } from '../repository/duration-types.js';
import { Condition } from '../repository/condition-types.js';

/**
 * Represents a pending effect that needs to be applied.
 * Used for effects that trigger other effects (e.g., damage effects triggering reactions).
 */
export type PendingEffect = {
    effects: Effect[];
    context: EffectContext;
};

/**
 * Represents a passive effect that is active in the game.
 * Passive effects modify values or prevent actions and persist over time
 * based on their duration.
 */
export type PassiveEffect = {
    /**
     * Unique identifier for this passive effect instance.
     * Used for tracking and removal.
     */
    id: string;
    
    /**
     * The player who activated this effect.
     */
    sourcePlayer: number;
    
    /**
     * Display name for the effect (e.g., "Card Name's Ability").
     */
    effectName: string;
    
    /**
     * The actual modifier effect to apply.
     */
    effect: ModifierEffect;
    
    /**
     * How long the effect remains active.
     */
    duration: Duration;
    
    /**
     * Optional condition that must be met for effect to apply.
     * If present, the effect is only active when the condition is true.
     */
    condition?: Condition;
    
    /**
     * The turn number when this effect was created.
     * Used for duration tracking.
     */
    createdTurn: number;
};

export type EffectState = {
    /**
     * Queue of effects that need to be applied.
     * Effects are pushed when they trigger other effects and popped one by one for processing.
     */
    immediatelyPendingEffects: PendingEffect[];
    
    /**
     * All currently active passive effects.
     * Effects are added when activated and removed when they expire.
     */
    activePassiveEffects: PassiveEffect[];
    
    /**
     * Counter for generating unique effect IDs.
     */
    nextEffectId: number;
};

type EffectControllerDependencies = {};

export class EffectControllerProvider implements GenericControllerProvider<EffectState, EffectControllerDependencies, EffectController> {
    controller(state: EffectState, controllers: EffectControllerDependencies): EffectController {
        return new EffectController(state, controllers);
    }
    
    initialState(): EffectState {
        return {
            immediatelyPendingEffects: [],
            activePassiveEffects: [],
            nextEffectId: 0,
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

    /**
     * Register a new passive effect.
     * The effect becomes active immediately and will be queried when needed.
     * 
     * @param sourcePlayer The player who activated the effect
     * @param effectName Display name for the effect
     * @param effect The modifier effect to apply
     * @param duration How long the effect remains active
     * @param createdTurn The turn number when the effect was created
     * @param condition Optional condition for the effect to apply
     * @returns The ID of the newly registered effect
     */
    public registerPassiveEffect(
        sourcePlayer: number,
        effectName: string,
        effect: ModifierEffect,
        duration: Duration,
        createdTurn: number,
        condition?: Condition
    ): string {
        const id = `passive-effect-${this.state.nextEffectId++}`;
        
        const passiveEffect: PassiveEffect = {
            id,
            sourcePlayer,
            effectName,
            effect,
            duration,
            createdTurn,
            condition,
        };
        
        this.state.activePassiveEffects.push(passiveEffect);
        
        return id;
    }

    /**
     * Get all active passive effects of a specific type.
     * 
     * @param effectType The type of effect to retrieve
     * @returns Array of matching passive effects
     */
    public getPassiveEffectsByType<T extends ModifierEffect['type']>(
        effectType: T
    ): Array<PassiveEffect & { effect: Extract<ModifierEffect, { type: T }> }> {
        return this.state.activePassiveEffects.filter(
            (pe): pe is PassiveEffect & { effect: Extract<ModifierEffect, { type: T }> } =>
                pe.effect.type === effectType
        );
    }

    /**
     * Get all active passive effects.
     * 
     * @returns Array of all passive effects
     */
    public getAllPassiveEffects(): PassiveEffect[] {
        return [...this.state.activePassiveEffects];
    }

    /**
     * Remove a specific passive effect by its ID.
     * 
     * @param id The ID of the effect to remove
     */
    public removePassiveEffect(id: string): void {
        this.state.activePassiveEffects = this.state.activePassiveEffects.filter(pe => pe.id !== id);
    }

    /**
     * Remove all passive effects that expire at the end of turn.
     * Should be called at the start of a new turn.
     */
    public clearEndOfTurnEffects(): void {
        this.state.activePassiveEffects = this.state.activePassiveEffects.filter(
            pe => pe.duration.type !== 'until-end-of-turn'
        );
    }

    /**
     * Remove all passive effects that expire at the end of next turn.
     * Should be called at the start of a turn after the turn they were created + 1.
     * 
     * @param currentTurn The current turn number
     */
    public clearEndOfNextTurnEffects(currentTurn: number): void {
        this.state.activePassiveEffects = this.state.activePassiveEffects.filter(
            pe => {
                if (pe.duration.type === 'until-end-of-next-turn') {
                    // Effect should expire if we're at turn createdTurn + 2 or later
                    return currentTurn <= pe.createdTurn + 1;
                }
                return true;
            }
        );
    }

    /**
     * Remove all passive effects associated with a specific card instance.
     * Should be called when a card is knocked out or leaves play.
     * 
     * @param instanceId The instance ID of the card
     */
    public clearEffectsForInstance(instanceId: string): void {
        this.state.activePassiveEffects = this.state.activePassiveEffects.filter(
            pe => {
                // Remove effects with while-in-play duration for this instance
                if (pe.duration.type === 'while-in-play') {
                    return pe.duration.instanceId !== instanceId;
                }
                // Remove effects with while-attached duration for this instance
                if (pe.duration.type === 'while-attached') {
                    return pe.duration.cardInstanceId !== instanceId && pe.duration.toolInstanceId !== instanceId;
                }
                return true;
            }
        );
    }

    /**
     * Remove all passive effects associated with a specific tool attachment.
     * Should be called when a tool is detached.
     * 
     * @param toolInstanceId The instance ID of the tool
     * @param cardInstanceId The instance ID of the card it was attached to
     */
    public clearEffectsForTool(toolInstanceId: string, cardInstanceId: string): void {
        this.state.activePassiveEffects = this.state.activePassiveEffects.filter(
            pe => {
                if (pe.duration.type === 'while-attached') {
                    return pe.duration.toolInstanceId !== toolInstanceId || pe.duration.cardInstanceId !== cardInstanceId;
                }
                return true;
            }
        );
    }

    /**
     * Clear all passive effects.
     * Useful for cleanup or testing.
     */
    public clearAllPassiveEffects(): void {
        this.state.activePassiveEffects = [];
    }
}
