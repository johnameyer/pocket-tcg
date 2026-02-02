import { GlobalController, GenericControllerProvider } from '@cards-ts/core';
import { PendingSelection } from '../effects/pending-selection-types.js';

export type TurnStateData = {
    shouldEndTurn: boolean;
    supporterPlayedThisTurn: boolean;
    retreatedThisTurn: boolean;
    evolvedInstancesThisTurn: string[]; // Track evolved creatures by instance ID
    usedAbilitiesThisTurn: string[]; // Track ability usage by "instanceId-abilityName"
    pendingSelection?: PendingSelection;
    damageBoosts: Array<{ sourcePlayer: number; amount: number; effectName: string }>;
    damageReductions: Array<{ sourcePlayer: number; amount: number; effectName: string }>;
    retreatCostReductions: Array<{ sourcePlayer: number; amount: number; effectName: string }>;
    retreatPreventions: string[]; // Instance IDs of creatures that cannot retreat
    damagePrevention: Array<{ sourcePlayer: number; effectName: string }>;
    evolutionFlexibility: Array<{ sourcePlayer: number; effectName: string }>;
};

type TurnStateDependencies = {};

export class TurnStateControllerProvider implements GenericControllerProvider<TurnStateData, TurnStateDependencies, TurnStateController> {
    controller(state: TurnStateData, controllers: TurnStateDependencies): TurnStateController {
        return new TurnStateController(state, controllers);
    }
    
    initialState(): TurnStateData {
        return {
            shouldEndTurn: false,
            supporterPlayedThisTurn: false,
            retreatedThisTurn: false,
            evolvedInstancesThisTurn: [],
            usedAbilitiesThisTurn: [],
            pendingSelection: undefined,
            damageBoosts: [],
            damageReductions: [],
            retreatCostReductions: [],
            retreatPreventions: [],
            damagePrevention: [],
            evolutionFlexibility: [],
        };
    }
    
    dependencies() {
        return {} as const;
    }
}

export class TurnStateController extends GlobalController<TurnStateData, TurnStateDependencies> {
    validate() {
        return true;
    }

    public setShouldEndTurn(value: boolean): void {
        this.state.shouldEndTurn = value;
    }

    public getShouldEndTurn(): boolean {
        return this.state.shouldEndTurn;
    }

    public setSupporterPlayedThisTurn(value: boolean): void {
        this.state.supporterPlayedThisTurn = value;
    }

    public hasSupporterBeenPlayedThisTurn(): boolean {
        return this.state.supporterPlayedThisTurn;
    }

    public startTurn(): void {
        this.state.shouldEndTurn = false;
        this.state.supporterPlayedThisTurn = false;
        this.state.retreatedThisTurn = false;
        this.state.evolvedInstancesThisTurn = [];
        this.state.usedAbilitiesThisTurn = [];
        this.state.damageBoosts = [];
        this.state.damageReductions = [];
        this.state.retreatCostReductions = [];
        // Note: retreatPreventions are cleared based on duration, not every turn
        this.state.damagePrevention = [];
        this.state.evolutionFlexibility = [];
    }
    
    public markEvolvedThisTurn(instanceId: string): void {
        if (!this.state.evolvedInstancesThisTurn.includes(instanceId)) {
            this.state.evolvedInstancesThisTurn.push(instanceId);
        }
    }
    
    public hasEvolvedThisTurn(instanceId: string): boolean {
        return this.state.evolvedInstancesThisTurn.includes(instanceId);
    }
    
    public markAbilityUsed(instanceId: string, abilityName: string): void {
        const abilityKey = `${instanceId}-${abilityName}`;
        if (!this.state.usedAbilitiesThisTurn) {
            this.state.usedAbilitiesThisTurn = [];
        }
        if (!this.state.usedAbilitiesThisTurn.includes(abilityKey)) {
            this.state.usedAbilitiesThisTurn.push(abilityKey);
        }
    }
    
    public hasAbilityBeenUsedThisTurn(instanceId: string, abilityName: string): boolean {
        const abilityKey = `${instanceId}-${abilityName}`;
        return this.state.usedAbilitiesThisTurn?.includes(abilityKey) || false;
    }

    public setRetreatedThisTurn(value: boolean): void {
        this.state.retreatedThisTurn = value;
    }
    
    public hasRetreatedThisTurn(): boolean {
        return this.state.retreatedThisTurn;
    }

    public setPendingSelection(selection: PendingSelection | undefined): void {
        this.state.pendingSelection = selection;
    }
    
    public getPendingSelection(): PendingSelection | undefined {
        return this.state.pendingSelection;
    }
    
    public clearPendingSelection(): void {
        this.state.pendingSelection = undefined;
    }

    public addDamageBoost(sourcePlayer: number, amount: number, effectName: string): void {
        this.state.damageBoosts.push({ sourcePlayer, amount, effectName });
    }

    public getDamageBoosts(): Array<{ sourcePlayer: number; amount: number; effectName: string }> {
        return this.state.damageBoosts;
    }

    public addDamageReduction(sourcePlayer: number, amount: number, effectName: string): void {
        this.state.damageReductions.push({ sourcePlayer, amount, effectName });
    }

    public getDamageReductions(): Array<{ sourcePlayer: number; amount: number; effectName: string }> {
        return this.state.damageReductions;
    }

    public addRetreatCostReduction(sourcePlayer: number, amount: number, effectName: string): void {
        this.state.retreatCostReductions.push({ sourcePlayer, amount, effectName });
    }

    public addRetreatPrevention(instanceId: string): void {
        if (!this.state.retreatPreventions.includes(instanceId)) {
            this.state.retreatPreventions.push(instanceId);
        }
    }

    public isRetreatPrevented(instanceId: string): boolean {
        return this.state.retreatPreventions.includes(instanceId);
    }

    public clearRetreatPreventions(): void {
        this.state.retreatPreventions = [];
    }

    public registerDamagePrevention(sourcePlayer: number, effectName: string): void {
        this.state.damagePrevention.push({ sourcePlayer, effectName });
    }

    public getDamagePrevention(): Array<{ sourcePlayer: number; effectName: string }> {
        return this.state.damagePrevention;
    }

    public registerEvolutionFlexibility(sourcePlayer: number, effectName: string): void {
        this.state.evolutionFlexibility.push({ sourcePlayer, effectName });
    }
}
