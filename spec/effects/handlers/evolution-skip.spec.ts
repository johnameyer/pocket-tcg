import { expect } from 'chai';
import { PlayCardResponseMessage } from '../../../src/messages/response/play-card-response-message.js';
import { SelectTargetResponseMessage } from '../../../src/messages/response/select-target-response-message.js';
import { SelectCardResponseMessage } from '../../../src/messages/response/select-card-response-message.js';
import { StateBuilder } from '../../helpers/state-builder.js';
import { runTestGame } from '../../helpers/test-helpers.js';
import { MockCardRepository } from '../../mock-repository.js';
import { getCurrentTemplateId } from '../../../src/utils/field-card-utils.js';
import { EvolutionSkipEffect } from '../../../src/repository/effect-types.js';

describe('Evolution Skip Effect', () => {
    const stage2A = { templateId: 'stage2-creature-a', type: 'creature' as const };
    const stage2B = { templateId: 'stage2-creature-b', type: 'creature' as const };
    const evolutionSkipItem = { templateId: 'evolution-skip-item', type: 'item' as const };

    const fieldBase: EvolutionSkipEffect['fieldBase'] = {
        type: 'single-choice',
        chooser: 'self',
        criteria: { player: 'self', location: 'field' },
    };
    const handEvolution: EvolutionSkipEffect['handEvolution'] = {
        type: 'single-choice',
        chooser: 'self',
        criteria: { location: 'hand', cardType: 'creature' },
    };

    const testRepository = new MockCardRepository({
        creatures: {
            'basic-creature-a': {
                templateId: 'basic-creature-a',
                name: 'Basic Creature A',
                maxHp: 60,
                type: 'fire',
                weakness: 'water',
                retreatCost: 1,
                attacks: [{ name: 'Basic Attack', damage: 20, energyRequirements: [{ type: 'fire', amount: 1 }] }],
            },
            'stage1-creature-a': {
                templateId: 'stage1-creature-a',
                name: 'Stage 1 Creature A',
                maxHp: 90,
                type: 'fire',
                weakness: 'water',
                retreatCost: 2,
                previousStageName: 'Basic Creature A',
                attacks: [{ name: 'Stage 1 Attack', damage: 40, energyRequirements: [{ type: 'fire', amount: 2 }] }],
            },
            'stage2-creature-a': {
                templateId: 'stage2-creature-a',
                name: 'Stage 2 Creature A',
                maxHp: 140,
                type: 'fire',
                weakness: 'water',
                retreatCost: 3,
                previousStageName: 'Stage 1 Creature A',
                attacks: [{ name: 'Stage 2 Attack', damage: 80, energyRequirements: [{ type: 'fire', amount: 3 }] }],
            },
            'basic-creature-b': {
                templateId: 'basic-creature-b',
                name: 'Basic Creature B',
                maxHp: 50,
                type: 'water',
                weakness: 'lightning',
                retreatCost: 1,
                attacks: [{ name: 'Splash', damage: 10, energyRequirements: [{ type: 'water', amount: 1 }] }],
            },
            'stage1-creature-b': {
                templateId: 'stage1-creature-b',
                name: 'Stage 1 Creature B',
                maxHp: 80,
                type: 'water',
                weakness: 'lightning',
                retreatCost: 2,
                previousStageName: 'Basic Creature B',
                attacks: [{ name: 'Wave', damage: 30, energyRequirements: [{ type: 'water', amount: 2 }] }],
            },
            'stage2-creature-b': {
                templateId: 'stage2-creature-b',
                name: 'Stage 2 Creature B',
                maxHp: 130,
                type: 'water',
                weakness: 'lightning',
                retreatCost: 3,
                previousStageName: 'Stage 1 Creature B',
                attacks: [{ name: 'Tsunami', damage: 70, energyRequirements: [{ type: 'water', amount: 3 }] }],
            },
        },
        items: {
            'evolution-skip-item': {
                templateId: 'evolution-skip-item',
                name: 'Evolution Skip Item',
                effects: [{ type: 'evolution-skip', fieldBase, handEvolution }],
            },
        },
    });

    it('auto-resolves both targets when there is exactly one basic on field and exactly one matching Stage 2 in hand', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [
                new PlayCardResponseMessage('evolution-skip-item', 'item'),
            ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature-a'),
                StateBuilder.withHand(0, [ evolutionSkipItem, stage2A ]),
            ),
        });

        expect(getExecutedCount()).to.equal(1, 'Should have executed evolution skip item');
        expect(getCurrentTemplateId(state.field.creatures[0][0])).to.equal('stage2-creature-a', 'Should have evolved directly to stage 2');
        expect(state.hand[0].length).to.equal(0, 'Stage 2 card should be removed from hand, item consumed');
    });

    it('only offers the field creature that has a matching Stage 2 in hand', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [
                new PlayCardResponseMessage('evolution-skip-item', 'item'),
                // Only basic-creature-b has a matching Stage 2 in hand, so fieldBase auto-resolves to it - no selection needed
            ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature-a', [ 'basic-creature-b' ]),
                StateBuilder.withHand(0, [ evolutionSkipItem, stage2B ]),
            ),
        });

        expect(getExecutedCount()).to.equal(1, 'Should have executed evolution skip item');
        expect(getCurrentTemplateId(state.field.creatures[0][0])).to.equal('basic-creature-a', 'Active (no valid hand match) should be untouched');
        expect(getCurrentTemplateId(state.field.creatures[0][1])).to.equal('stage2-creature-b', 'Bench creature with the matching Stage 2 should have evolved');
        expect(state.hand[0].length).to.equal(0, 'Stage 2 card should be removed from hand, item consumed');
    });

    it('requires an explicit field selection when multiple field creatures each have a matching Stage 2 in hand', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [
                new PlayCardResponseMessage('evolution-skip-item', 'item'),
                new SelectTargetResponseMessage([{ playerId: 0, fieldIndex: 1 }]), // Choose the benched basic-creature-b
            ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature-a', [ 'basic-creature-b' ]),
                StateBuilder.withHand(0, [ evolutionSkipItem, stage2A, stage2B ]),
            ),
        });

        expect(getExecutedCount()).to.equal(2, 'Should have executed evolution skip item and resolved the selection');
        expect(getCurrentTemplateId(state.field.creatures[0][0])).to.equal('basic-creature-a', 'Active creature should be untouched (not selected)');
        expect(getCurrentTemplateId(state.field.creatures[0][1])).to.equal('stage2-creature-b', 'Selected bench creature should have evolved to its matching Stage 2');
        expect(state.hand[0].length).to.equal(1, 'Only the matching stage2-creature-b should be removed from hand');
        expect(state.hand[0][0].templateId).to.equal('stage2-creature-a', 'Non-matching stage2-creature-a should remain in hand');
    });

    it('requires an explicit hand selection when the chosen creature has 2+ matching Stage 2 cards in hand', () => {
        const secondStage2A = { templateId: 'stage2-creature-a', type: 'creature' as const };

        const { state, getExecutedCount } = runTestGame({
            actions: [
                new PlayCardResponseMessage('evolution-skip-item', 'item'),
                // fieldBase auto-resolves (only one basic on field); handEvolution requires a choice between two copies
                new SelectCardResponseMessage([ 'stage2-creature-a' ]),
            ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature-a'),
                StateBuilder.withHand(0, [ evolutionSkipItem, stage2A, secondStage2A ]),
            ),
        });

        expect(getExecutedCount()).to.equal(2, 'Should have executed evolution skip item and resolved the card selection');
        expect(getCurrentTemplateId(state.field.creatures[0][0])).to.equal('stage2-creature-a', 'Should have evolved directly to stage 2');
        expect(state.hand[0].length).to.equal(1, 'One copy of stage2-creature-a should remain in hand after consuming the other');
    });

    it('cannot be played when there is no valid Basic + Stage 2 combination anywhere', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [
                new PlayCardResponseMessage('evolution-skip-item', 'item'), // No matching Stage 2 in hand
            ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature-a'),
                StateBuilder.withHand(0, [ evolutionSkipItem ]),
            ),
        });

        expect(getExecutedCount()).to.equal(0, 'Should not have executed evolution skip item (canApply failed)');
        expect(getCurrentTemplateId(state.field.creatures[0][0])).to.equal('basic-creature-a', 'Should remain as basic creature');
        expect(state.hand[0].length).to.equal(1, 'Evolution skip item should remain in hand');
    });

    it('cannot be played when the only creature on field already evolved past Basic', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [
                new PlayCardResponseMessage('evolution-skip-item', 'item'), // Already Stage 1 - not a Basic creature
            ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'stage1-creature-a'),
                StateBuilder.withHand(0, [ evolutionSkipItem, stage2A ]),
            ),
        });

        expect(getExecutedCount()).to.equal(0, 'Should not have executed evolution skip item (blocked by validation)');
        expect(getCurrentTemplateId(state.field.creatures[0][0])).to.equal('stage1-creature-a', 'Should remain as stage 1');
        expect(state.hand[0].length).to.equal(2, 'Cards should remain in hand (card not playable)');
    });
});
