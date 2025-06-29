import { CreatureData, ItemData, SupporterData, ToolData } from '../src/repository/card-types.js';
import { CardRepository } from '../src/repository/card-repository.js';

// TODO just create as a const object instead of using a Map
// Create mock data for the CardRepository
const mockCreatureData = new Map<string, CreatureData>();
mockCreatureData.set('test-creature-0', {
    id: 'test-creature-0',
    name: 'Test Creature 0',
    maxHp: 100,
    attacks: [{ name: 'Test Attack', damage: 20 }]
});
mockCreatureData.set('test-creature-1', {
    id: 'test-creature-1',
    name: 'Test Creature 1',
    maxHp: 120,
    attacks: [{ name: 'Test Attack', damage: 30 }]
});
mockCreatureData.set('test-evolution', {
    id: 'test-evolution',
    name: 'Test Evolution',
    maxHp: 180,
    attacks: [{ name: 'Evolved Attack', damage: 50 }],
    evolvesFrom: 'test-creature-0'
});

const mockSupporterData = new Map<string, SupporterData>();
mockSupporterData.set('test-supporter-0', {
    id: 'test-supporter-0',
    name: 'Test Supporter',
    actions: [{ name: 'Test Action', effect: 'Test Effect' }]
});

const mockItemData = new Map<string, ItemData>();
mockItemData.set('test-item-0', {
    id: 'test-item-0',
    name: 'Test Item',
    effect: 'Test Effect',
    effects: [{ type: 'heal', amount: 20, target: 'self' }]
});

const mockToolData = new Map<string, ToolData>();
mockToolData.set('test-tool-0', {
    id: 'test-tool-0',
    name: 'Test Tool',
    effect: 'Test Effect',
    effects: []
});

export const mockRepository = new CardRepository(
    mockCreatureData,
    mockSupporterData,
    mockItemData,
    mockToolData
);
