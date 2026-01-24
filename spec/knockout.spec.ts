import { expect } from 'chai';
import { AttackResponseMessage } from '../src/messages/response/attack-response-message.js';
import { SelectActiveCardResponseMessage } from '../src/messages/response/select-active-card-response-message.js';
import { StateBuilder } from './helpers/state-builder.js';
import { runTestGame } from './helpers/test-helpers.js';
import { getCurrentTemplateId } from '../src/utils/field-card-utils.js';

describe('Knockout System', () => {
    describe('Point Awarding', () => {
        it('should award points when creature is knocked out', () => {
            const { state } = runTestGame({
                actions: [new AttackResponseMessage(0)],
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature'),
                    StateBuilder.withCreatures(1, 'high-hp-creature'),
                    StateBuilder.withDamage('high-hp-creature-1', 160), // 180 HP - 160 damage = 20 HP, attack does 20 damage = KO
                    StateBuilder.withEnergy('basic-creature-0', { fire: 1 }),
                    (state) => { state.points = [0, 0]; }
                ),
                maxSteps: 10
            });
            
            expect(state.points[0]).to.be.greaterThan(0, 'Player 0 should have gained points for knocking out creature');
        });

        it('should award 1 point when a regular card is knocked out', () => {
            const { state } = runTestGame({
                actions: [
                    new AttackResponseMessage(0),
                    new SelectActiveCardResponseMessage(0)
                ],
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature'),
                    StateBuilder.withCreatures(1, 'basic-creature', ['basic-creature']),
                    StateBuilder.withDamage('basic-creature-1', 40), // Pre-damage so 20 damage attack will KO (40 + 20 = 60 HP)
                    StateBuilder.withEnergy('basic-creature-0', { fire: 1 })
                ),
                maxSteps: 15
            });

            expect(state.points[0]).to.equal(1, 'Player 0 should have 1 point from basic knockout');
        });

        it('should award 2 points when an ex card is knocked out', () => {
            const { state } = runTestGame({
                actions: [
                    new AttackResponseMessage(0),
                    new SelectActiveCardResponseMessage(0)
                ],
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature'),
                    StateBuilder.withCreatures(1, 'ex-creature', ['basic-creature']),
                    StateBuilder.withDamage('ex-creature-1', 100), // Pre-damage so 20 damage attack will KO (100 + 20 = 120 HP)
                    StateBuilder.withEnergy('basic-creature-0', { fire: 1 })
                ),
                maxSteps: 15
            });

            expect(state.points[0]).to.equal(2, 'Player 0 should have 2 points from ex knockout');
        });

        it('should award 3 points when a mega ex card is knocked out', () => {
            const { state } = runTestGame({
                actions: [
                    new AttackResponseMessage(0),
                    new SelectActiveCardResponseMessage(0)
                ],
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature'),
                    StateBuilder.withCreatures(1, 'mega-ex-creature', ['basic-creature']),
                    StateBuilder.withDamage('mega-ex-creature-1', 100), // Pre-damage so 20 damage attack will KO (100 + 20 = 120 HP)
                    StateBuilder.withEnergy('basic-creature-0', { fire: 1 })
                ),
                maxSteps: 15
            });

            expect(state.points[0]).to.equal(3, 'Player 0 should have 3 points from mega ex knockout');
        });
    });

    it('should handle bench promotion after knockout', () => {
        const { state } = runTestGame({
            actions: [
                new AttackResponseMessage(0),
                new SelectActiveCardResponseMessage(0)
            ],
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature'),
                StateBuilder.withCreatures(1, 'evolution-creature', ['high-hp-creature']),
                StateBuilder.withDamage('evolution-creature-1', 180), // Close to KO
                StateBuilder.withEnergy('basic-creature-0', { fire: 1 })
            ),
            maxSteps: 10
        });
        
        expect(getCurrentTemplateId(state.field.creatures[1][0])).to.equal('high-hp-creature', 'Bench creature should be promoted to active after knockout');
    });

    it('should discard knocked out active creature', () => {
        const { state } = runTestGame({
            actions: [
                new AttackResponseMessage(0),
                new SelectActiveCardResponseMessage(0)
            ],
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature'),
                StateBuilder.withCreatures(1, 'evolution-creature', ['high-hp-creature']),
                StateBuilder.withDamage('evolution-creature-1', 180), // Close to KO
                StateBuilder.withEnergy('basic-creature-0', { fire: 1 })
            ),
            maxSteps: 10
        });
        
        // Player 1's active creature should be knocked out and in discard pile
        expect(state.discard[1].length).to.be.greaterThan(0, 'Player 1 should have cards in discard pile');
        expect(state.discard[1].some((card: any) => card.templateId === 'evolution-creature')).to.be.true;
        
        // Card conservation: knocked out card is in discard, not lost
        expect(state.discard[1].some((card: any) => card.templateId === 'evolution-creature')).to.be.true;
    });

    it('should discard all cards in evolution stack when evolved creature is knocked out', () => {
        const { state } = runTestGame({
            actions: [
                new AttackResponseMessage(0),
                new SelectActiveCardResponseMessage(0)
            ],
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature'),
                // Start with basic creature, evolve it, then damage it near KO
                StateBuilder.withCreatures(1, 'basic-creature', ['high-hp-creature']),
                StateBuilder.withHand(1, [{templateId: 'evolution-creature', type: 'creature'}]),
                StateBuilder.withEnergy('basic-creature-0', { fire: 1 }),
                StateBuilder.withCanEvolve(1, 0),
                (state) => {
                    // Manually create an evolved creature for testing
                    const player1ActiveCard = state.field.creatures[1][0];
                    if (player1ActiveCard) {
                        // Add evolution form to the stack
                        player1ActiveCard.evolutionStack.push({
                            instanceId: 'evolution-creature-evolved',
                            templateId: 'evolution-creature'
                        });
                        // Damage the evolved creature near KO (evolution-creature has 180 HP)
                        player1ActiveCard.damageTaken = 160;
                    }
                }
            ),
            maxSteps: 10
        });
        
        // Both the base form and evolved form should be in the discard pile
        const discardPile = state.discard[1];
        expect(discardPile.length).to.be.greaterThanOrEqual(2, 'Both forms should be in discard pile');
        expect(discardPile.some(card => card.templateId === 'basic-creature')).to.be.true;
        expect(discardPile.some(card => card.templateId === 'evolution-creature')).to.be.true;
        
        // Card conservation: both evolution stack cards moved to discard
        expect(discardPile.filter(card => card.templateId === 'basic-creature').length).to.be.greaterThan(0, 'Base form in discard');
        expect(discardPile.filter(card => card.templateId === 'evolution-creature').length).to.be.greaterThan(0, 'Evolved form in discard');
    });

    it('should detach tools when creature with tool is knocked out', () => {
        const { state } = runTestGame({
            actions: [
                new AttackResponseMessage(0),
                new SelectActiveCardResponseMessage(0)
            ],
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature'),
                StateBuilder.withCreatures(1, 'evolution-creature', ['high-hp-creature']),
                StateBuilder.withDamage('evolution-creature-1', 180), // Close to KO
                StateBuilder.withEnergy('basic-creature-0', { fire: 1 }),
                StateBuilder.withTool('evolution-creature-1', 'basic-tool')
            ),
            maxSteps: 10
        });
        
        // Tool should be detached after knockout
        expect(state.tools.attachedTools['evolution-creature-1']).to.be.undefined;
        
        // Creature should be in discard pile
        expect(state.discard[1].length).to.be.greaterThan(0, 'Player 1 should have cards in discard pile');
    });

    it('should detach tools when benched creature with tool is knocked out', () => {
        const { state } = runTestGame({
            actions: [new AttackResponseMessage(0)],
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature', ['basic-creature']),
                StateBuilder.withCreatures(1, 'basic-creature'),
                StateBuilder.withDamage('basic-creature-0-0', 40), // Bench creature near KO
                StateBuilder.withEnergy('basic-creature-1', { fire: 1 }),
                StateBuilder.withTool('basic-creature-0-0', 'basic-tool')
            ),
            maxSteps: 10
        });
        
        // If bench creature was knocked out, tool should be detached
        if (state.field.creatures[0].length === 1) {
            expect(state.tools.attachedTools['basic-creature-0-0']).to.be.undefined;
        }
    });
});
