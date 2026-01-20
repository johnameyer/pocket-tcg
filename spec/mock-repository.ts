import { CardRepository } from '../src/repository/card-repository.js';
import { CreatureData, ItemData, SupporterData, ToolData } from '../src/repository/card-types.js';

const mockCreatureData = new Map<string, CreatureData>();

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

mockCreatureData.set('turn-limit-creature', {
    templateId: 'turn-limit-creature',
    name: 'Turn Limit Creature',
    maxHp: 200,
    type: 'colorless',
    weakness: 'fighting',
    retreatCost: 1,
    attacks: [{ name: 'Weak Attack', damage: 10, energyRequirements: [{ type: 'colorless', amount: 1 }] }]
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

mockSupporterData.set('draw-supporter', {
    templateId: 'draw-supporter',
    name: 'Draw Supporter',
    effects: []
});

mockSupporterData.set('coin-flip-supporter', {
    templateId: 'coin-flip-supporter',
    name: 'Coin Flip Supporter',
    effects: []
});

const mockItemData = new Map<string, ItemData>();
mockItemData.set('basic-item', {
    templateId: 'basic-item',
    name: 'Basic Item',
    effects: [{ type: 'hp', amount: { type: 'constant', value: 20 }, target: { type: 'fixed', player: 'self', position: 'active' }, operation: 'heal' }]
});

mockItemData.set('shuffle-item', {
    templateId: 'shuffle-item',
    name: 'Shuffle Item',
    effects: []
});

const mockToolData = new Map<string, ToolData>();
mockToolData.set('basic-tool', {
    templateId: 'basic-tool',
    name: 'Basic Tool',
    effects: []
});

mockToolData.set('power-enhancer', {
    templateId: 'power-enhancer',
    name: 'Power Enhancer',
    effects: []
});

mockToolData.set('leftovers', {
    templateId: 'leftovers',
    name: 'Leftovers',
    effects: [{ type: 'hp', operation: 'heal', amount: { type: 'constant', value: 20 }, target: { type: 'fixed', player: 'self', position: 'active' } }],
    trigger: { type: 'end-of-turn' }
});

export interface MockRepositoryExtensions {
    creatures?: Map<string, CreatureData>;
    supporters?: Map<string, SupporterData>;
    items?: Map<string, ItemData>;
    tools?: Map<string, ToolData>;
}

export class MockCardRepository extends CardRepository {
    constructor(extensions: MockRepositoryExtensions = {}) {
        const allCreatures = new Map([...Array.from(mockCreatureData), ...Array.from(extensions.creatures || new Map())]);
        const allSupporters = new Map([...Array.from(mockSupporterData), ...Array.from(extensions.supporters || new Map())]);
        const allItems = new Map([...Array.from(mockItemData), ...Array.from(extensions.items || new Map())]);
        const allTools = new Map([...Array.from(mockToolData), ...Array.from(extensions.tools || new Map())]);
        
        super(allCreatures, allSupporters, allItems, allTools);
    }
}

export const mockRepository = new MockCardRepository();
