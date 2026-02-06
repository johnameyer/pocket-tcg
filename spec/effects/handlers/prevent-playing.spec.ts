import { expect } from 'chai';
import { PlayCardResponseMessage } from '../../../src/messages/response/play-card-response-message.js';
import { EndTurnResponseMessage } from '../../../src/messages/response/end-turn-response-message.js';
import { StateBuilder } from '../../helpers/state-builder.js';
import { runTestGame } from '../../helpers/test-helpers.js';
import { MockCardRepository } from '../../mock-repository.js';
import { CreatureData, ItemData, SupporterData, ToolData } from '../../../src/repository/card-types.js';
import { PreventPlayingEffectHandler } from '../../../src/effects/handlers/prevent-playing-effect-handler.js';
import { PreventPlayingEffect } from '../../../src/repository/effect-types.js';

describe('Prevent Playing Effect', () => {
    describe('getResolutionRequirements', () => {
        const handler = new PreventPlayingEffectHandler();

        it('should return empty array (no resolution needed)', () => {
            const effect: PreventPlayingEffect = {
                type: 'prevent-playing',
                cardTypes: [ 'item' ],
                target: 'opponent',
                duration: { type: 'until-end-of-turn' },
            };

            const result = handler.getResolutionRequirements(effect);
            
            expect(result).to.be.an('array').that.is.empty;
        });
    });

    const basicCreature = { templateId: 'basic-creature', type: 'creature' as const };
    const highHpCreature = { templateId: 'high-hp-creature', type: 'creature' as const };
    const preventItem = { templateId: 'prevent-item', type: 'item' as const };
    const normalItem = { templateId: 'normal-item', type: 'item' as const };
    const supporter = { templateId: 'supporter', type: 'supporter' as const };
    const tool = { templateId: 'tool', type: 'tool' as const };

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
            [ 'high-hp-creature', {
                templateId: 'high-hp-creature',
                name: 'High HP Creature',
                maxHp: 180,
                type: 'water',
                weakness: 'grass',
                retreatCost: 2,
                attacks: [{ name: 'Water Attack', damage: 30, energyRequirements: [{ type: 'water', amount: 2 }] }],
            }],
        ]),
        items: new Map<string, ItemData>([
            [ 'prevent-item', {
                templateId: 'prevent-item',
                name: 'Prevent Item',
                effects: [{
                    type: 'prevent-playing',
                    cardTypes: [ 'item' ],
                    target: 'opponent',
                    duration: { type: 'until-end-of-next-turn' },
                }],
            }],
            [ 'prevent-items-supporters', {
                templateId: 'prevent-items-supporters',
                name: 'Prevent Items and Supporters',
                effects: [{
                    type: 'prevent-playing',
                    cardTypes: [ 'item', 'supporter' ],
                    target: 'opponent',
                    duration: { type: 'until-end-of-next-turn' },
                }],
            }],
            [ 'prevent-creatures', {
                templateId: 'prevent-creatures',
                name: 'Prevent Creatures',
                effects: [{
                    type: 'prevent-playing',
                    cardTypes: [ 'creature' ],
                    target: 'opponent',
                    duration: { type: 'until-end-of-next-turn' },
                }],
            }],
            [ 'prevent-tools', {
                templateId: 'prevent-tools',
                name: 'Prevent Tools',
                effects: [{
                    type: 'prevent-playing',
                    cardTypes: [ 'tool' ],
                    target: 'opponent',
                    duration: { type: 'until-end-of-next-turn' },
                }],
            }],
            [ 'prevent-all', {
                templateId: 'prevent-all',
                name: 'Prevent All',
                effects: [{
                    type: 'prevent-playing',
                    cardTypes: [ 'creature', 'item', 'supporter', 'tool' ],
                    target: 'opponent',
                    duration: { type: 'until-end-of-next-turn' },
                }],
            }],
            [ 'self-prevent-item', {
                templateId: 'self-prevent-item',
                name: 'Self Prevent Item',
                effects: [{
                    type: 'prevent-playing',
                    cardTypes: [ 'supporter' ],
                    target: 'self',
                    duration: { type: 'until-end-of-next-turn' },
                }],
            }],
            [ 'normal-item', {
                templateId: 'normal-item',
                name: 'Normal Item',
                effects: [{ type: 'draw', amount: { type: 'constant', value: 1 }}],
            }],
        ]),
        supporters: new Map<string, SupporterData>([
            [ 'supporter', {
                templateId: 'supporter',
                name: 'Supporter',
                effects: [{ type: 'draw', amount: { type: 'constant', value: 2 }}],
            }],
        ]),
        tools: new Map<string, ToolData>([
            [ 'tool', {
                templateId: 'tool',
                name: 'Tool',
                effects: [{ 
                    type: 'hp-bonus', 
                    amount: { type: 'constant', value: 10 },
                    target: { player: 'self', location: 'field', position: 'active' },
                    duration: { type: 'while-in-play', instanceId: '' },
                }],
            }],
        ]),
    });

    const preventItemsSupporters = { templateId: 'prevent-items-supporters', type: 'item' as const };
    const preventCreatures = { templateId: 'prevent-creatures', type: 'item' as const };
    const preventTools = { templateId: 'prevent-tools', type: 'item' as const };
    const preventAll = { templateId: 'prevent-all', type: 'item' as const };
    const selfPreventItem = { templateId: 'self-prevent-item', type: 'item' as const };

    it('should prevent opponent from playing items (basic operation)', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [
                new PlayCardResponseMessage('prevent-item', 'item'),
                new EndTurnResponseMessage(),
                new PlayCardResponseMessage('normal-item', 'item'), // Opponent tries to play item
            ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature'),
                StateBuilder.withCreatures(1, 'high-hp-creature'),
                StateBuilder.withHand(0, [ preventItem ]),
                StateBuilder.withHand(1, [ normalItem ]),
            ),
            maxSteps: 20,
        });

        expect(getExecutedCount()).to.equal(2, 'Should have executed prevent item and end turn (item play blocked)');
        // Verify the item is still in opponent's hand
        expect(state.hand[1].some((card: { templateId: string }) => card.templateId === 'normal-item')).to.be.true;
    });

    it('should prevent opponent from playing multiple card types', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [
                new PlayCardResponseMessage('prevent-items-supporters', 'item'),
                new EndTurnResponseMessage(),
                new PlayCardResponseMessage('normal-item', 'item'), // Opponent tries to play item (blocked)
                new PlayCardResponseMessage('supporter', 'supporter'), // Opponent tries to play supporter (blocked)
            ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature'),
                StateBuilder.withCreatures(1, 'high-hp-creature'),
                StateBuilder.withHand(0, [ preventItemsSupporters ]),
                StateBuilder.withHand(1, [ normalItem, supporter ]),
            ),
            maxSteps: 25,
        });

        expect(getExecutedCount()).to.equal(2, 'Should have executed prevent item and end turn (all plays blocked)');
        // Verify cards are still in opponent's hand
        expect(state.hand[1].length).to.equal(2, 'Both cards should remain in hand');
    });

    it('should prevent opponent from playing creatures', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [
                new PlayCardResponseMessage('prevent-creatures', 'item'),
                new EndTurnResponseMessage(),
                new PlayCardResponseMessage('basic-creature', 'creature'), // Opponent tries to play creature
            ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature'),
                StateBuilder.withCreatures(1, 'high-hp-creature'),
                StateBuilder.withHand(0, [ preventCreatures ]),
                StateBuilder.withHand(1, [ basicCreature ]),
            ),
            maxSteps: 20,
        });

        expect(getExecutedCount()).to.equal(2, 'Should have executed prevent item and end turn (creature play blocked)');
        // Verify creature is still in opponent's hand
        expect(state.hand[1].some((card: { templateId: string }) => card.templateId === 'basic-creature')).to.be.true;
    });

    it('should prevent opponent from playing tools', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [
                new PlayCardResponseMessage('prevent-tools', 'item'),
                new EndTurnResponseMessage(),
                new PlayCardResponseMessage('tool', 'tool', undefined, 0), // Opponent tries to play tool
            ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature'),
                StateBuilder.withCreatures(1, 'high-hp-creature'),
                StateBuilder.withHand(0, [ preventTools ]),
                StateBuilder.withHand(1, [ tool ]),
            ),
            maxSteps: 20,
        });

        expect(getExecutedCount()).to.equal(2, 'Should have executed prevent item and end turn (tool play blocked)');
        // Verify tool is still in opponent's hand
        expect(state.hand[1].some((card: { templateId: string }) => card.templateId === 'tool')).to.be.true;
    });

    it('should prevent all card types when specified', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [
                new PlayCardResponseMessage('prevent-all', 'item'),
                new EndTurnResponseMessage(),
                new PlayCardResponseMessage('basic-creature', 'creature'), // Opponent tries to play creature
                new PlayCardResponseMessage('normal-item', 'item'), // Opponent tries to play item
                new PlayCardResponseMessage('supporter', 'supporter'), // Opponent tries to play supporter
            ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature'),
                StateBuilder.withCreatures(1, 'high-hp-creature'),
                StateBuilder.withHand(0, [ preventAll ]),
                StateBuilder.withHand(1, [ basicCreature, normalItem, supporter ]),
            ),
            maxSteps: 30,
        });

        expect(getExecutedCount()).to.equal(2, 'Should have executed prevent all and end turn (all plays blocked)');
        // Verify all cards are still in opponent's hand
        expect(state.hand[1].length).to.equal(3, 'All cards should remain in hand');
    });

    it('should target self when specified', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [
                new PlayCardResponseMessage('self-prevent-item', 'item'),
                new PlayCardResponseMessage('supporter', 'supporter'), // Try to play supporter (blocked)
            ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature'),
                StateBuilder.withCreatures(1, 'high-hp-creature'),
                StateBuilder.withHand(0, [ selfPreventItem, supporter ]),
            ),
            maxSteps: 15,
        });

        expect(getExecutedCount()).to.equal(1, 'Should have executed self-prevent item only (supporter play blocked)');
        // Verify supporter is still in own hand
        expect(state.hand[0].some((card: { templateId: string }) => card.templateId === 'supporter')).to.be.true;
    });

    it('should allow playing cards not in prevented types', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [
                new PlayCardResponseMessage('prevent-item', 'item'),
                new EndTurnResponseMessage(),
                new PlayCardResponseMessage('supporter', 'supporter'), // Opponent plays supporter (allowed)
            ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature'),
                StateBuilder.withCreatures(1, 'high-hp-creature'),
                StateBuilder.withHand(0, [ preventItem ]),
                StateBuilder.withHand(1, [ supporter ]),
            ),
            maxSteps: 20,
        });

        expect(getExecutedCount()).to.equal(3, 'Should have executed prevent item, end turn, and supporter');
        // Verify supporter was played (not in hand anymore)
        expect(state.hand[1].some((card: { templateId: string }) => card.templateId === 'supporter')).to.be.false;
    });

    it('should not prevent playing during same turn', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [
                new PlayCardResponseMessage('prevent-item', 'item'),
                new PlayCardResponseMessage('normal-item', 'item'), // Same turn play (should work)
            ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature'),
                StateBuilder.withCreatures(1, 'high-hp-creature'),
                StateBuilder.withHand(0, [ preventItem, normalItem ]),
            ),
            maxSteps: 15,
        });

        expect(getExecutedCount()).to.equal(2, 'Should have executed both items');
        // Verify both items were played
        expect(state.hand[0].length).to.equal(0, 'Both items should have been played');
    });

    it('should expire at correct time based on duration', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [
                new PlayCardResponseMessage('prevent-item', 'item'),
                new EndTurnResponseMessage(),
                new EndTurnResponseMessage(), // Opponent's turn ends (until-end-of-next-turn)
                new EndTurnResponseMessage(), // Back to player 0's turn
                new EndTurnResponseMessage(), // Player 0's turn ends
                new PlayCardResponseMessage('normal-item', 'item'), // Opponent should now be able to play
            ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature'),
                StateBuilder.withCreatures(1, 'high-hp-creature'),
                StateBuilder.withHand(0, [ preventItem ]),
                StateBuilder.withHand(1, [ normalItem ]),
            ),
            maxSteps: 30,
        });

        expect(getExecutedCount()).to.equal(6, 'Should have executed all actions including final item play');
        // Verify item was played after prevention expired
        expect(state.hand[1].some((card: { templateId: string }) => card.templateId === 'normal-item')).to.be.false;
    });

    it('should stack multiple prevent playing effects', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [
                new PlayCardResponseMessage('prevent-item', 'item'),
                new PlayCardResponseMessage('prevent-item', 'item'),
                new EndTurnResponseMessage(),
                new PlayCardResponseMessage('normal-item', 'item'), // Opponent tries to play item (blocked by multiple effects)
            ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature'),
                StateBuilder.withCreatures(1, 'high-hp-creature'),
                StateBuilder.withHand(0, [ preventItem, preventItem ]),
                StateBuilder.withHand(1, [ normalItem ]),
            ),
            maxSteps: 25,
        });

        expect(getExecutedCount()).to.equal(3, 'Should have executed both prevent items and end turn (item play blocked)');
        // Verify item is still in opponent's hand
        expect(state.hand[1].some((card: { templateId: string }) => card.templateId === 'normal-item')).to.be.true;
    });
});
