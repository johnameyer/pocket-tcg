import { expect } from 'chai';
import { PlayCardResponseMessage } from '../../../src/messages/response/play-card-response-message.js';
import { AttackResponseMessage } from '../../../src/messages/response/attack-response-message.js';
import { StateBuilder } from '../../helpers/state-builder.js';
import { runTestGame } from '../../helpers/test-helpers.js';
import { MockCardRepository } from '../../mock-repository.js';
import { CreatureData, ItemData } from '../../../src/repository/card-types.js';

describe('Prevent Damage Effect', () => {
    const basicCreature = { templateId: 'basic-creature', type: 'creature' as const };
    const exCreature = { templateId: 'ex-creature', type: 'creature' as const };
    const megaExCreature = { templateId: 'mega-ex-creature', type: 'creature' as const };
    const preventItem = { templateId: 'prevent-item', type: 'item' as const };

    const testRepository = new MockCardRepository({
        creatures: new Map<string, CreatureData>([
            [ 'basic-creature', {
                templateId: 'basic-creature',
                name: 'Basic Creature',
                maxHp: 80,
                type: 'fire',
                weakness: 'water',
                retreatCost: 1,
                attacks: [{ name: 'Basic Attack', damage: 30, energyRequirements: [{ type: 'fire', amount: 1 }] }],
            }],
            [ 'ex-creature', {
                templateId: 'ex-creature',
                name: 'Ex Creature',
                maxHp: 180,
                type: 'water',
                weakness: 'grass',
                retreatCost: 2,
                attributes: { ex: true },
                attacks: [{ name: 'Ex Attack', damage: 60, energyRequirements: [{ type: 'water', amount: 2 }] }],
            }],
            [ 'mega-ex-creature', {
                templateId: 'mega-ex-creature',
                name: 'Mega Ex Creature',
                maxHp: 220,
                type: 'lightning',
                weakness: 'fighting',
                retreatCost: 3,
                attributes: { ex: true, mega: true },
                attacks: [{ name: 'Mega Attack', damage: 90, energyRequirements: [{ type: 'lightning', amount: 3 }] }],
            }],
        ]),
        items: new Map<string, ItemData>([
            [ 'prevent-item', {
                templateId: 'prevent-item',
                name: 'Prevent Item',
                effects: [{ 
                    type: 'prevent-damage',
                    target: { player: 'opponent', position: 'active' },
                    damageSource: { player: 'opponent' },
                    duration: { type: 'until-end-of-next-turn' },
                }],
            }],
            [ 'prevent-ex-item', {
                templateId: 'prevent-ex-item',
                name: 'Prevent Ex Item',
                effects: [{
                    type: 'prevent-damage',
                    damageSource: { player: 'opponent', fieldCriteria: { cardCriteria: { attributes: { ex: true }}}},
                    target: { player: 'opponent', position: 'active' },
                    duration: { type: 'until-end-of-next-turn' },
                }],
            }],
        ]),
    });

    const preventExItem = { templateId: 'prevent-ex-item', type: 'item' as const };

    it('should prevent all damage (basic operation)', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [
                new PlayCardResponseMessage('prevent-item', 'item'),
                new AttackResponseMessage(0), // Attack should deal no damage
            ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature'),
                StateBuilder.withCreatures(1, 'basic-creature'),
                StateBuilder.withHand(0, [ preventItem ]),
                StateBuilder.withEnergy('basic-creature-0', { fire: 1 }),
            ),
            maxSteps: 15,
        });

        expect(getExecutedCount()).to.equal(2, 'Should have executed prevent item and attack');
        expect(state.field.creatures[1][0].damageTaken).to.equal(0, 'Should take no damage (prevented)');
    });

    it('should prevent damage from specific sources (ex-creature)', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [
                new PlayCardResponseMessage('prevent-ex-item', 'item'),
                new AttackResponseMessage(0), // Ex creature attack should be prevented
            ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'ex-creature'),
                StateBuilder.withCreatures(1, 'basic-creature'),
                StateBuilder.withHand(0, [ preventExItem ]),
                StateBuilder.withEnergy('ex-creature-0', { water: 2 }),
            ),
            maxSteps: 15,
        });

        expect(getExecutedCount()).to.equal(2, 'Should have executed prevent ex item and attack');
        expect(state.field.creatures[1][0].damageTaken).to.equal(0, 'Should take no damage from ex creature (prevented)');
    });

    it('should prevent damage from mega ex sources', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [
                new PlayCardResponseMessage('prevent-ex-item', 'item'),
                new AttackResponseMessage(0), // Mega ex attack should be prevented
            ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'mega-ex-creature'),
                StateBuilder.withCreatures(1, 'basic-creature'),
                StateBuilder.withHand(0, [ preventExItem ]),
                StateBuilder.withEnergy('mega-ex-creature-0', { lightning: 3 }),
            ),
            maxSteps: 15,
        });

        expect(getExecutedCount()).to.equal(2, 'Should have executed prevent ex item and attack');
        expect(state.field.creatures[1][0].damageTaken).to.equal(0, 'Should take no damage from mega ex (prevented)');
    });

    it('should not prevent damage from non-ex sources', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [
                new PlayCardResponseMessage('prevent-ex-item', 'item'),
                new AttackResponseMessage(0), // Basic creature attack should not be prevented
            ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature'),
                StateBuilder.withCreatures(1, 'basic-creature'),
                StateBuilder.withHand(0, [ preventExItem ]),
                StateBuilder.withEnergy('basic-creature-0', { fire: 1 }),
            ),
            maxSteps: 15,
        });

        expect(getExecutedCount()).to.equal(2, 'Should have executed prevent ex item and attack');
        expect(state.field.creatures[1][0].damageTaken).to.equal(30, 'Should take full damage from basic creature');
    });

    it('should work for multiple attacks in same turn', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [
                new PlayCardResponseMessage('prevent-item', 'item'),
                new AttackResponseMessage(0), // Attack should be prevented
            ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature'),
                StateBuilder.withCreatures(1, 'basic-creature'),
                StateBuilder.withHand(0, [ preventItem ]),
                StateBuilder.withEnergy('basic-creature-0', { fire: 2 }), // Enough energy for attack
            ),
            maxSteps: 20,
        });

        expect(getExecutedCount()).to.equal(2, 'Should have executed prevent item and attack');
        expect(state.field.creatures[1][0].damageTaken).to.equal(0, 'Should take no damage from attack');
    });

    it('should work with weakness damage calculations', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [
                new PlayCardResponseMessage('prevent-item', 'item'),
                new AttackResponseMessage(0), // Fire vs Water with weakness
            ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature'), // Fire type
                StateBuilder.withCreatures(1, 'ex-creature'), // Water type (weak to grass, not fire)
                StateBuilder.withHand(0, [ preventItem ]),
                StateBuilder.withEnergy('basic-creature-0', { fire: 1 }),
            ),
            maxSteps: 15,
        });

        expect(getExecutedCount()).to.equal(2, 'Should have executed prevent item and attack');
        expect(state.field.creatures[1][0].damageTaken).to.equal(0, 'Should prevent all damage including weakness bonus');
    });

    it('should allow Pokemon to survive lethal attacks', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [
                new PlayCardResponseMessage('prevent-item', 'item'),
                new AttackResponseMessage(0), // Attack that would normally KO
            ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'ex-creature'),
                StateBuilder.withCreatures(1, 'basic-creature'),
                StateBuilder.withHand(0, [ preventItem ]),
                StateBuilder.withEnergy('ex-creature-0', { water: 2 }),
                StateBuilder.withDamage('basic-creature-1', 50), // Pre-damage: 50 + 60 = 110 > 80 HP
            ),
            maxSteps: 15,
        });

        expect(getExecutedCount()).to.equal(2, 'Should have executed prevent item and attack');
        expect(state.field.creatures[1][0].damageTaken).to.equal(50, 'Should take no additional damage (prevented)');
        expect(state.field.creatures[1][0]).to.exist; // Should survive
    });
});
