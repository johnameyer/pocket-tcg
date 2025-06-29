export type EnergyType = 'grass' | 'fire' | 'water' | 'lightning' | 'psychic' | 'fighting' | 'darkness' | 'metal';

export interface EnergyRequirement {
    type: EnergyType | 'colorless';
    amount: number;
}

export interface CreatureAttack {
    name: string;
    damage: number;
    energyRequirements: EnergyRequirement[];
}

export interface CreatureData {
    id: string;
    name: string;
    maxHp: number;
    attacks: CreatureAttack[];
    evolvesFrom?: string;
}

export interface SupporterAction {
    name: string;
    effect: string;
}

export interface SupporterData {
    id: string;
    name: string;
    actions: SupporterAction[];
}

export interface ItemEffect {
    type: 'heal' | 'damage' | 'draw';
    amount: number;
    target: 'self' | 'opponent' | 'any';
}

export interface ItemData {
    id: string;
    name: string;
    effect: string;
    effects: ItemEffect[];
}

export interface ToolData {
    id: string;
    name: string;
    effect: string;
    effects: string[];
}

export type CardData = CreatureData | SupporterData | ItemData | ToolData;


