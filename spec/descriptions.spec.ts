import { expect } from 'chai';
import { CardRepository } from '../src/repository/card-repository.js';
import { CreatureData, SupporterData, ItemData, ToolData, StadiumData } from '../src/repository/card-types.js';

describe('Card Descriptions', () => {
    it('should accept optional description on creature attack', () => {
        const creatureWithAttackDescription: CreatureData = {
            templateId: 'test-creature',
            name: 'Test Creature',
            maxHp: 100,
            type: 'fire',
            retreatCost: 1,
            attacks: [{
                name: 'Test Attack',
                description: 'This is a test attack description',
                damage: 50,
                energyRequirements: [{ type: 'fire', amount: 2 }],
            }],
        };

        const repository = new CardRepository(
            new Map([['test-creature', creatureWithAttackDescription]]),
            new Map(),
            new Map(),
            new Map(),
            new Map(),
        );

        const retrieved = repository.getCreature('test-creature');
        expect(retrieved.attacks[0].description).to.equal('This is a test attack description');
    });

    it('should accept optional description on creature ability', () => {
        const creatureWithAbilityDescription: CreatureData = {
            templateId: 'test-creature',
            name: 'Test Creature',
            maxHp: 100,
            type: 'fire',
            retreatCost: 1,
            attacks: [{
                name: 'Basic Attack',
                damage: 30,
                energyRequirements: [{ type: 'fire', amount: 1 }],
            }],
            ability: {
                name: 'Test Ability',
                description: 'This is a test ability description',
                trigger: { type: 'manual', unlimited: false },
                effects: [],
            },
        };

        const repository = new CardRepository(
            new Map([['test-creature', creatureWithAbilityDescription]]),
            new Map(),
            new Map(),
            new Map(),
            new Map(),
        );

        const retrieved = repository.getCreature('test-creature');
        expect(retrieved.ability?.description).to.equal('This is a test ability description');
    });

    it('should accept optional description on supporter card', () => {
        const supporterWithDescription: SupporterData = {
            templateId: 'test-supporter',
            name: 'Test Supporter',
            description: 'This is a test supporter description',
            effects: [{ type: 'draw', amount: { type: 'constant', value: 3 } }],
        };

        const repository = new CardRepository(
            new Map(),
            new Map([['test-supporter', supporterWithDescription]]),
            new Map(),
            new Map(),
            new Map(),
        );

        const retrieved = repository.getSupporter('test-supporter');
        expect(retrieved.description).to.equal('This is a test supporter description');
    });

    it('should accept optional description on item card', () => {
        const itemWithDescription: ItemData = {
            templateId: 'test-item',
            name: 'Test Item',
            description: 'This is a test item description',
            effects: [{ type: 'draw', amount: { type: 'constant', value: 2 } }],
        };

        const repository = new CardRepository(
            new Map(),
            new Map(),
            new Map([['test-item', itemWithDescription]]),
            new Map(),
            new Map(),
        );

        const retrieved = repository.getItem('test-item');
        expect(retrieved.description).to.equal('This is a test item description');
    });

    it('should accept optional description on tool card', () => {
        const toolWithDescription: ToolData = {
            templateId: 'test-tool',
            name: 'Test Tool',
            description: 'This is a test tool description',
            effects: [],
        };

        const repository = new CardRepository(
            new Map(),
            new Map(),
            new Map(),
            new Map([['test-tool', toolWithDescription]]),
            new Map(),
        );

        const retrieved = repository.getTool('test-tool');
        expect(retrieved.description).to.equal('This is a test tool description');
    });

    it('should accept optional description on stadium card', () => {
        const stadiumWithDescription: StadiumData = {
            templateId: 'test-stadium',
            name: 'Test Stadium',
            description: 'This is a test stadium description',
            effects: [],
        };

        const repository = new CardRepository(
            new Map(),
            new Map(),
            new Map(),
            new Map(),
            new Map([['test-stadium', stadiumWithDescription]]),
        );

        const retrieved = repository.getStadium('test-stadium');
        expect(retrieved.description).to.equal('This is a test stadium description');
    });

    it('should work without descriptions (backward compatibility)', () => {
        const creatureWithoutDescription: CreatureData = {
            templateId: 'test-creature',
            name: 'Test Creature',
            maxHp: 100,
            type: 'fire',
            retreatCost: 1,
            attacks: [{
                name: 'Basic Attack',
                damage: 30,
                energyRequirements: [{ type: 'fire', amount: 1 }],
            }],
        };

        const supporterWithoutDescription: SupporterData = {
            templateId: 'test-supporter',
            name: 'Test Supporter',
            effects: [],
        };

        const repository = new CardRepository(
            new Map([['test-creature', creatureWithoutDescription]]),
            new Map([['test-supporter', supporterWithoutDescription]]),
            new Map(),
            new Map(),
            new Map(),
        );

        const creature = repository.getCreature('test-creature');
        const supporter = repository.getSupporter('test-supporter');

        expect(creature.attacks[0].description).to.be.undefined;
        expect(supporter.description).to.be.undefined;
    });
});
