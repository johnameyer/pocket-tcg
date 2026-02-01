import { expect } from 'chai';
import { PlayCardResponseMessage } from '../../../src/messages/response/play-card-response-message.js';
import { AttackResponseMessage } from '../../../src/messages/response/attack-response-message.js';
import { StateBuilder } from '../../helpers/state-builder.js';
import { runTestGame } from '../../helpers/test-helpers.js';
import { MockCardRepository } from '../../mock-repository.js';
import { CreatureData, ToolData } from '../../../src/repository/card-types.js';

describe('HP Bonus Effect', () => {
    const basicCreature = { templateId: 'basic-creature', type: 'creature' as const };
    const hpTool = { templateId: 'hp-tool', type: 'tool' as const };

    const testRepository = new MockCardRepository({
        creatures: new Map<string, CreatureData>([
            [ 'basic-creature', {
                templateId: 'basic-creature',
                name: 'Basic Creature',
                maxHp: 80,
                type: 'fire',
                weakness: 'water',
                retreatCost: 1,
                attacks: [{ name: 'Basic Attack', damage: 20, energyRequirements: [{ type: 'fire', amount: 1 }] }],
            }],
            [ 'low-hp-creature', {
                templateId: 'low-hp-creature',
                name: 'Low HP Creature',
                maxHp: 50,
                type: 'grass',
                weakness: 'fire',
                retreatCost: 1,
                attacks: [{ name: 'Weak Attack', damage: 60, energyRequirements: [{ type: 'grass', amount: 1 }] }],
            }],
        ]),
        tools: new Map<string, ToolData>([
            [ 'hp-tool', {
                templateId: 'hp-tool',
                name: 'HP Tool',
                effects: [{
                    type: 'hp-bonus',
                    amount: { type: 'constant', value: 30 },
                }],
            }],
        ]),
    });

    const lowHpCreature = { templateId: 'low-hp-creature', type: 'creature' as const };

    it('should allow Pokemon to survive attacks that would normally KO (basic operation)', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [ new AttackResponseMessage(0) ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'low-hp-creature'),
                StateBuilder.withCreatures(1, 'basic-creature'),
                StateBuilder.withTool('basic-creature-1', 'hp-tool'), // HP bonus tool attached
                StateBuilder.withEnergy('low-hp-creature-0', { grass: 1 }),
                StateBuilder.withDamage('basic-creature-1', 40), // Pre-damage: would be KO'd at 50 HP base
            ),
            maxSteps: 10,
        });

        expect(getExecutedCount()).to.equal(1, 'Should have executed attack');
        expect(state.field.creatures[1][0].damageTaken).to.equal(100, 'Should have taken 100 total damage (40 + 60)');
        expect(state.field.creatures[1][0]).to.exist; // Should survive with HP bonus (50 + 30 = 80 HP)
    });

    it('should be attached via tool attachment', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [ new PlayCardResponseMessage('hp-tool', 'tool', 0, 0) ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature'),
                StateBuilder.withHand(0, [ hpTool ]),
            ),
            maxSteps: 10,
        });

        expect(getExecutedCount()).to.equal(1, 'Should have attached HP tool');
        expect(state.tools.attachedTools['basic-creature-0']).to.exist;
        expect(state.tools.attachedTools['basic-creature-0'].templateId).to.equal('hp-tool');
    });

    it('should prevent KO when Pokemon would normally be knocked out', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [ new AttackResponseMessage(0) ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'low-hp-creature'),
                StateBuilder.withCreatures(1, 'low-hp-creature'),
                StateBuilder.withTool('low-hp-creature-1', 'hp-tool'), // Target has HP bonus
                StateBuilder.withEnergy('low-hp-creature-0', { grass: 1 }),
                StateBuilder.withDamage('low-hp-creature-1', 45), // 45 + 60 = 105 damage, would KO 50 HP but not 80 HP
            ),
            maxSteps: 10,
        });

        expect(getExecutedCount()).to.equal(1, 'Should have executed attack');
        expect(state.field.creatures[1][0]).to.exist; // Should survive with HP bonus
        expect(state.field.creatures[1][0].damageTaken).to.equal(80, 'Should have maximum damage for survival'); // Capped at effective HP
    });

    it('should work with bench Pokemon', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [ new PlayCardResponseMessage('hp-tool', 'tool', 0, 1) ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature', [ 'low-hp-creature' ]),
                StateBuilder.withHand(0, [ hpTool ]),
            ),
            maxSteps: 10,
        });

        expect(getExecutedCount()).to.equal(1, 'Should have attached HP tool to bench');
        expect(state.tools.attachedTools['low-hp-creature-0-0']).to.exist;
        expect(state.tools.attachedTools['low-hp-creature-0-0'].templateId).to.equal('hp-tool');
    });

    it('should prevent tool attachment when Pokemon already has one', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [ new PlayCardResponseMessage('hp-tool', 'tool', 0, 0) ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature'),
                StateBuilder.withTool('basic-creature-0', 'hp-tool'), // Already has tool
                StateBuilder.withHand(0, [ hpTool ]),
            ),
            maxSteps: 10,
        });

        expect(getExecutedCount()).to.equal(0, 'Should not have attached second tool');
        expect(state.hand[0].length).to.equal(1, 'Tool should remain in hand');
    });
});
