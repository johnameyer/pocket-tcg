import { expect } from 'chai';
import { PlayCardResponseMessage } from '../../../src/messages/response/play-card-response-message.js';
import { RetreatResponseMessage } from '../../../src/messages/response/retreat-response-message.js';
import { EndTurnResponseMessage } from '../../../src/messages/response/end-turn-response-message.js';
import { StateBuilder } from '../../helpers/state-builder.js';
import { runTestGame } from '../../helpers/test-helpers.js';
import { MockCardRepository } from '../../mock-repository.js';
import { CreatureData, ItemData } from '../../../src/repository/card-types.js';
import { getCurrentTemplateId } from '../../../src/utils/field-card-utils.js';
import { RetreatCostIncreaseEffectHandler } from '../../../src/effects/handlers/retreat-cost-increase-effect-handler.js';
import { RetreatCostIncreaseEffect } from '../../../src/repository/effect-types.js';

describe('Retreat Cost Increase Effect', () => {
    describe('getResolutionRequirements', () => {
        const handler = new RetreatCostIncreaseEffectHandler();

        it('should return empty array (no resolution needed)', () => {
            const effect: RetreatCostIncreaseEffect = {
                type: 'retreat-cost-increase',
                amount: { type: 'constant', value: 1 },
                target: { player: 'opponent', location: 'field' },
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
                    type: 'retreat-cost-increase',
                    amount: { type: 'constant', value: 1 },
                    target: { player: 'opponent', location: 'field' },
                    duration: { type: 'until-end-of-next-turn' },
                }],
            }],
            [ 'increase-by-two', {
                templateId: 'increase-by-two',
                name: 'Increase Retreat By Two',
                effects: [{
                    type: 'retreat-cost-increase',
                    amount: { type: 'constant', value: 2 },
                    target: { player: 'opponent', location: 'field' },
                    duration: { type: 'until-end-of-next-turn' },
                }],
            }],
            [ 'increase-active', {
                templateId: 'increase-active',
                name: 'Increase Active Retreat',
                effects: [{
                    type: 'retreat-cost-increase',
                    amount: { type: 'constant', value: 1 },
                    target: { player: 'opponent', location: 'field', position: 'active' },
                    duration: { type: 'until-end-of-next-turn' },
                }],
            }],
            [ 'increase-bench', {
                templateId: 'increase-bench',
                name: 'Increase Bench Retreat',
                effects: [{
                    type: 'retreat-cost-increase',
                    amount: { type: 'constant', value: 1 },
                    target: { player: 'opponent', location: 'field', position: 'bench' },
                    duration: { type: 'until-end-of-next-turn' },
                }],
            }],
            [ 'increase-self', {
                templateId: 'increase-self',
                name: 'Increase Self Retreat',
                effects: [{
                    type: 'retreat-cost-increase',
                    amount: { type: 'constant', value: 1 },
                    target: { player: 'self', location: 'field' },
                    duration: { type: 'until-end-of-next-turn' },
                }],
            }],
        ]),
    });

    const zeroCostCreature = { templateId: 'zero-cost-creature', type: 'creature' as const };
    const increaseByTwo = { templateId: 'increase-by-two', type: 'item' as const };
    const increaseActive = { templateId: 'increase-active', type: 'item' as const };
    const increaseBench = { templateId: 'increase-bench', type: 'item' as const };
    const increaseSelf = { templateId: 'increase-self', type: 'item' as const };

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
                StateBuilder.withCreatures(1, 'low-cost-creature'), // Retreat cost 1
                StateBuilder.withHand(0, [ increaseItem ]),
                StateBuilder.withEnergy('low-cost-creature-1', { fire: 1 }), // Only 1 energy, needs 2
                (state) => {
                    state.field.creatures[1].push({
                        fieldInstanceId: 'bench-creature',
                        evolutionStack: [{ instanceId: 'bench-card', templateId: 'high-cost-creature' }],
                        damageTaken: 0,
                        turnLastPlayed: 0,
                    });
                },
            ),
            maxSteps: 20,
        });

        expect(getExecutedCount()).to.equal(2, 'Should have executed increase item and end turn (retreat blocked due to insufficient energy)');
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
                StateBuilder.withCreatures(1, 'low-cost-creature'), // Retreat cost 1, becomes 2
                StateBuilder.withHand(0, [ increaseItem ]),
                StateBuilder.withEnergy('low-cost-creature-1', { fire: 2 }), // Has 2 energy to retreat
                (state) => {
                    state.field.creatures[1].push({
                        fieldInstanceId: 'bench-creature',
                        evolutionStack: [{ instanceId: 'bench-card', templateId: 'high-cost-creature' }],
                        damageTaken: 0,
                        turnLastPlayed: 0,
                    });
                },
            ),
            maxSteps: 20,
        });

        expect(getExecutedCount()).to.equal(3, 'Should have executed increase item, end turn, and retreat');
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
                StateBuilder.withCreatures(1, 'low-cost-creature'), // Retreat cost 1, becomes 3
                StateBuilder.withHand(0, [ increaseByTwo ]),
                StateBuilder.withEnergy('low-cost-creature-1', { fire: 2 }), // Only 2 energy, needs 3
                (state) => {
                    state.field.creatures[1].push({
                        fieldInstanceId: 'bench-creature',
                        evolutionStack: [{ instanceId: 'bench-card', templateId: 'high-cost-creature' }],
                        damageTaken: 0,
                        turnLastPlayed: 0,
                    });
                },
            ),
            maxSteps: 20,
        });

        expect(getExecutedCount()).to.equal(2, 'Should have executed increase item and end turn (retreat blocked)');
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
                StateBuilder.withCreatures(1, 'zero-cost-creature'), // Retreat cost 0, becomes 1
                StateBuilder.withHand(0, [ increaseItem ]),
                // No energy attached
                (state) => {
                    state.field.creatures[1].push({
                        fieldInstanceId: 'bench-creature',
                        evolutionStack: [{ instanceId: 'bench-card', templateId: 'high-cost-creature' }],
                        damageTaken: 0,
                        turnLastPlayed: 0,
                    });
                },
            ),
            maxSteps: 20,
        });

        expect(getExecutedCount()).to.equal(2, 'Should have executed increase item and end turn (retreat blocked)');
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
                StateBuilder.withCreatures(1, 'low-cost-creature'), // Active with retreat cost 1, becomes 2
                StateBuilder.withHand(0, [ increaseActive ]),
                StateBuilder.withEnergy('low-cost-creature-1', { fire: 1 }), // Only 1 energy
                (state) => {
                    state.field.creatures[1].push({
                        fieldInstanceId: 'bench-creature',
                        evolutionStack: [{ instanceId: 'bench-card', templateId: 'high-cost-creature' }],
                        damageTaken: 0,
                        turnLastPlayed: 0,
                    });
                },
            ),
            maxSteps: 20,
        });

        expect(getExecutedCount()).to.equal(2, 'Should have executed increase item and end turn (active retreat blocked)');
        // Verify active didn't retreat
        expect(getCurrentTemplateId(state.field.creatures[1][0])).to.equal('low-cost-creature', 'Active should not have retreated');
    });

    it('should increase only bench creatures when targeted', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [
                new PlayCardResponseMessage('increase-bench', 'item'),
                new EndTurnResponseMessage(),
                new RetreatResponseMessage(0), // Opponent retreats active (not affected)
            ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'low-cost-creature'),
                StateBuilder.withCreatures(1, 'low-cost-creature'), // Active with retreat cost 1
                StateBuilder.withHand(0, [ increaseBench ]),
                StateBuilder.withEnergy('low-cost-creature-1', { fire: 1 }), // Has enough to retreat
                (state) => {
                    state.field.creatures[1].push({
                        fieldInstanceId: 'bench-creature',
                        evolutionStack: [{ instanceId: 'bench-card', templateId: 'high-cost-creature' }],
                        damageTaken: 0,
                        turnLastPlayed: 0,
                    });
                },
            ),
            maxSteps: 20,
        });

        expect(getExecutedCount()).to.equal(3, 'Should have executed increase item, end turn, and retreat');
        // Verify active retreated successfully (bench cost increased, not active)
        expect(getCurrentTemplateId(state.field.creatures[1][0])).to.equal('high-cost-creature', 'Active should have retreated (bench cost increased)');
    });

    it('should increase self retreat cost when targeted', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [
                new PlayCardResponseMessage('increase-self', 'item'),
                new RetreatResponseMessage(0), // Try to retreat own active
            ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'low-cost-creature'), // Retreat cost 1, becomes 2
                StateBuilder.withCreatures(1, 'low-cost-creature'),
                StateBuilder.withHand(0, [ increaseSelf ]),
                StateBuilder.withEnergy('low-cost-creature-0', { fire: 1 }), // Only 1 energy
                (state) => {
                    state.field.creatures[0].push({
                        fieldInstanceId: 'bench-creature',
                        evolutionStack: [{ instanceId: 'bench-card', templateId: 'high-cost-creature' }],
                        damageTaken: 0,
                        turnLastPlayed: 0,
                    });
                },
            ),
            maxSteps: 15,
        });

        expect(getExecutedCount()).to.equal(1, 'Should have executed increase item only (self retreat blocked)');
        // Verify own creature didn't retreat
        expect(getCurrentTemplateId(state.field.creatures[0][0])).to.equal('low-cost-creature', 'Own active should not have retreated');
    });

    it('should not increase retreat cost during same turn', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [
                new PlayCardResponseMessage('increase-item', 'item'),
                new RetreatResponseMessage(0), // Same turn retreat (should work as normal)
            ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'low-cost-creature'),
                StateBuilder.withCreatures(1, 'low-cost-creature'),
                StateBuilder.withHand(0, [ increaseItem ]),
                StateBuilder.withEnergy('low-cost-creature-0', { fire: 1 }),
                (state) => {
                    state.field.creatures[0].push({
                        fieldInstanceId: 'bench-creature',
                        evolutionStack: [{ instanceId: 'bench-card', templateId: 'high-cost-creature' }],
                        damageTaken: 0,
                        turnLastPlayed: 0,
                    });
                },
            ),
            maxSteps: 15,
        });

        expect(getExecutedCount()).to.equal(2, 'Should have executed increase item and retreat');
        // Verify retreat worked (increase is for opponent)
        expect(getCurrentTemplateId(state.field.creatures[0][0])).to.equal('high-cost-creature', 'Should have retreated (increase is for opponent)');
    });

    it('should expire at correct time based on duration', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [
                new PlayCardResponseMessage('increase-item', 'item'),
                new EndTurnResponseMessage(),
                new EndTurnResponseMessage(), // Opponent's turn ends (until-end-of-next-turn)
                new EndTurnResponseMessage(), // Back to player 0's turn
                new EndTurnResponseMessage(), // Player 0's turn ends
                new RetreatResponseMessage(0), // Opponent should now be able to retreat with 1 energy
            ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'low-cost-creature'),
                StateBuilder.withCreatures(1, 'low-cost-creature'),
                StateBuilder.withHand(0, [ increaseItem ]),
                StateBuilder.withEnergy('low-cost-creature-1', { fire: 1 }), // 1 energy (enough after expiration)
                (state) => {
                    state.field.creatures[1].push({
                        fieldInstanceId: 'bench-creature',
                        evolutionStack: [{ instanceId: 'bench-card', templateId: 'high-cost-creature' }],
                        damageTaken: 0,
                        turnLastPlayed: 0,
                    });
                },
            ),
            maxSteps: 30,
        });

        expect(getExecutedCount()).to.equal(6, 'Should have executed all actions including final retreat');
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
                StateBuilder.withCreatures(1, 'low-cost-creature'), // Retreat cost 1, becomes 3 (1 + 1 + 1)
                StateBuilder.withHand(0, [ increaseItem, increaseItem ]),
                StateBuilder.withEnergy('low-cost-creature-1', { fire: 2 }), // Only 2 energy, needs 3
                (state) => {
                    state.field.creatures[1].push({
                        fieldInstanceId: 'bench-creature',
                        evolutionStack: [{ instanceId: 'bench-card', templateId: 'high-cost-creature' }],
                        damageTaken: 0,
                        turnLastPlayed: 0,
                    });
                },
            ),
            maxSteps: 25,
        });

        expect(getExecutedCount()).to.equal(3, 'Should have executed both increase items and end turn (retreat blocked)');
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
                StateBuilder.withCreatures(1, 'high-cost-creature'), // Retreat cost 3, becomes 4
                StateBuilder.withHand(0, [ increaseItem ]),
                StateBuilder.withEnergy('high-cost-creature-1', { water: 3 }), // Only 3 energy, needs 4
                (state) => {
                    state.field.creatures[1].push({
                        fieldInstanceId: 'bench-creature',
                        evolutionStack: [{ instanceId: 'bench-card', templateId: 'low-cost-creature' }],
                        damageTaken: 0,
                        turnLastPlayed: 0,
                    });
                },
            ),
            maxSteps: 20,
        });

        expect(getExecutedCount()).to.equal(2, 'Should have executed increase item and end turn (retreat blocked)');
        // Verify creature didn't retreat
        expect(getCurrentTemplateId(state.field.creatures[1][0])).to.equal('high-cost-creature', 'Should not have retreated (high cost increased further)');
    });
});
