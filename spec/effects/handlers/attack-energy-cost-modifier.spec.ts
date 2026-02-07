import { expect } from 'chai';
import { PlayCardResponseMessage } from '../../../src/messages/response/play-card-response-message.js';
import { AttackResponseMessage } from '../../../src/messages/response/attack-response-message.js';
import { EndTurnResponseMessage } from '../../../src/messages/response/end-turn-response-message.js';
import { StateBuilder } from '../../helpers/state-builder.js';
import { runTestGame } from '../../helpers/test-helpers.js';
import { MockCardRepository } from '../../mock-repository.js';
import { CreatureData, ItemData } from '../../../src/repository/card-types.js';
import { AttackEnergyCostModifierEffectHandler } from '../../../src/effects/handlers/attack-energy-cost-modifier-effect-handler.js';
import { AttackEnergyCostModifierEffect } from '../../../src/repository/effect-types.js';

describe('Attack Energy Cost Modifier Effect', () => {
    describe('getResolutionRequirements', () => {
        const handler = new AttackEnergyCostModifierEffectHandler();

        it('should return empty array (no resolution needed)', () => {
            const effect: AttackEnergyCostModifierEffect = {
                type: 'attack-energy-cost-modifier',
                amount: { type: 'constant', value: -1 },
                target: { player: 'self', location: 'field' },
                duration: { type: 'until-end-of-turn' },
            };

            const result = handler.getResolutionRequirements(effect);
            
            expect(result).to.be.an('array').that.is.empty;
        });
    });

    const basicCreature = { templateId: 'basic-creature', type: 'creature' as const };
    const highCostCreature = { templateId: 'high-cost-creature', type: 'creature' as const };
    const reduceItem = { templateId: 'reduce-item', type: 'item' as const };

    const testRepository = new MockCardRepository({
        creatures: new Map<string, CreatureData>([
            [ 'basic-creature', {
                templateId: 'basic-creature',
                name: 'Basic Creature',
                maxHp: 80,
                type: 'fire',
                weakness: 'water',
                retreatCost: 1,
                attacks: [{ name: 'Basic Attack', damage: 20, energyRequirements: [{ type: 'fire', amount: 2 }] }],
            }],
            [ 'high-cost-creature', {
                templateId: 'high-cost-creature',
                name: 'High Cost Creature',
                maxHp: 180,
                type: 'water',
                weakness: 'grass',
                retreatCost: 2,
                attacks: [{ name: 'Expensive Attack', damage: 60, energyRequirements: [{ type: 'water', amount: 4 }] }],
            }],
            [ 'single-cost-creature', {
                templateId: 'single-cost-creature',
                name: 'Single Cost Creature',
                maxHp: 60,
                type: 'grass',
                weakness: 'fire',
                retreatCost: 1,
                attacks: [{ name: 'Quick Attack', damage: 15, energyRequirements: [{ type: 'grass', amount: 1 }] }],
            }],
        ]),
        items: new Map<string, ItemData>([
            [ 'reduce-item', {
                templateId: 'reduce-item',
                name: 'Reduce Energy Item',
                effects: [{
                    type: 'attack-energy-cost-modifier',
                    amount: { type: 'constant', value: -1 },
                    target: { player: 'self', location: 'field' },
                    duration: { type: 'until-end-of-next-turn' },
                }],
            }],
            [ 'increase-item', {
                templateId: 'increase-item',
                name: 'Increase Energy Item',
                effects: [{
                    type: 'attack-energy-cost-modifier',
                    amount: { type: 'constant', value: 1 },
                    target: { player: 'opponent', location: 'field' },
                    duration: { type: 'until-end-of-next-turn' },
                }],
            }],
            [ 'reduce-by-two', {
                templateId: 'reduce-by-two',
                name: 'Reduce Energy By Two',
                effects: [{
                    type: 'attack-energy-cost-modifier',
                    amount: { type: 'constant', value: -2 },
                    target: { player: 'self', location: 'field' },
                    duration: { type: 'until-end-of-next-turn' },
                }],
            }],
            [ 'reduce-active', {
                templateId: 'reduce-active',
                name: 'Reduce Active Energy',
                effects: [{
                    type: 'attack-energy-cost-modifier',
                    amount: { type: 'constant', value: -1 },
                    target: { player: 'self', location: 'field', position: 'active' },
                    duration: { type: 'until-end-of-next-turn' },
                }],
            }],
        ]),
    });

    const singleCostCreature = { templateId: 'single-cost-creature', type: 'creature' as const };
    const increaseItem = { templateId: 'increase-item', type: 'item' as const };
    const reduceByTwo = { templateId: 'reduce-by-two', type: 'item' as const };
    const reduceActive = { templateId: 'reduce-active', type: 'item' as const };

    /*
     * NOTE: These tests are marked as pending because attack-energy-cost-modifier is not fully wired yet
     * The effect handler exists and registers passive effects, but the actual cost modification logic
     * needs to be integrated into the attack validation/execution system
     */

    it('should reduce attack energy cost by 1 (basic operation)', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [
                new PlayCardResponseMessage('reduce-item', 'item'),
                new AttackResponseMessage(0), // Attack with reduced cost (needs 1 energy instead of 2)
            ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature'), // Attack costs 2, becomes 1
                StateBuilder.withCreatures(1, 'high-cost-creature'),
                StateBuilder.withHand(0, [ reduceItem ]),
                StateBuilder.withEnergy('basic-creature-0', { fire: 1 }), // Only 1 energy (enough with reduction)
            ),
        });

        expect(getExecutedCount()).to.equal(2, 'Should have executed reduce item and attack');
        expect(state.field.creatures[1][0].damageTaken).to.equal(20, 'Should have dealt damage (attack with reduced cost)');
    });

    it('should increase opponent attack energy cost by 1', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [
                new PlayCardResponseMessage('increase-item', 'item'),
                new EndTurnResponseMessage(),
                new AttackResponseMessage(0), // Opponent attack with increased cost (needs 3 energy instead of 2)
            ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature'),
                StateBuilder.withCreatures(1, 'basic-creature'), // Attack costs 2, becomes 3
                StateBuilder.withHand(0, [ increaseItem ]),
                StateBuilder.withEnergy('basic-creature-1', { fire: 2 }), // Only 2 energy (not enough)
            ),
        });

        expect(getExecutedCount()).to.equal(2, 'Should have executed increase item and end turn (attack blocked)');
        expect(state.field.creatures[0][0].damageTaken).to.equal(0, 'Should take no damage (attack cost too high)');
    });

    it('should reduce attack energy cost by 2', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [
                new PlayCardResponseMessage('reduce-by-two', 'item'),
                new AttackResponseMessage(0), // Attack with reduced cost (needs 2 energy instead of 4)
            ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'high-cost-creature'), // Attack costs 4, becomes 2
                StateBuilder.withCreatures(1, 'high-cost-creature'), // No weakness to water
                StateBuilder.withHand(0, [ reduceByTwo ]),
                StateBuilder.withEnergy('high-cost-creature-0', { water: 2 }), // 2 energy (enough with reduction)
            ),
        });

        expect(getExecutedCount()).to.equal(2, 'Should have executed reduce item and attack');
        expect(state.field.creatures[1][0].damageTaken).to.equal(60, 'Should have dealt damage (attack with reduced cost by 2)');
    });

    it('should not reduce attack energy cost below zero', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [
                new PlayCardResponseMessage('reduce-by-two', 'item'),
                new AttackResponseMessage(0), // Attack with reduction (cost 1, becomes 0 at minimum)
            ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'single-cost-creature'), // Attack costs 1, becomes 0 (not negative)
                StateBuilder.withCreatures(1, 'basic-creature'),
                StateBuilder.withHand(0, [ reduceByTwo ]),
                // No energy needed
            ),
        });

        expect(getExecutedCount()).to.equal(2, 'Should have executed reduce item and attack');
        expect(state.field.creatures[1][0].damageTaken).to.equal(15, 'Should have dealt damage (free attack)');
    });

    it('should reduce only active creature cost when targeted', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [
                new PlayCardResponseMessage('reduce-active', 'item'),
                new AttackResponseMessage(0), // Active attacks with reduced cost
            ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature'), // Active: attack costs 2, becomes 1
                StateBuilder.withCreatures(1, 'high-cost-creature'),
                StateBuilder.withHand(0, [ reduceActive ]),
                StateBuilder.withEnergy('basic-creature-0', { fire: 1 }), // 1 energy (enough for active)
                (state) => {
                    // Add bench creature
                    state.field.creatures[0].push({
                        fieldInstanceId: 'bench-creature',
                        evolutionStack: [{ instanceId: 'bench-card', templateId: 'high-cost-creature' }],
                        damageTaken: 0,
                        turnLastPlayed: 0,
                    });
                },
            ),
        });

        expect(getExecutedCount()).to.equal(2, 'Should have executed reduce item and attack');
        expect(state.field.creatures[1][0].damageTaken).to.equal(20, 'Should have dealt damage (active cost reduced)');
    });

    it('should not affect attacks during same turn', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [
                new PlayCardResponseMessage('reduce-item', 'item'),
                new AttackResponseMessage(0), // Same turn attack (reduction active)
            ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature'),
                StateBuilder.withCreatures(1, 'high-cost-creature'),
                StateBuilder.withHand(0, [ reduceItem ]),
                StateBuilder.withEnergy('basic-creature-0', { fire: 1 }), // 1 energy (enough with reduction)
            ),
        });

        expect(getExecutedCount()).to.equal(2, 'Should have executed reduce item and attack');
        expect(state.field.creatures[1][0].damageTaken).to.equal(20, 'Should have dealt damage (reduction active same turn)');
    });

    it('should expire at correct time based on duration', () => {
        // Create an item with until-end-of-turn for simpler testing
        const testRepoWithSimpleDuration = new MockCardRepository({
            creatures: new Map<string, CreatureData>([
                [ 'basic-creature', {
                    templateId: 'basic-creature',
                    name: 'Basic Creature',
                    maxHp: 80,
                    type: 'fire',
                    weakness: 'water',
                    retreatCost: 1,
                    attacks: [{ name: 'Basic Attack', damage: 20, energyRequirements: [{ type: 'fire', amount: 2 }] }],
                }],
                [ 'high-cost-creature', {
                    templateId: 'high-cost-creature',
                    name: 'High Cost Creature',
                    maxHp: 180,
                    type: 'water',
                    weakness: 'grass',
                    retreatCost: 2,
                    attacks: [{ name: 'Expensive Attack', damage: 60, energyRequirements: [{ type: 'water', amount: 4 }] }],
                }],
            ]),
            items: new Map<string, ItemData>([
                [ 'reduce-item-eot', {
                    templateId: 'reduce-item-eot',
                    name: 'Reduce Energy Item EOT',
                    effects: [{
                        type: 'attack-energy-cost-modifier',
                        amount: { type: 'constant', value: -1 },
                        target: { player: 'self', location: 'field' },
                        duration: { type: 'until-end-of-turn' }, // Expires at start of NEXT turn
                    }],
                }],
            ]),
        });
        
        const { state, getExecutedCount } = runTestGame({
            actions: [
                new PlayCardResponseMessage('reduce-item-eot', 'item'),
                new EndTurnResponseMessage(),
                new EndTurnResponseMessage(), // At Turn 1, effect expired
                new AttackResponseMessage(0), // Attack with expired effect (needs 2 energy, has 1)
            ],
            customRepository: testRepoWithSimpleDuration,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature'),
                StateBuilder.withCreatures(1, 'high-cost-creature'),
                StateBuilder.withHand(0, [{ templateId: 'reduce-item-eot', type: 'item' as const }]),
                StateBuilder.withEnergy('basic-creature-0', { fire: 1 }), // Only 1 energy (not enough)
            ),
        });

        expect(getExecutedCount()).to.equal(3, 'Should have executed reduce item and two end turns (attack blocked)');
        expect(state.field.creatures[1][0].damageTaken).to.equal(0, 'Should take no damage (reduction expired)');
    });

    it('should stack multiple cost reductions', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [
                new PlayCardResponseMessage('reduce-item', 'item'),
                new PlayCardResponseMessage('reduce-item', 'item'),
                new AttackResponseMessage(0), // Attack with stacked reductions (needs 0 energy instead of 2)
            ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature'), // Attack costs 2, becomes 0 (2 - 1 - 1)
                StateBuilder.withCreatures(1, 'high-cost-creature'),
                StateBuilder.withHand(0, [ reduceItem, reduceItem ]),
                // No energy needed
            ),
        });

        expect(getExecutedCount()).to.equal(3, 'Should have executed both reduce items and attack');
        expect(state.field.creatures[1][0].damageTaken).to.equal(20, 'Should have dealt damage (stacked reductions)');
    });

    it('should work with high cost attacks', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [
                new PlayCardResponseMessage('reduce-by-two', 'item'),
                new AttackResponseMessage(0), // High cost attack with reduction
            ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'high-cost-creature'), // Attack costs 4, becomes 2
                StateBuilder.withCreatures(1, 'high-cost-creature'), // No weakness to water
                StateBuilder.withHand(0, [ reduceByTwo ]),
                StateBuilder.withEnergy('high-cost-creature-0', { water: 2 }), // 2 energy (enough with reduction)
            ),
        });

        expect(getExecutedCount()).to.equal(2, 'Should have executed reduce item and attack');
        expect(state.field.creatures[1][0].damageTaken).to.equal(60, 'Should have dealt high damage (cost reduced)');
    });

    it('should allow attacks that were previously too expensive', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [
                new PlayCardResponseMessage('reduce-by-two', 'item'),
                new AttackResponseMessage(0), // Can now attack with less energy
            ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'high-cost-creature'), // Attack costs 4, becomes 2
                StateBuilder.withCreatures(1, 'high-cost-creature'), // No weakness to water
                StateBuilder.withHand(0, [ reduceByTwo ]),
                StateBuilder.withEnergy('high-cost-creature-0', { water: 2 }), // Would normally be insufficient
            ),
        });

        expect(getExecutedCount()).to.equal(2, 'Should have executed reduce item and attack');
        expect(state.field.creatures[1][0].damageTaken).to.equal(60, 'Should have dealt damage (previously too expensive)');
    });

    /*
     * Integration notes for future implementation:
     * 
     * When wiring up attack-energy-cost-modifier, the following integration points need to be addressed:
     * 
     * 1. Attack validation: In the attack handler, before checking if a creature has enough energy
     *    to use an attack, query all active attack-energy-cost-modifier effects that match the
     *    attacking creature and adjust the required energy accordingly.
     * 
     * 2. Cost calculation: The energy requirement calculation should:
     *    - Start with the base attack energy requirements
     *    - Apply all matching cost modifier effects (sum the modifiers)
     *    - Ensure the final cost doesn't go below 0
     *    - Check if the creature has enough attached energy for the modified cost
     * 
     * 3. Effect matching: Use the FieldTargetCriteria matching logic to determine which creatures
     *    are affected by each cost modifier effect (similar to damage-reduction, hp-bonus, etc.)
     * 
     * 4. Duration handling: Leverage the existing passive effect duration system to automatically
     *    expire cost modifiers at the appropriate time
     * 
     * 5. UI feedback: Consider showing modified attack costs in status messages when effects are active
     */
});
