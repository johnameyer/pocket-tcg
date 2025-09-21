import { CardRepository } from '../src/repository/card-repository.js';
import { CreatureData, ItemData, SupporterData } from '../src/repository/card-types.js';

// Create mock data for the CardRepository
const mockCreatureData = new Map<string, CreatureData>();

// Basic creatures for general testing
mockCreatureData.set('basic-creature', {
    templateId: 'basic-creature',
    name: 'Basic Creature',
    maxHp: 60,
    type: 'fire',
    weakness: 'water',
    retreatCost: 1,
    attacks: [{ name: 'Basic Attack', damage: 20, energyRequirements: [{ type: 'fire', amount: 1 }] }]
});

mockCreatureData.set('high-hp-creature', {
    templateId: 'high-hp-creature',
    name: 'High HP Creature',
    maxHp: 180,
    type: 'fighting',
    weakness: 'psychic',
    retreatCost: 3,
    attacks: [{ name: 'Strong Attack', damage: 60, energyRequirements: [{ type: 'fighting', amount: 2 }] }]
});

mockCreatureData.set('evolution-creature', {
    templateId: 'evolution-creature',
    name: 'Evolution Creature',
    maxHp: 120,
    type: 'fire',
    weakness: 'water',
    retreatCost: 2,
    evolvesFrom: 'basic-creature',
    attacks: [{ name: 'Evolved Attack', damage: 50, energyRequirements: [{ type: 'fire', amount: 2 }] }]
});

mockCreatureData.set('tank-creature', {
    templateId: 'tank-creature',
    name: 'Tank Creature',
    maxHp: 140,
    type: 'colorless',
    weakness: 'fighting',
    retreatCost: 3,
    attacks: [{ name: 'Body Slam', damage: 50, energyRequirements: [{ type: 'colorless', amount: 3 }] }]
});

const mockSupporterData = new Map<string, SupporterData>();
mockSupporterData.set('basic-supporter', {
    templateId: 'basic-supporter',
    name: 'Basic Supporter',
    effects: [{ 
        type: 'hp', 
        amount: { type: 'constant', value: 20 },
        target: { type: 'fixed', player: 'self', position: 'active' },
        operation: 'heal'
    }]
});

const mockItemData = new Map<string, ItemData>();
mockItemData.set('basic-item', {
    templateId: 'basic-item',
    name: 'Basic Item',
    effects: [{ type: 'hp', amount: { type: 'constant', value: 20 }, target: { type: 'fixed', player: 'self', position: 'active' }, operation: 'heal' }]
});

export interface MockRepositoryExtensions {
    creatures?: Map<string, CreatureData>;
    supporters?: Map<string, SupporterData>;
    items?: Map<string, ItemData>;
}

export class MockCardRepository extends CardRepository {
    constructor(extensions: MockRepositoryExtensions = {}) {
        const allCreatures = new Map([...Array.from(mockCreatureData), ...Array.from(extensions.creatures || new Map())]);
        const allSupporters = new Map([...Array.from(mockSupporterData), ...Array.from(extensions.supporters || new Map())]);
        const allItems = new Map([...Array.from(mockItemData), ...Array.from(extensions.items || new Map())]);
        
        super(allCreatures, allSupporters, allItems);
    }
}

export const mockRepository = new MockCardRepository();
