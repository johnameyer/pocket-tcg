import { expect } from 'chai';
import { PlayCardResponseMessage } from '../../../src/messages/response/play-card-response-message.js';
import { RetreatResponseMessage } from '../../../src/messages/response/retreat-response-message.js';
import { EndTurnResponseMessage } from '../../../src/messages/response/end-turn-response-message.js';
import { StateBuilder } from '../../helpers/state-builder.js';
import { runTestGame } from '../../helpers/test-helpers.js';
import { MockCardRepository } from '../../mock-repository.js';
import { CreatureData, ItemData } from '../../../src/repository/card-types.js';
import { getCurrentTemplateId } from '../../../src/utils/field-card-utils.js';
import { RetreatCostModificationEffectHandler } from '../../../src/effects/handlers/retreat-cost-modification-effect-handler.js';
import { RetreatCostModificationEffect } from '../../../src/repository/effect-types.js';

describe('Retreat Cost Modification Effect', () => {
    describe('getResolutionRequirements', () => {
        const handler = new RetreatCostModificationEffectHandler();

        it('should return empty array for increase (no resolution needed)', () => {
            const effect: RetreatCostModificationEffect = {
                type: 'retreat-cost-modification', operation: 'increase',
                amount: { type: 'constant', value: 1 },
                target: { player: 'opponent', location: 'field' },
                duration: { type: 'until-end-of-turn' },
            };

            const result = handler.getResolutionRequirements(effect);
            
            expect(result).to.be.an('array').that.is.empty;
        });

        it('should return empty array for reduction (no resolution needed)', () => {
            const effect: RetreatCostModificationEffect = {
                type: 'retreat-cost-modification', operation: 'decrease',
                amount: { type: 'constant', value: 1 },
                target: { player: 'self', location: 'field' },
                duration: { type: 'until-end-of-turn' },
            };

            const result = handler.getResolutionRequirements(effect);
            
            expect(result).to.be.an('array').that.is.empty;
        });
    });

    const lowCostCreature = { templateId: 'low-cost-creature', type: 'creature' as const };
    const highCostCreature = { templateId: 'high-cost-creature', type: 'creature' as const };
    const increaseItem = { templateId: 'increase-item', type: 'item' as const };

    const testRepository = new MockCardRepository({
        creatures: new Map<string, CreatureData>([
            [ 'low-cost-creature', {
                templateId: 'low-cost-creature',
                name: 'Low Cost Creature',
                maxHp: 80,
                type: 'fire',
                weakness: 'water',
                retreatCost: 1,
                attacks: [{ name: 'Basic Attack', damage: 20, energyRequirements: [{ type: 'fire', amount: 1 }] }],
            }],
            [ 'high-cost-creature', {
                templateId: 'high-cost-creature',
                name: 'High Cost Creature',
                maxHp: 180,
                type: 'water',
                weakness: 'grass',
                retreatCost: 3,
                attacks: [{ name: 'Water Attack', damage: 30, energyRequirements: [{ type: 'water', amount: 2 }] }],
            }],
            [ 'zero-cost-creature', {
                templateId: 'zero-cost-creature',
                name: 'Zero Cost Creature',
                maxHp: 60,
                type: 'psychic',
                weakness: 'darkness',
                retreatCost: 0,
                attacks: [{ name: 'Psychic Attack', damage: 15, energyRequirements: [{ type: 'psychic', amount: 1 }] }],
            }],
        ]),
        items: new Map<string, ItemData>([
            [ 'increase-item', {
                templateId: 'increase-item',
                name: 'Increase Retreat Item',
                effects: [{
                    type: 'retreat-cost-modification', operation: 'increase',
                    amount: { type: 'constant', value: 1 },
                    target: { player: 'opponent', location: 'field' },
                    duration: { type: 'until-end-of-next-turn' },
                }],
            }],
            [ 'increase-by-two', {
                templateId: 'increase-by-two',
                name: 'Increase Retreat By Two',
                effects: [{
                    type: 'retreat-cost-modification', operation: 'increase',
                    amount: { type: 'constant', value: 2 },
                    target: { player: 'opponent', location: 'field' },
                    duration: { type: 'until-end-of-next-turn' },
                }],
            }],
            [ 'increase-active', {
                templateId: 'increase-active',
                name: 'Increase Active Retreat',
                effects: [{
                    type: 'retreat-cost-modification', operation: 'increase',
                    amount: { type: 'constant', value: 1 },
                    target: { player: 'opponent', location: 'field', position: 'active' },
                    duration: { type: 'until-end-of-next-turn' },
                }],
            }],
            [ 'increase-bench', {
                templateId: 'increase-bench',
                name: 'Increase Bench Retreat',
                effects: [{
                    type: 'retreat-cost-modification', operation: 'increase',
                    amount: { type: 'constant', value: 1 },
                    target: { player: 'opponent', location: 'field', position: 'bench' },
                    duration: { type: 'until-end-of-next-turn' },
                }],
            }],
            [ 'increase-self', {
                templateId: 'increase-self',
                name: 'Increase Self Retreat',
                effects: [{
                    type: 'retreat-cost-modification', operation: 'increase',
                    amount: { type: 'constant', value: 1 },
                    target: { player: 'self', location: 'field' },
                    duration: { type: 'until-end-of-next-turn' },
                }],
            }],
            [ 'reduce-item', {
                templateId: 'reduce-item',
                name: 'Reduce Retreat Item',
                effects: [{
                    type: 'retreat-cost-modification', operation: 'decrease',
                    amount: { type: 'constant', value: 1 },
                    target: { player: 'self', location: 'field' },
                    duration: { type: 'until-end-of-turn' },
                }],
            }],
            [ 'reduce-active', {
                templateId: 'reduce-active',
                name: 'Reduce Active Retreat',
                effects: [{
                    type: 'retreat-cost-modification', operation: 'decrease',
                    amount: { type: 'constant', value: 1 },
                    target: { player: 'self', location: 'field', position: 'active' },
                    duration: { type: 'until-end-of-turn' },
                }],
            }],
        ]),
    });

    const zeroCostCreature = { templateId: 'zero-cost-creature', type: 'creature' as const };
    const increaseByTwo = { templateId: 'increase-by-two', type: 'item' as const };
    const increaseActive = { templateId: 'increase-active', type: 'item' as const };
    const increaseBench = { templateId: 'increase-bench', type: 'item' as const };
    const increaseSelf = { templateId: 'increase-self', type: 'item' as const };
    const reduceItem = { templateId: 'reduce-item', type: 'item' as const };
    const reduceActive = { templateId: 'reduce-active', type: 'item' as const };

    it('should increase retreat cost by 1 (basic operation)', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [
                new PlayCardResponseMessage('increase-item', 'item'),
                new EndTurnResponseMessage(),
                new RetreatResponseMessage(0), // Opponent tries to retreat (needs 2 energy now instead of 1)
            ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'low-cost-creature'),
                StateBuilder.withCreatures(1, 'low-cost-creature', [ 'high-cost-creature' ]), // Add bench
                StateBuilder.withHand(0, [ increaseItem ]),
                StateBuilder.withEnergy('low-cost-creature-1', { fire: 1 }), // Only 1 energy, needs 2
            ),
        });

        // Verify creature didn't retreat
        expect(getCurrentTemplateId(state.field.creatures[1][0])).to.equal('low-cost-creature', 'Should not have retreated (cost increased)');
    });


    it('should allow retreat with sufficient energy after increase', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [
                new PlayCardResponseMessage('increase-item', 'item'),
                new EndTurnResponseMessage(),
                new RetreatResponseMessage(0), // Opponent retreats with enough energy
            ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'low-cost-creature'),
                StateBuilder.withCreatures(1, 'low-cost-creature', [ 'high-cost-creature' ]), // Add bench
                StateBuilder.withHand(0, [ increaseItem ]),
                StateBuilder.withEnergy('low-cost-creature-1', { fire: 2 }), // Has 2 energy to retreat
            ),
        });

        // Verify creature retreated successfully
        expect(getCurrentTemplateId(state.field.creatures[1][0])).to.equal('high-cost-creature', 'Should have retreated (had enough energy)');
    });

    it('should increase retreat cost by 2', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [
                new PlayCardResponseMessage('increase-by-two', 'item'),
                new EndTurnResponseMessage(),
                new RetreatResponseMessage(0), // Opponent tries to retreat (needs 3 energy now instead of 1)
            ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'low-cost-creature'),
                StateBuilder.withCreatures(1, 'low-cost-creature', [ 'high-cost-creature' ]), // Retreat cost 1, becomes 3
                StateBuilder.withHand(0, [ increaseByTwo ]),
                StateBuilder.withEnergy('low-cost-creature-1', { fire: 2 }), // Only 2 energy, needs 3
            ),
        });

        // Verify creature didn't retreat
        expect(getCurrentTemplateId(state.field.creatures[1][0])).to.equal('low-cost-creature', 'Should not have retreated (cost increased by 2)');
    });

    it('should increase zero retreat cost to one', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [
                new PlayCardResponseMessage('increase-item', 'item'),
                new EndTurnResponseMessage(),
                new RetreatResponseMessage(0), // Opponent tries to retreat (needs 1 energy now instead of 0)
            ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'low-cost-creature'),
                StateBuilder.withCreatures(1, 'zero-cost-creature', [ 'high-cost-creature' ]), // Add bench creature
                StateBuilder.withHand(0, [ increaseItem ]),
                // No energy attached
            ),
        });

        // Verify creature didn't retreat
        expect(getCurrentTemplateId(state.field.creatures[1][0])).to.equal('zero-cost-creature', 'Should not have retreated (cost increased from 0 to 1)');
    });

    it('should increase only active creature when targeted', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [
                new PlayCardResponseMessage('increase-active', 'item'),
                new EndTurnResponseMessage(),
                new RetreatResponseMessage(0), // Opponent tries to retreat active
            ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'low-cost-creature'),
                StateBuilder.withCreatures(1, 'low-cost-creature', [ 'high-cost-creature' ]), // Active with retreat cost 1, becomes 2
                StateBuilder.withHand(0, [ increaseActive ]),
                StateBuilder.withEnergy('low-cost-creature-1', { fire: 1 }), // Only 1 energy
            ),
        });

        // Verify active didn't retreat
        expect(getCurrentTemplateId(state.field.creatures[1][0])).to.equal('low-cost-creature', 'Active should not have retreated');
    });

    it('should increase only bench creatures when targeted', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [
                new PlayCardResponseMessage('increase-bench', 'item'),
                new EndTurnResponseMessage(),
                new RetreatResponseMessage(0), // Opponent retreats active (not affected by bench increase)
            ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'low-cost-creature'),
                StateBuilder.withCreatures(1, 'low-cost-creature', [ 'high-cost-creature' ]), // Active cost 1, bench cost 2
                StateBuilder.withHand(0, [ increaseBench ]),
                StateBuilder.withEnergy('low-cost-creature-1', { fire: 1 }), // Enough for active (cost 1)
            ),
        });

        // Active retreated because bench targeting doesn't affect active retreat cost
        expect(getCurrentTemplateId(state.field.creatures[1][0])).to.equal('high-cost-creature');
    });

    it('should increase self retreat cost when targeted', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [
                new PlayCardResponseMessage('increase-self', 'item'),
                new RetreatResponseMessage(0), // Try to retreat own active (cost increased same turn)
            ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'low-cost-creature', [ 'high-cost-creature' ]), // Cost 1, increased to 2
                StateBuilder.withCreatures(1, 'low-cost-creature'),
                StateBuilder.withHand(0, [ increaseSelf ]),
                StateBuilder.withEnergy('low-cost-creature-0', { fire: 1 }), // Only 1 energy, need 2
            ),
        });

        // Own creature didn't retreat because cost increased same-turn (need 2 energy, have 1)
        expect(getCurrentTemplateId(state.field.creatures[0][0])).to.equal('low-cost-creature');
    });

    it('should increase own retreat cost immediately (same turn)', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [
                new PlayCardResponseMessage('increase-self', 'item'),
                new RetreatResponseMessage(0), // Same turn retreat after increase-self
            ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'low-cost-creature', [ 'high-cost-creature' ]),
                StateBuilder.withCreatures(1, 'low-cost-creature'),
                StateBuilder.withHand(0, [ increaseSelf ]),
                StateBuilder.withEnergy('low-cost-creature-0', { fire: 1 }), // Only 1 energy, need 2 after increase
            ),
        });

        // Retreat blocked: increase-self targets self's active (cost 1 → 2), effect applies same-turn
        expect(getCurrentTemplateId(state.field.creatures[0][0])).to.equal('low-cost-creature', 'Retreat blocked by same-turn increase');
    });

    it('should expire at correct time based on duration', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [
                // Turn 2: P0 plays increase-item (duration: until-end-of-next-turn, valid through turn 3)
                new PlayCardResponseMessage('increase-item', 'item'),
                new EndTurnResponseMessage(), // P0 ends, turn becomes 3
                
                // Turn 3: P1's turn, effect still active, retreat cost increased
                new EndTurnResponseMessage(), // P1 ends, turn becomes 4, effect expires
                
                // Turn 4: P0's turn
                new EndTurnResponseMessage(), // P0 ends, turn becomes 5
                
                // Turn 5: P1's turn, effect expired, can retreat with 1 energy
                new RetreatResponseMessage(0),
            ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'low-cost-creature'),
                StateBuilder.withCreatures(1, 'low-cost-creature', [ 'high-cost-creature' ]),
                StateBuilder.withHand(0, [ increaseItem ]),
                StateBuilder.withEnergy('low-cost-creature-1', { fire: 1 }), // 1 energy (enough after expiration)
            ),
        });

        // Verify retreat worked after increase expired
        expect(getCurrentTemplateId(state.field.creatures[1][0])).to.equal('high-cost-creature', 'Should have retreated after increase expired');
    });

    it('should stack multiple retreat cost increases', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [
                new PlayCardResponseMessage('increase-item', 'item'),
                new PlayCardResponseMessage('increase-item', 'item'),
                new EndTurnResponseMessage(),
                new RetreatResponseMessage(0), // Opponent tries to retreat (needs 3 energy now)
            ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'low-cost-creature'),
                StateBuilder.withCreatures(1, 'low-cost-creature', [ 'high-cost-creature' ]), // Retreat cost 1, becomes 3 (1 + 1 + 1)
                StateBuilder.withHand(0, [ increaseItem, increaseItem ]),
                StateBuilder.withEnergy('low-cost-creature-1', { fire: 2 }), // Only 2 energy, needs 3
            ),
        });

        // Verify creature didn't retreat
        expect(getCurrentTemplateId(state.field.creatures[1][0])).to.equal('low-cost-creature', 'Should not have retreated (cost increased by stacked effects)');
    });

    it('should increase already high retreat costs', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [
                new PlayCardResponseMessage('increase-item', 'item'),
                new EndTurnResponseMessage(),
                new RetreatResponseMessage(0), // Opponent tries to retreat (needs 4 energy now)
            ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'low-cost-creature'),
                StateBuilder.withCreatures(1, 'high-cost-creature', [ 'low-cost-creature' ]), // Retreat cost 3, becomes 4
                StateBuilder.withHand(0, [ increaseItem ]),
                StateBuilder.withEnergy('high-cost-creature-1', { water: 3 }), // Only 3 energy, needs 4
            ),
        });

        // Verify creature didn't retreat
        expect(getCurrentTemplateId(state.field.creatures[1][0])).to.equal('high-cost-creature', 'Should not have retreated (high cost increased further)');
    });

    describe('Retreat Cost Reduction', () => {
        it('should reduce retreat cost by 1 (basic operation)', () => {
            const { state, getExecutedCount } = runTestGame({
                actions: [
                    new PlayCardResponseMessage('reduce-item', 'item'),
                    new RetreatResponseMessage(0), // Retreat with cost reduction
                ],
                customRepository: testRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'high-cost-creature', [ 'low-cost-creature' ]),
                    StateBuilder.withEnergy('high-cost-creature-0', { water: 2 }), // Normal cost 3, reduced to 2
                    StateBuilder.withHand(0, [ reduceItem ]),
                ),
            });

            expect(getExecutedCount()).to.equal(2, 'Should have played item and retreated');
            expect(getCurrentTemplateId(state.field.creatures[0][0])).to.equal('low-cost-creature', 'Low cost creature should be active after retreat');
        });

        it('should reduce active creature cost when targeted', () => {
            const { state, getExecutedCount } = runTestGame({
                actions: [
                    new PlayCardResponseMessage('reduce-active', 'item'),
                    new RetreatResponseMessage(0), // Retreat with cost reduction
                ],
                customRepository: testRepository,
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'high-cost-creature', [ 'low-cost-creature' ]),
                    StateBuilder.withEnergy('high-cost-creature-0', { water: 2 }), // Cost reduced to 2
                    StateBuilder.withHand(0, [ reduceActive ]),
                ),
            });

            expect(getExecutedCount()).to.equal(2, 'Should have played item and retreated');
            expect(getCurrentTemplateId(state.field.creatures[0][0])).to.equal('low-cost-creature', 'Should have retreated with targeted reduction');
        });
    });
});
