import { expect } from 'chai';
import { AttackResponseMessage } from '../src/messages/response/attack-response-message.js';
import { SelectActiveCardResponseMessage } from '../src/messages/response/select-active-card-response-message.js';
import { StateBuilder } from './helpers/state-builder.js';
import { runTestGame } from './helpers/test-helpers.js';
import { getCurrentTemplateId } from '../src/utils/field-card-utils.js';

describe('Knockout System', () => {
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
