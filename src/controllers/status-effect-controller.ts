import { GenericControllerProvider, GenericHandlerController, GlobalController, Serializable, SystemHandlerParams } from '@cards-ts/core';
import { ResponseMessage } from '../messages/response-message.js';
import { GameHandlerParams } from '../game-handler-params.js';
import { StatusCondition } from '../repository/effect-types.js';

import { TurnCounterController } from './turn-counter-controller.js';
import { CoinFlipController } from './coinflip-controller.js';

export enum StatusEffectType {
    ASLEEP = 'sleep',
    BURNED = 'burn', 
    CONFUSED = 'confusion',
    PARALYZED = 'paralysis',
    POISONED = 'poison',
}

export interface StatusEffect {
    type: StatusEffectType;
    appliedTurn: number;
}

export type StatusEffectState = {
    /*
     * Status effects for active FieldCard [playerId] - stored as arrays
     * TODO properly strongly type this
     */
    activeStatusEffects: Serializable[];
};

type StatusEffectDependencies = { 
    players: GenericHandlerController<ResponseMessage, GameHandlerParams & SystemHandlerParams>,
    turnCounter: TurnCounterController,
    coinFlip: CoinFlipController,
};

export class StatusEffectControllerProvider implements GenericControllerProvider<StatusEffectState, StatusEffectDependencies, StatusEffectController> {
    controller(state: StatusEffectState, controllers: StatusEffectDependencies): StatusEffectController {
        return new StatusEffectController(state, controllers);
    }

    initialState(controllers: StatusEffectDependencies): StatusEffectState {
        return {
            activeStatusEffects: new Array(controllers.players.count).fill(null)
                .map(() => [] as Serializable),
        };
    }
    
    getFor(playerId: number) {
        // TODO the player is allowed to know all the effects applied and can derive the rest themselves
        return {
            activeStatusEffectsDisplay: (state: StatusEffectState) => {
                const effects = (state.activeStatusEffects[playerId] as unknown as StatusEffect[]) || [];
                return effects.length > 0 ? ` [${effects.map(e => e.type.toUpperCase()).join(', ')}]` : '';
            },
            canAttack: (state: StatusEffectState) => {
                const effects = (state.activeStatusEffects[playerId] as unknown as StatusEffect[]) || [];
                return !effects.some(e => e.type === StatusEffectType.ASLEEP || e.type === StatusEffectType.PARALYZED);
            },
            canRetreat: (state: StatusEffectState) => {
                const effects = (state.activeStatusEffects[playerId] as unknown as StatusEffect[]) || [];
                return !effects.some(e => e.type === StatusEffectType.ASLEEP || e.type === StatusEffectType.PARALYZED);
            },
        };
    }

    dependencies() {
        return { players: true, turnCounter: true, coinFlip: true } as const;
    }
}

export class StatusEffectController extends GlobalController<StatusEffectState, StatusEffectDependencies> {
    validate() {
        if (!Array.isArray(this.state.activeStatusEffects)) {
            throw new Error('Shape of object is wrong');
        }
    }
    
    /*
     * TODO remove this and just generate a single const object from the array of lowercase Object.fromEntries(['poison']) => { POISONED: 'poison' } over the enum
     * Convert StatusCondition to StatusEffectType
     * Status condition to type mapping
     */
    private static readonly STATUS_CONDITION_MAP = {
        sleep: StatusEffectType.ASLEEP,
        burn: StatusEffectType.BURNED,
        confusion: StatusEffectType.CONFUSED,
        paralysis: StatusEffectType.PARALYZED,
        poison: StatusEffectType.POISONED,
    } as const;

    private statusConditionToType(condition: StatusCondition): StatusEffectType {
        const type = StatusEffectController.STATUS_CONDITION_MAP[condition];
        if (!type) {
            throw new Error(`Unknown status condition: ${condition}`);
        }
        return type;
    }
    
    // Apply status effect from StatusCondition
    public applyStatusCondition(playerId: number, condition: StatusCondition): boolean {
        return this.applyStatusEffect(playerId, this.statusConditionToType(condition));
    }
    
    /*
     * Helper methods to work with serializable arrays
     * TODO can we fix how these are considered serializable to remove the casts
     */
    private getActiveEffects(playerId: number): StatusEffect[] {
        const effects = (this.state.activeStatusEffects[playerId] as unknown as StatusEffect[]) || [];
        return effects;
    }
    
    private setActiveEffects(playerId: number, effects: StatusEffect[]): void {
        this.state.activeStatusEffects[playerId] = effects as unknown as Serializable;
    }

    // Apply status effect to active FieldCard
    public applyStatusEffect(playerId: number, effect: StatusEffectType): boolean {
        const currentTurn = this.controllers.turnCounter.getTurnNumber();
        const newEffect: StatusEffect = { type: effect, appliedTurn: currentTurn };
        
        let effects = this.getActiveEffects(playerId);
        
        // Remove conflicting status effects (only one of asleep, confused, paralyzed can be active)
        if (effect === StatusEffectType.ASLEEP || effect === StatusEffectType.CONFUSED || effect === StatusEffectType.PARALYZED) {
            effects = effects.filter(e => e.type !== StatusEffectType.ASLEEP 
                && e.type !== StatusEffectType.CONFUSED 
                && e.type !== StatusEffectType.PARALYZED,
            );
        }
        
        // Remove existing effect of same type
        effects = effects.filter(e => e.type !== effect);
        
        // Add new effect
        effects.push(newEffect);
        this.setActiveEffects(playerId, effects);
        return true;
    }


