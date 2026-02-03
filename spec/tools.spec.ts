import { expect } from 'chai';
import { PlayCardResponseMessage } from '../src/messages/response/play-card-response-message.js';
import { AttackResponseMessage } from '../src/messages/response/attack-response-message.js';
import { CardRepository } from '../src/repository/card-repository.js';
import { CreatureData, ToolData, SupporterData, ItemData } from '../src/repository/card-types.js';
import { StateBuilder } from './helpers/state-builder.js';
import { runTestGame } from './helpers/test-helpers.js';
import { mockRepository } from './mock-repository.js';

describe('Creature Tools', () => {
    const mockCreatureData = new Map<string, CreatureData>([
        [ 'flame-sprite', {
            templateId: 'flame-sprite',
            name: 'Flame Sprite',
            maxHp: 60,
            type: 'fire',
            weakness: 'water',
            retreatCost: 1,
            attacks: [{ name: 'Ember', damage: 20, energyRequirements: [{ type: 'fire', amount: 1 }] }],
        }],
        [ 'stone-wall', {
            templateId: 'stone-wall',
            name: 'Stone Wall',
            maxHp: 100,
            type: 'fighting',
            weakness: 'grass',
            retreatCost: 3,
            attacks: [{ name: 'Rock Throw', damage: 30, energyRequirements: [{ type: 'fighting', amount: 2 }] }],
        }],
        [ 'basic-creature', {
            templateId: 'basic-creature',
            name: 'Basic Creature',
            maxHp: 60,
            type: 'fire',
            weakness: 'water',
            retreatCost: 1,
            attacks: [{ name: 'Basic Attack', damage: 20, energyRequirements: [{ type: 'fire', amount: 1 }] }],
        }],
        [ 'high-hp-creature', {
            templateId: 'high-hp-creature',
            name: 'High HP Creature',
            maxHp: 180,
            type: 'fighting',
            weakness: 'psychic',
            retreatCost: 3,
            attacks: [{ name: 'Strong Attack', damage: 60, energyRequirements: [{ type: 'fighting', amount: 2 }] }],
        }],
    ]);

    const mockSupporterData = new Map<string, SupporterData>();
    const mockItemData = new Map<string, ItemData>();
    
    const mockToolData = new Map<string, ToolData>([
        [ 'leftovers', {
            templateId: 'leftovers',
            name: 'Leftovers',
            effects: [{ type: 'hp', operation: 'heal', amount: { type: 'constant', value: 20 }, target: { type: 'fixed', player: 'self', position: 'active' }}],
            trigger: { type: 'end-of-turn' },
        }],
        [ 'power-enhancer', {
            templateId: 'power-enhancer',
            name: 'Power Enhancer',
            effects: [],
        }],
    ]);

    const toolTestRepository = new CardRepository(mockCreatureData, mockSupporterData, mockItemData, mockToolData);

    describe('Tool attachment validation', () => {
        it('should prevent attaching tool when creature already has one', () => {
            const { state } = runTestGame({
                actions: [ new PlayCardResponseMessage('power-enhancer', 'tool', 0, 0) ],
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'flame-sprite'),
                    StateBuilder.withHand(0, [{ templateId: 'power-enhancer', type: 'tool' as const }]),
                    StateBuilder.withTool('flame-sprite-0', 'power-enhancer'),
                ),
                customRepository: toolTestRepository,
            });

            expect(state.hand[0]).to.have.length(1, 'Tool should still be in hand');
            expect(state.tools.attachedTools['flame-sprite-0']?.templateId).to.equal('power-enhancer', 'Creature should still have original tool');
        });

        it('should allow attaching tool to different creature', () => {
            const { state } = runTestGame({
                actions: [
                    new PlayCardResponseMessage('leftovers', 'tool', 0, 0),
                    new PlayCardResponseMessage('leftovers', 'tool', 0, 1),
                ],
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'flame-sprite', [ 'stone-wall' ]),
                    StateBuilder.withHand(0, [
                        { templateId: 'leftovers', type: 'tool' as const },
                        { templateId: 'leftovers', type: 'tool' as const },
                    ]),
                ),
                maxSteps: 10,
                customRepository: toolTestRepository,
            });

            expect(state.tools.attachedTools['flame-sprite-0']?.templateId).to.equal('leftovers');
            expect(state.tools.attachedTools['stone-wall-0-0']?.templateId).to.equal('leftovers');
        });

        it('should attach damage boost tool without triggering effects', () => {
            const { state } = runTestGame({
                actions: [ new PlayCardResponseMessage('power-enhancer', 'tool', 0, 0) ],
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'flame-sprite'),
                    StateBuilder.withHand(0, [{ templateId: 'power-enhancer', type: 'tool' as const }]),
                ),
                customRepository: toolTestRepository,
            });

            expect(state.tools.attachedTools['flame-sprite-0']?.templateId).to.equal('power-enhancer');
        });
    });

    describe('Tool Attachment Validation', () => {
        it('should allow attaching tool to creature', () => {
            const { state } = runTestGame({
                actions: [
                    new PlayCardResponseMessage('power-enhancer', 'tool', 0, 0),
                ],
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature'),
                    StateBuilder.withHand(0, [{ templateId: 'power-enhancer', type: 'tool' as const }]),
                ),
                customRepository: mockRepository,
            });

            expect(state.hand[0].length).to.equal(0, 'Tool should be removed from hand');
        });

        it('should prevent attaching tool when creature already has one', () => {
            const { state } = runTestGame({
                actions: [
                    new PlayCardResponseMessage('power-enhancer', 'tool', 0, 0),
                ],
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature'),
                    StateBuilder.withHand(0, [{ templateId: 'power-enhancer', type: 'tool' as const }]),
                    StateBuilder.withTool('basic-creature-0', 'leftovers'),
                ),
                customRepository: mockRepository,
            });

            expect(state.hand[0].length).to.equal(1, 'Tool should remain in hand when creature already has one');
        });

        it('should allow attaching tool to different creature', () => {
            const { state } = runTestGame({
                actions: [
                    new PlayCardResponseMessage('power-enhancer', 'tool', 0, 1),
                ],
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature', [ 'high-hp-creature' ]),
                    StateBuilder.withHand(0, [{ templateId: 'power-enhancer', type: 'tool' as const }]),
                    StateBuilder.withTool('basic-creature-0', 'leftovers'),
                ),
                customRepository: mockRepository,
            });

            expect(state.hand[0].length).to.equal(0, 'Tool should be removed from hand');
        });
    });

    describe('Tool passive effects - manually played vs pre-setup', () => {
        // Add a tool with passive HP bonus effect to the test repository
        const hpToolData = new Map<string, ToolData>([
            ...Array.from(mockToolData.entries()),
            [ 'hp-bonus-tool', {
                templateId: 'hp-bonus-tool',
                name: 'HP Bonus Tool',
                effects: [{
                    type: 'hp-bonus',
                    amount: { type: 'constant', value: 30 },
                    duration: { type: 'while-attached', toolInstanceId: '', cardInstanceId: '' },
                }],
            }],
        ]);

        const extendedToolRepository = new CardRepository(mockCreatureData, mockSupporterData, mockItemData, hpToolData);

        it('should apply tool passive effect when tool is played', () => {
            const { state, getExecutedCount } = runTestGame({
                actions: [ new PlayCardResponseMessage('hp-bonus-tool', 'tool', 0, 0) ],
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature'),
                    StateBuilder.withHand(0, [{ templateId: 'hp-bonus-tool', type: 'tool' as const }]),
                ),
                maxSteps: 10,
                customRepository: extendedToolRepository,
            });

            expect(getExecutedCount()).to.equal(1, 'Should have attached tool');
            expect(state.tools.attachedTools['basic-creature-0']?.templateId).to.equal('hp-bonus-tool');
            
            // Check that passive effect was registered
            const hpBonusEffects = state.effects.activePassiveEffects.filter(e => e.effect.type === 'hp-bonus');
            expect(hpBonusEffects).to.have.lengthOf(1, 'Should have 1 HP bonus passive effect from played tool');
        });

        it('should apply tool passive effect when tool is pre-setup', () => {
            const { state } = runTestGame({
                actions: [],
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature'),
                    StateBuilder.withTool('basic-creature-0', 'hp-bonus-tool'), // Pre-setup with tool
                ),
                maxSteps: 5,
                customRepository: extendedToolRepository,
            });

            expect(state.tools.attachedTools['basic-creature-0']?.templateId).to.equal('hp-bonus-tool');
            
            // Check that passive effect was registered during initialization
            const hpBonusEffects = state.effects.activePassiveEffects.filter(e => e.effect.type === 'hp-bonus');
            expect(hpBonusEffects).to.have.lengthOf(1, 'Should have 1 HP bonus passive effect from pre-setup tool');
        });

        it('should produce same passive effect count for played vs pre-setup tool', () => {
            // Test with manually played tool
            const playedResult = runTestGame({
                actions: [ new PlayCardResponseMessage('hp-bonus-tool', 'tool', 0, 0) ],
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature'),
                    StateBuilder.withHand(0, [{ templateId: 'hp-bonus-tool', type: 'tool' as const }]),
                ),
                maxSteps: 10,
                customRepository: extendedToolRepository,
            });

            // Test with pre-setup tool
            const preSetupResult = runTestGame({
                actions: [],
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature'),
                    StateBuilder.withTool('basic-creature-0', 'hp-bonus-tool'),
                ),
                maxSteps: 5,
                customRepository: extendedToolRepository,
            });

            // Both should result in same number of passive effects
            const playedHpEffects = playedResult.state.effects.activePassiveEffects.filter(e => e.effect.type === 'hp-bonus');
            const preSetupHpEffects = preSetupResult.state.effects.activePassiveEffects.filter(e => e.effect.type === 'hp-bonus');
            
            expect(playedHpEffects).to.have.lengthOf(1, 'Played tool should create 1 HP effect');
            expect(preSetupHpEffects).to.have.lengthOf(1, 'Pre-setup tool should create 1 HP effect');
            expect(playedHpEffects.length).to.equal(preSetupHpEffects.length, 'Effect count should be identical');
        });
    });

    describe('Tool passive effects cleared on knockout', () => {
        const retreatToolData = new Map<string, ToolData>([
            ...Array.from(mockToolData.entries()),
            [ 'retreat-boost-tool', {
                templateId: 'retreat-boost-tool',
                name: 'Retreat Boost Tool',
                effects: [{
                    type: 'retreat-cost-reduction',
                    amount: { type: 'constant', value: 1 },
                    duration: { type: 'while-attached', toolInstanceId: '', cardInstanceId: '' },
                }],
            }],
        ]);

        const retreatToolRepository = new CardRepository(mockCreatureData, mockSupporterData, mockItemData, retreatToolData);

        it('should clear tool passive effects when creature is knocked out', () => {
            // Use high-hp-creature as attacker (60 damage) to knock out basic-creature (60 HP) in one hit
            const { state } = runTestGame({
                actions: [ new AttackResponseMessage(0) ],
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'high-hp-creature'),
                    StateBuilder.withCreatures(1, 'basic-creature', [ 'basic-creature' ]), // Add bench creature to avoid game over
                    StateBuilder.withTool('basic-creature-1', 'retreat-boost-tool'),
                    StateBuilder.withEnergy('high-hp-creature-0', { fighting: 2 }), // Strong Attack costs 2 fighting
                ),
                maxSteps: 15,
                customRepository: retreatToolRepository,
            });
            
            // Check that passive effect was cleared (creature was knocked out)
            const retreatReductionEffects = state.effects.activePassiveEffects.filter(e => e.effect.type === 'retreat-cost-reduction');
            expect(retreatReductionEffects).to.have.lengthOf(0, 'Retreat cost reduction effect should be cleared after knockout');
        });
    });
});
