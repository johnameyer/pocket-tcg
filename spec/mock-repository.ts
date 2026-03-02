import { CardRepository } from '../src/repository/card-repository.js';
import { CreatureData, ItemData, SupporterData, ToolData, StadiumData } from '../src/repository/card-types.js';

const mockCreatureData: Record<string, CreatureData> = {};

mockCreatureData['basic-creature'] = {
    templateId: 'basic-creature',
    name: 'Basic Creature',
    maxHp: 60,
    type: 'fire',
    weakness: 'water',
    retreatCost: 1,
    attacks: [{ name: 'Basic Attack', damage: 20, energyRequirements: [{ type: 'fire', amount: 1 }] }],
};

mockCreatureData['high-hp-creature'] = {
    templateId: 'high-hp-creature',
    name: 'High HP Creature',
    maxHp: 180,
    type: 'fighting',
    weakness: 'psychic',
    retreatCost: 3,
    attacks: [{ name: 'Strong Attack', damage: 60, energyRequirements: [{ type: 'fighting', amount: 2 }] }],
};

mockCreatureData['evolution-creature'] = {
    templateId: 'evolution-creature',
    name: 'Evolution Creature',
    maxHp: 120,
    type: 'fire',
    weakness: 'water',
    retreatCost: 2,
    previousStageName: 'Basic Creature',
    attacks: [{ name: 'Evolved Attack', damage: 50, energyRequirements: [{ type: 'fire', amount: 2 }] }],
};

mockCreatureData['stage-2-creature'] = {
    templateId: 'stage-2-creature',
    name: 'Stage 2 Creature',
    maxHp: 150,
    type: 'fire',
    weakness: 'water',
    retreatCost: 3,
    previousStageName: 'Evolution Creature',
    attacks: [{ name: 'Final Attack', damage: 80, energyRequirements: [{ type: 'fire', amount: 3 }] }],
};

mockCreatureData['tank-creature'] = {
    templateId: 'tank-creature',
    name: 'Tank Creature',
    maxHp: 140,
    type: 'colorless',
    weakness: 'fighting',
    retreatCost: 3,
    attacks: [{ name: 'Body Slam', damage: 50, energyRequirements: [{ type: 'colorless', amount: 3 }] }],
};

mockCreatureData['ex-creature'] = {
    templateId: 'ex-creature',
    name: 'Ex Creature',
    maxHp: 120,
    type: 'water',
    weakness: 'grass',
    retreatCost: 2,
    attributes: { ex: true },
    attacks: [{ name: 'Ex Attack', damage: 40, energyRequirements: [{ type: 'water', amount: 2 }] }],
};

mockCreatureData['mega-ex-creature'] = {
    templateId: 'mega-ex-creature',
    name: 'Mega Ex Creature',
    maxHp: 120,
    type: 'lightning',
    weakness: 'fighting',
    retreatCost: 3,
    attributes: { ex: true, mega: true },
    attacks: [{ name: 'Mega Attack', damage: 60, energyRequirements: [{ type: 'lightning', amount: 3 }] }],
};

const mockSupporterData: Record<string, SupporterData> = {};
mockSupporterData['basic-supporter'] = {
    templateId: 'basic-supporter',
    name: 'Basic Supporter',
    effects: [{ 
        type: 'hp', 
        amount: { type: 'constant', value: 20 },
        target: { type: 'fixed', player: 'self', position: 'active' },
        operation: 'heal',
    }],
};

mockSupporterData['draw-supporter'] = {
    templateId: 'draw-supporter',
    name: 'Draw Supporter',
    effects: [],
};

mockSupporterData['coin-flip-supporter'] = {
    templateId: 'coin-flip-supporter',
    name: 'Coin Flip Supporter',
    effects: [],
};

const mockItemData: Record<string, ItemData> = {};
mockItemData['basic-item'] = {
    templateId: 'basic-item',
    name: 'Basic Item',
    effects: [{ type: 'hp', amount: { type: 'constant', value: 20 }, target: { type: 'fixed', player: 'self', position: 'active' }, operation: 'heal' }],
};

mockItemData['shuffle-item'] = {
    templateId: 'shuffle-item',
    name: 'Shuffle Item',
    effects: [],
};

const mockToolData: Record<string, ToolData> = {};
mockToolData['basic-tool'] = {
    templateId: 'basic-tool',
    name: 'Basic Tool',
    effects: [],
};

mockToolData['power-enhancer'] = {
    templateId: 'power-enhancer',
    name: 'Power Enhancer',
    effects: [],
};

mockToolData.leftovers = {
    templateId: 'leftovers',
    name: 'Leftovers',
    effects: [{ type: 'hp', operation: 'heal', amount: { type: 'constant', value: 20 }, target: { type: 'fixed', player: 'self', position: 'active' }}],
    trigger: { type: 'end-of-turn' },
};

mockToolData['test-tool'] = {
    templateId: 'test-tool',
    name: 'Test Tool',
    effects: [],
};

const mockStadiumData: Record<string, StadiumData> = {};
mockStadiumData['basic-stadium'] = {
    templateId: 'basic-stadium',
    name: 'Basic Stadium',
    effects: [],
};

mockStadiumData['hp-boost-stadium'] = {
    templateId: 'hp-boost-stadium',
    name: 'HP Boost Stadium',
    effects: [{
        type: 'hp-bonus',
        amount: { type: 'constant', value: 20 },
        target: {},
        duration: { type: 'while-in-play' },
    }],
};

mockStadiumData['retreat-cost-stadium'] = {
    templateId: 'retreat-cost-stadium',
    name: 'Retreat Cost Stadium',
    effects: [{
        type: 'retreat-cost-modification', operation: 'decrease',
        amount: { type: 'constant', value: 1 },
        target: {},
        duration: { type: 'while-in-play' },
    }],
};

export interface MockRepositoryExtensions {
    creatures?: Record<string, CreatureData>;
    supporters?: Record<string, SupporterData>;
    items?: Record<string, ItemData>;
    tools?: Record<string, ToolData>;
    stadiums?: Record<string, StadiumData>;
}

export class MockCardRepository extends CardRepository {
    constructor(extensions: MockRepositoryExtensions = {}) {
        const allCreatures = { ...mockCreatureData, ...(extensions.creatures || {}) };
        const allSupporters = { ...mockSupporterData, ...(extensions.supporters || {}) };
        const allItems = { ...mockItemData, ...(extensions.items || {}) };
        const allTools = { ...mockToolData, ...(extensions.tools || {}) };
        const allStadiums = { ...mockStadiumData, ...(extensions.stadiums || {}) };
        
        super(allCreatures, allSupporters, allItems, allTools, allStadiums);
    }
}

export const mockRepository = new MockCardRepository();