    // Remove status effect from active FieldCard
    public removeStatusEffect(playerId: number, effect: StatusEffectType): boolean {
        const effects = this.getActiveEffects(playerId);
        const initialLength = effects.length;
        const filteredEffects = effects.filter(e => e.type !== effect);
        this.setActiveEffects(playerId, filteredEffects);
        return filteredEffects.length < initialLength;
    }

    // Remove all status effects from active FieldCard (used when retreating/evolving)
    public clearAllStatusEffects(playerId: number): void {
        this.setActiveEffects(playerId, []);
    }

    // Get active FieldCard status effects
    public getActiveStatusEffects(playerId: number): StatusEffect[] {
        return [ ...this.getActiveEffects(playerId) ];
    }

    // Check if FieldCard has specific status effect (only active FieldCard can have status effects)
    public hasStatusEffect(playerId: number, effect: StatusEffectType): boolean {
        const effects = this.getActiveStatusEffects(playerId);
        return effects.some(e => e.type === effect);
    }

    // Check if FieldCard can attack (not asleep, paralyzed, or confused with failed coin flip)
    public canAttack(playerId: number): boolean {
        const effects = this.getActiveStatusEffects(playerId);
        return !effects.some(e => e.type === StatusEffectType.ASLEEP || e.type === StatusEffectType.PARALYZED);
    }

    // Check if FieldCard can retreat (not asleep or paralyzed)
    public canRetreat(playerId: number): boolean {
        const effects = this.getActiveStatusEffects(playerId);
        return !effects.some(e => e.type === StatusEffectType.ASLEEP || e.type === StatusEffectType.PARALYZED);
    }

    // Process between-turn effects (poison, burn damage)
    public processBetweenTurnEffects(playerId: number): { poisonDamage: number; burnDamage: number } {
        const effects = this.getActiveStatusEffects(playerId);
        
        let poisonDamage = 0;
        let burnDamage = 0;

        // Check for poison status effect
        if (effects.some(e => String(e.type) === String(StatusEffectType.POISONED) || String(e.type) === 'poison')) {
            poisonDamage = 10;
        }

        // Check for burn status effect
        if (effects.some(e => String(e.type) === String(StatusEffectType.BURNED) || String(e.type) === 'burn')) {
            burnDamage = 20;
        }
        
        return { poisonDamage, burnDamage };
    }

    // Process end-of-turn status effect checks (coin flips for sleep, burn, paralysis removal)
    public processEndOfTurnChecks(playerId: number): { removedEffects: StatusEffectType[]; coinFlipResults: { effect: StatusEffectType; result: boolean }[] } {
        const effects = this.getActiveStatusEffects(playerId);
        
        const removedEffects: StatusEffectType[] = [];
        const coinFlipResults: { effect: StatusEffectType; result: boolean }[] = [];

        // Check asleep - coin flip to wake up
        if (effects.some(e => e.type === StatusEffectType.ASLEEP)) {
            const coinFlip = this.controllers.coinFlip.performCoinFlip(); // Use coinFlip controller
            
            coinFlipResults.push({ effect: StatusEffectType.ASLEEP, result: coinFlip });
            if (coinFlip) {
                this.removeStatusEffect(playerId, StatusEffectType.ASLEEP);
                removedEffects.push(StatusEffectType.ASLEEP);
            }
        }

        // Check burned - coin flip to recover
        if (effects.some(e => e.type === StatusEffectType.BURNED)) {
            const coinFlip = this.controllers.coinFlip.performCoinFlip(); // Use coinFlip controller
            
            coinFlipResults.push({ effect: StatusEffectType.BURNED, result: coinFlip });
            if (coinFlip) {
                this.removeStatusEffect(playerId, StatusEffectType.BURNED);
                removedEffects.push(StatusEffectType.BURNED);
            }
        }

        // Paralysis is automatically removed at end of next turn
        if (effects.some(e => e.type === StatusEffectType.PARALYZED)) {
            this.removeStatusEffect(playerId, StatusEffectType.PARALYZED);
            removedEffects.push(StatusEffectType.PARALYZED);
        }

        return { removedEffects, coinFlipResults };
    }

    // Handle confusion coin flip when attacking
    public handleConfusionAttack(playerId: number): { canAttack: boolean; selfDamage: number } {
        if (!this.hasStatusEffect(playerId, StatusEffectType.CONFUSED)) {
            return { canAttack: true, selfDamage: 0 };
        }

        const coinFlip = this.controllers.coinFlip.performCoinFlip(); // Use coinFlip controller
        
        if (coinFlip) {
            // On heads (success), FieldCard can attack with no self-damage
            return { canAttack: true, selfDamage: 0 };
        } 
        // On tails (failure), attack fails and FieldCard takes 30 damage to itself
        return { canAttack: false, selfDamage: 30 };
        
    }
}
