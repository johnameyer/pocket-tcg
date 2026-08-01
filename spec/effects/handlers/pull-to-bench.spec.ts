import { expect } from 'chai';
import { StateBuilder } from '../../helpers/state-builder.js';
import { runTestGame } from '../../helpers/test-helpers.js';
import { MockCardRepository } from '../../mock-repository.js';
import { AttackResponseMessage } from '../../../src/messages/response/attack-response-message.js';

const testRepository = new MockCardRepository({
    creatures: {
        'basic-creature': {
            templateId: 'basic-creature',
            name: 'Basic Creature',
            maxHp: 70,
            type: 'colorless',
            weakness: 'fighting',
            retreatCost: 1,
            attacks: [{ name: 'Basic Attack', damage: 20, energyRequirements: [] }],
        },
        'bench-puller': {
            templateId: 'bench-puller',
            name: 'Bench Puller',
            maxHp: 80,
            type: 'colorless',
            weakness: 'fighting',
            retreatCost: 1,
            attacks: [
                {
                    name: 'Call for Family',
                    damage: 0,
                    energyRequirements: [],
                    effects: [
                        { type: 'pull-to-bench', criteria: { name: [ 'Bench Puller' ] }, count: 1 },
                    ],
                },
            ],
        },
        'multi-bench-puller': {
            templateId: 'multi-bench-puller',
            name: 'Multi Bench Puller',
            maxHp: 80,
            type: 'colorless',
            weakness: 'fighting',
            retreatCost: 1,
            attacks: [
                {
                    name: 'Cocoon Collector',
                    damage: 0,
                    energyRequirements: [],
                    effects: [
                        { type: 'pull-to-bench', criteria: { name: [ 'Multi Bench Puller', 'Bench Puller' ] }, count: 3 },
                    ],
                },
            ],
        },
        'basic-puller': {
            templateId: 'basic-puller',
            name: 'Basic Puller',
            maxHp: 70,
            type: 'colorless',
            weakness: 'fighting',
            retreatCost: 1,
            attacks: [
                {
                    name: 'Cheerful Singing',
                    damage: 0,
                    energyRequirements: [],
                    effects: [
                        { type: 'pull-to-bench', criteria: { stage: 0 }, count: 1 },
                    ],
                },
            ],
        },
        'stage1-creature': {
            templateId: 'stage1-creature',
            name: 'Stage 1 Creature',
            maxHp: 90,
            type: 'colorless',
            weakness: 'fighting',
            retreatCost: 1,
            previousStageName: 'Basic Creature',
            attacks: [{ name: 'Stomp', damage: 30, energyRequirements: [] }],
        },
    },
});

const c = (templateId: string) => ({ templateId });

describe('Bench From Deck Effect', () => {
    it('should place a matching creature from deck onto the bench', () => {
        const { state } = runTestGame({
            actions: [ new AttackResponseMessage(0) ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'bench-puller'),
                StateBuilder.withCreatures(1, 'basic-creature'),
                StateBuilder.withDeck(0, [ c('bench-puller'), c('bench-puller'), c('basic-creature') ]),
            ),
        });

        expect(state.field.creatures[0].length).to.equal(2, 'One creature should have been benched');
        expect(state.field.creatures[0][1].evolutionStack[0].templateId).to.equal('bench-puller');
    });

    it('should do nothing when no matching creatures exist in deck', () => {
        const { state } = runTestGame({
            actions: [ new AttackResponseMessage(0) ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'bench-puller'),
                StateBuilder.withCreatures(1, 'basic-creature'),
                StateBuilder.withDeck(0, [ c('basic-creature'), c('basic-creature') ]),
            ),
        });

        expect(state.field.creatures[0].length).to.equal(1, 'No creature should have been benched');
    });

    it('should place up to count creatures from matching pool', () => {
        const { state } = runTestGame({
            actions: [ new AttackResponseMessage(0) ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'multi-bench-puller'),
                StateBuilder.withCreatures(1, 'basic-creature'),
                StateBuilder.withDeck(0, [
                    c('multi-bench-puller'),
                    c('bench-puller'),
                    c('multi-bench-puller'),
                    c('basic-creature'),
                ]),
            ),
        });

        expect(state.field.creatures[0].length).to.equal(4, 'Should have placed 3 creatures on bench');
    });

    it('should not exceed bench capacity', () => {
        const { state } = runTestGame({
            actions: [ new AttackResponseMessage(0) ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'multi-bench-puller', [ 'bench-puller', 'bench-puller', 'bench-puller' ]),
                StateBuilder.withCreatures(1, 'basic-creature'),
                StateBuilder.withDeck(0, [ c('multi-bench-puller'), c('bench-puller'), c('bench-puller') ]),
            ),
        });

        expect(state.field.creatures[0].length).to.equal(4, 'Bench should not exceed 4 total');
    });

    it('should filter by stage — only place basic creatures', () => {
        const { state } = runTestGame({
            actions: [ new AttackResponseMessage(0) ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-puller'),
                StateBuilder.withCreatures(1, 'basic-creature'),
                StateBuilder.withDeck(0, [ c('stage1-creature'), c('basic-creature'), c('stage1-creature') ]),
            ),
        });

        expect(state.field.creatures[0].length).to.equal(2, 'One basic creature should have been benched');
        expect(state.field.creatures[0][1].evolutionStack[0].templateId).to.equal('basic-creature');
    });

    it('should remove the placed card from the deck', () => {
        const { state } = runTestGame({
            actions: [ new AttackResponseMessage(0) ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'bench-puller'),
                StateBuilder.withCreatures(1, 'basic-creature'),
                StateBuilder.withDeck(0, [ c('bench-puller'), c('basic-creature') ]),
            ),
        });

        expect(state.deck[0].length).to.equal(1, 'Deck should shrink by 1');
    });
});
