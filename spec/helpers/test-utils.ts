import { MockCardRepository } from '../mock-repository.js';
import { SupporterData, ItemData, CreatureData, ToolData } from '../../src/repository/card-types.js';

/**
 * Helper to create a MockCardRepository with a single supporter
 */
export function createSupporterRepo(templateId: string, name: string, effects: SupporterData['effects']): MockCardRepository {
    return new MockCardRepository({
        supporters: new Map([[templateId, { templateId, name, effects }]])
    });
}

/**
 * Helper to create a MockCardRepository with a single item
 */
export function createItemRepo(templateId: string, name: string, effects: ItemData['effects']): MockCardRepository {
    return new MockCardRepository({
        items: new Map([[templateId, { templateId, name, effects }]])
    });
}

/**
 * Helper to create a MockCardRepository with a single creature
 */
export function createCreatureRepo(templateId: string, creature: CreatureData): MockCardRepository {
    return new MockCardRepository({
        creatures: new Map([[templateId, creature]])
    });
}

/**
 * Helper to create a MockCardRepository with a single tool
 */
export function createToolRepo(templateId: string, tool: ToolData): MockCardRepository {
    return new MockCardRepository({
        tools: new Map([[templateId, tool]])
    });
}

/**
 * Helper to create an array of identical cards (useful for deck)
 */
export function createCardArray(count: number, templateId: string, type: 'creature' | 'supporter' | 'item' | 'tool' = 'creature') {
    return Array(count).fill({ templateId, type });
}
