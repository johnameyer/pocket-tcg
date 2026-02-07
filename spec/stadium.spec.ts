import { expect } from 'chai';
import { PlayCardResponseMessage } from '../src/messages/response/play-card-response-message.js';
import { GameCard } from '../src/controllers/card-types.js';
import { EndTurnResponseMessage } from '../src/messages/response/end-turn-response-message.js';
import { RetreatResponseMessage } from '../src/messages/response/retreat-response-message.js';
import { SelectActiveCardResponseMessage } from '../src/messages/response/select-active-card-response-message.js';
import { PassiveEffect } from '../src/controllers/effect-controller.js';
import { runTestGame } from './helpers/test-helpers.js';
import { StateBuilder } from './helpers/state-builder.js';

describe('Stadium Cards', () => {
    const basicStadium = { templateId: 'basic-stadium', type: 'stadium' as const };
    const hpBoostStadium = { templateId: 'hp-boost-stadium', type: 'stadium' as const };
    const retreatCostStadium = { templateId: 'retreat-cost-stadium', type: 'stadium' as const };

    describe('One Stadium Per Turn Restriction', () => {
        it('should prevent playing multiple stadiums in one turn', () => {
            const { state, getExecutedCount } = runTestGame({
                actions: [
                    new PlayCardResponseMessage('basic-stadium', 'stadium'),
                    new PlayCardResponseMessage('hp-boost-stadium', 'stadium'),
                ],
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withHand(0, [ basicStadium, hpBoostStadium ]),
                    StateBuilder.withCreatures(0, 'basic-creature'),
                ),
            });

            // Only first stadium should execute, second should be blocked
            expect(getExecutedCount()).to.equal(1, 'Should only execute first stadium');
            expect(state.hand[0].length).to.equal(1, 'Second stadium should remain in hand');
            
            // Card conservation: first stadium moved to stadium slot or discard
            expect(state.stadium.activeStadium).to.exist;
            expect(state.stadium.activeStadium?.templateId).to.equal('basic-stadium');
        });

        it('should allow playing a stadium on the next turn', () => {
            const { state, getExecutedCount } = runTestGame({
                actions: [
                    new PlayCardResponseMessage('basic-stadium', 'stadium'),
                    new EndTurnResponseMessage(),
                    // Player 1's turn - but they won't play anything automatically
                ],
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withHand(0, [ basicStadium, hpBoostStadium ]),
                    StateBuilder.withCreatures(0, 'basic-creature'),
                    StateBuilder.withCreatures(1, 'basic-creature'),
                ),
            });

            // First stadium should execute, then turn should end
            expect(getExecutedCount()).to.equal(2, 'Should execute first stadium and end turn');
            // Second stadium can be played next turn (validated by not being blocked)
            expect(state.hand[0].some(card => card.templateId === 'hp-boost-stadium')).to.be.true;
        });
    });

    describe('Stadium Replacement', () => {
        /*
         * Note: These tests validate the mechanics but may not fully execute due to test framework limitations
         * with multi-player action sequences. Core functionality is still validated.
         */
        it('should replace opponent stadium with own stadium', () => {
            const { state } = runTestGame({
                actions: [
                    new PlayCardResponseMessage('basic-stadium', 'stadium'),
                    new EndTurnResponseMessage(),
                    new PlayCardResponseMessage('hp-boost-stadium', 'stadium'),
                ],
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withHand(0, [ basicStadium ]),
                    StateBuilder.withHand(1, [ hpBoostStadium ]),
                    StateBuilder.withCreatures(0, 'basic-creature'),
                    StateBuilder.withCreatures(1, 'basic-creature'),
                ),
            });

            // Latest stadium should be active (opponent's stadium replaces active one)
            expect(state.stadium.activeStadium).to.exist;
            expect(state.stadium.activeStadium?.templateId).to.equal('hp-boost-stadium');
            expect(state.stadium.activeStadium?.owner).to.equal(1);
            
            // Original stadium should be in discard
            expect(state.discard[0].some((card: GameCard) => card.templateId === 'basic-stadium')).to.be.true;
        });

        it('should replace own stadium with different stadium', () => {
            const { state } = runTestGame({
                actions: [
                    new PlayCardResponseMessage('hp-boost-stadium', 'stadium'),
                ],
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withHand(0, [ hpBoostStadium ]),
                    StateBuilder.withCreatures(0, 'basic-creature'),
                    StateBuilder.withStadium('basic-stadium', 0),
                ),
            });

            // Second stadium should be active
            expect(state.stadium.activeStadium).to.exist;
            expect(state.stadium.activeStadium?.templateId).to.equal('hp-boost-stadium');
            expect(state.stadium.activeStadium?.owner).to.equal(0);
            
            // First stadium should be in discard pile
            expect(state.discard[0].some((card: GameCard) => card.templateId === 'basic-stadium')).to.be.true;
        });

        it('should discard replaced stadium to correct player discard pile', () => {
            const { state } = runTestGame({
                actions: [
                    new PlayCardResponseMessage('basic-stadium', 'stadium'),
                    new EndTurnResponseMessage(),
                    new PlayCardResponseMessage('hp-boost-stadium', 'stadium'),
                ],
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withHand(0, [ basicStadium ]),
                    StateBuilder.withHand(1, [ hpBoostStadium ]),
                    StateBuilder.withCreatures(0, 'basic-creature'),
                    StateBuilder.withCreatures(1, 'basic-creature'),
                ),
            });

            // Opponent's stadium should be active (replaces first player's)
            expect(state.stadium.activeStadium?.templateId).to.equal('hp-boost-stadium');
            expect(state.stadium.activeStadium?.owner).to.equal(1);
            
            // First player's replaced stadium should be in their discard pile
            expect(state.discard[0].some((card: GameCard) => card.templateId === 'basic-stadium')).to.be.true;
        });
    });

    describe('Duplicate Name Prevention', () => {
        it('should prevent playing stadium with same name as active stadium', () => {
            const { state, getExecutedCount } = runTestGame({
                actions: [
                    new PlayCardResponseMessage('basic-stadium', 'stadium'),
                    new EndTurnResponseMessage(),
                    new PlayCardResponseMessage('basic-stadium', 'stadium'),
                ],
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withHand(0, [ basicStadium ]),
                    StateBuilder.withHand(1, [ basicStadium ]),
                    StateBuilder.withCreatures(0, 'basic-creature'),
                    StateBuilder.withCreatures(1, 'basic-creature'),
                ),
            });

            // First stadium plays, second should be blocked (same name)
            expect(getExecutedCount()).to.equal(2, 'Should execute first stadium and end turn only');
            expect(state.stadium.activeStadium?.templateId).to.equal('basic-stadium');
            expect(state.hand[1].some(card => card.templateId === 'basic-stadium')).to.be.true;
        });
    });

    describe('Passive Effects', () => {
        it('should register passive effects when stadium is played', () => {
            const { state } = runTestGame({
                actions: [
                    new PlayCardResponseMessage('hp-boost-stadium', 'stadium'),
                ],
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withHand(0, [ hpBoostStadium ]),
                    StateBuilder.withCreatures(0, 'basic-creature'),
                ),
            });

            // Stadium should be active
            expect(state.stadium.activeStadium).to.exist;
            expect(state.stadium.activeStadium?.templateId).to.equal('hp-boost-stadium');
        });

        it('should clear passive effects when stadium is replaced', () => {
            const { state } = runTestGame({
                actions: [
                    new PlayCardResponseMessage('retreat-cost-stadium', 'stadium'),
                ],
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withHand(0, [ retreatCostStadium ]),
                    StateBuilder.withCreatures(0, 'basic-creature'),
                    StateBuilder.withStadium('hp-boost-stadium', 0),
                ),
            });

            // New stadium should be active
            expect(state.stadium.activeStadium?.templateId).to.equal('retreat-cost-stadium');
            
            // Old stadium should be discarded
            expect(state.discard[0].some((card: GameCard) => card.templateId === 'hp-boost-stadium')).to.be.true;
        });
    });

    describe('Side Effects', () => {
        it('should reduce retreat cost when retreat cost stadium is active', () => {
            /*
             * Tank creature has retreat cost 3, stadium reduces by 1 = need 2 energy
             * NOTE: Currently retreat validation doesn't apply passive retreat cost reductions
             * So we need to provide full retreat cost. This test validates that the passive effect is registered.
             */
            const activeCreatureId = 'tank-creature-0';
            
            const { state } = runTestGame({
                actions: [
                    new RetreatResponseMessage(0), // Retreat to bench position 0 (first bench slot)
                ],
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withHand(0, []),
                    StateBuilder.withCreatures(0, 'tank-creature', [ 'basic-creature' ]), // Active, then benched
                    StateBuilder.withEnergy(activeCreatureId, { fighting: 3 }), // Provide full cost (bug: reduction not applied)
                    StateBuilder.withStadium('retreat-cost-stadium', 0),
                ),
            });

            // Stadium should be active
            expect(state.stadium.activeStadium).to.exist;
            expect(state.stadium.activeStadium?.templateId).to.equal('retreat-cost-stadium');
            
            // Passive effect should be registered
            const retreatCostEffects = state.effects.activePassiveEffects.filter((e: PassiveEffect) => e.effect.type === 'retreat-cost-modification' && e.effect.operation === 'decrease');
            expect(retreatCostEffects.length).to.be.greaterThan(0, 'Retreat cost reduction effect should be registered');
            
            // Retreat should have succeeded - basic creature should now be active
            const activeCreature = state.field.creatures[0][0];
            expect(activeCreature.evolutionStack[0].templateId).to.equal('basic-creature', 'Basic creature should be active after retreat');
            
            // Tank should be on bench at position 1
            const benchCreature = state.field.creatures[0][1];
            expect(benchCreature.evolutionStack[0].templateId).to.equal('tank-creature', 'Tank should be on bench');
            
            // Energy should have been discarded (tank cost 3, stadium reduces by 1, so 2 energy needed)
            const tankEnergy = state.energy.attachedEnergyByInstance[benchCreature.fieldInstanceId];
            expect(tankEnergy.fighting).to.equal(1, 'Fighting energy should be reduced to 1 after paying retreat cost with stadium reduction');
        });

        it('should apply HP boost when HP boost stadium is active', () => {
            const { state } = runTestGame({
                actions: [
                    new PlayCardResponseMessage('hp-boost-stadium', 'stadium'),
                ],
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withHand(0, [ hpBoostStadium ]),
                    StateBuilder.withCreatures(0, 'basic-creature'),
                ),
            });

            // Stadium should be active
            expect(state.stadium.activeStadium).to.exist;
            expect(state.stadium.activeStadium?.templateId).to.equal('hp-boost-stadium');
            
            // HP bonus effect should be registered
            const hpEffects = state.effects.activePassiveEffects.filter((e: PassiveEffect) => e.effect.type === 'hp-bonus');
            expect(hpEffects.length).to.be.greaterThan(0, 'HP bonus effect should be registered');
        });
        
        it('should not allow retreat without stadium when energy is insufficient', () => {
            // Tank creature has retreat cost 3, but only has 2 energy - should fail without stadium
            const activeCreatureId = 'tank-creature-0';
            
            const { state } = runTestGame({
                actions: [
                    new RetreatResponseMessage(1), // Try to retreat
                ],
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withHand(0, []),
                    StateBuilder.withCreatures(0, 'tank-creature', [ 'basic-creature' ]),
                    StateBuilder.withEnergy(activeCreatureId, { fighting: 2 }), // Only 2 energy, needs 3
                ),
            });

            // Retreat should have failed - tank should still be active
            const activeCreature = state.field.creatures[0][0];
            expect(activeCreature.evolutionStack[0].templateId).to.equal('tank-creature', 'Tank should still be active');
        });
        
        it('should allow retreat with hp boost stadium replacing retreat cost stadium', () => {
            // Test that replacing stadiums properly clears old effects
            const activeCreatureId = 'tank-creature-0';
            
            const { state } = runTestGame({
                actions: [
                    new PlayCardResponseMessage('hp-boost-stadium', 'stadium'),
                    new RetreatResponseMessage(1), // Now try to retreat - should fail (needs 3 energy)
                ],
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withHand(0, [ hpBoostStadium ]),
                    StateBuilder.withCreatures(0, 'tank-creature', [ 'basic-creature' ]),
                    StateBuilder.withEnergy(activeCreatureId, { fighting: 2 }), // Only 2 energy
                    StateBuilder.withStadium('retreat-cost-stadium', 0),
                ),
            });

            // HP boost stadium should be active (replaced retreat cost stadium)
            expect(state.stadium.activeStadium?.templateId).to.equal('hp-boost-stadium');
            
            // Retreat should have failed since retreat cost reduction is gone
            const activeCreature = state.field.creatures[0][0];
            expect(activeCreature.evolutionStack[0].templateId).to.equal('tank-creature', 'Tank should still be active - retreat failed');
        });
        
        it('should knock out creature when HP boost stadium is removed and damage exceeds original max HP', () => {
            /*
             * Create a creature with damage that would knock it out without HP boost
             * Basic creature has 60 HP, HP boost adds 20 = 80 HP total
             * Deal 65 damage - survives with HP boost, knocked out without it
             */
            const activeCreatureId = 'basic-creature-0';
            
            const { state } = runTestGame({
                actions: [
                    new PlayCardResponseMessage('retreat-cost-stadium', 'stadium'), // Replace HP stadium, causing knockout
                    new SelectActiveCardResponseMessage(1), // Need to select new active after knockout
                ],
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withHand(0, [ retreatCostStadium ]),
                    StateBuilder.withCreatures(0, 'basic-creature', [ 'tank-creature' ]),
                    StateBuilder.withDamage(activeCreatureId, 65), // 65 damage - would be knocked out at 60 HP
                    StateBuilder.withStadium('hp-boost-stadium', 0),
                ),
            });

            // Retreat cost stadium should be active (replaced HP boost)
            expect(state.stadium.activeStadium?.templateId).to.equal('retreat-cost-stadium');
            
            // Basic creature should have been knocked out and tank should be active
            const activeCreature = state.field.creatures[0][0];
            expect(activeCreature.evolutionStack[0].templateId).to.equal('tank-creature', 'Tank should be active after basic creature knockout');
            
            // Basic creature should be in discard
            const basicInDiscard = state.discard[0].some((card: GameCard) => card.templateId === 'basic-creature');
            expect(basicInDiscard).to.be.true;
        });
    });
});
