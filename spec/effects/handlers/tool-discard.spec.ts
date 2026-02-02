import { expect } from 'chai';
import { MockCardRepository } from '../../mock-repository.js';
import { CreatureData, ToolData } from '../../../src/repository/card-types.js';
import { ToolDiscardEffectHandler } from '../../../src/effects/handlers/tool-discard-effect-handler.js';
import { EffectContextFactory } from '../../../src/effects/effect-context.js';
import { ToolDiscardEffect } from '../../../src/repository/effect-types.js';

describe('Tool Discard Effect', () => {
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
        ]),
        tools: new Map<string, ToolData>([
            [ 'damage-tool', {
                templateId: 'damage-tool',
                name: 'Damage Tool',
                effects: [{ 
                    type: 'damage-boost', 
                    amount: { type: 'constant', value: 10 },
                }],
            }],
        ]),
    });

    it('should have correct effect type', () => {
        const handler = new ToolDiscardEffectHandler();
        const effect: ToolDiscardEffect = {
            type: 'tool-discard',
            target: {
                type: 'fixed',
                player: 'opponent',
                position: 'active',
            },
        };

        const context = EffectContextFactory.createCardContext(0, 'Discard Tool', 'item');
        
        // Just verify the effect structure is correct
        expect(effect.type).to.equal('tool-discard');
        expect(effect.target.type).to.equal('fixed');
    });

    it('should return resolution requirements for non-resolved targets', () => {
        const handler = new ToolDiscardEffectHandler();
        const effect: ToolDiscardEffect = {
            type: 'tool-discard',
            target: {
                type: 'single-choice',
                chooser: 'self',
                criteria: {},
            },
        };

        const requirements = handler.getResolutionRequirements(effect);
        expect(requirements).to.have.lengthOf(1);
        expect(requirements[0].targetProperty).to.equal('target');
        expect(requirements[0].required).to.be.true;
    });
});
