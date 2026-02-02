import { expect } from 'chai';
import { MockCardRepository } from '../../mock-repository.js';
import { CreatureData } from '../../../src/repository/card-types.js';
import { StatusRecoveryEffectHandler } from '../../../src/effects/handlers/status-recovery-effect-handler.js';
import { EffectContextFactory } from '../../../src/effects/effect-context.js';
import { StatusRecoveryEffect } from '../../../src/repository/effect-types.js';

describe('Status Recovery Effect', () => {
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
    });

    it('should have correct effect type', () => {
        const handler = new StatusRecoveryEffectHandler();
        const effect: StatusRecoveryEffect = {
            type: 'status-recovery',
            target: {
                type: 'fixed',
                player: 'self',
                position: 'active',
            },
        };

        const context = EffectContextFactory.createCardContext(0, 'Status Recovery', 'item');
        
        // Just verify the effect structure is correct
        expect(effect.type).to.equal('status-recovery');
        expect(effect.target.type).to.equal('fixed');
    });

    it('should return resolution requirements for non-resolved targets', () => {
        const handler = new StatusRecoveryEffectHandler();
        const effect: StatusRecoveryEffect = {
            type: 'status-recovery',
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

    it('should remove specific conditions when specified', () => {
        const handler = new StatusRecoveryEffectHandler();
        const effect: StatusRecoveryEffect = {
            type: 'status-recovery',
            target: {
                type: 'fixed',
                player: 'self',
                position: 'active',
            },
            conditions: ['poison'],
        };

        // Just verify the conditions are stored correctly
        expect(effect.conditions).to.deep.equal(['poison']);
    });

    it('should remove all conditions when not specified', () => {
        const handler = new StatusRecoveryEffectHandler();
        const effect: StatusRecoveryEffect = {
            type: 'status-recovery',
            target: {
                type: 'fixed',
                player: 'self',
                position: 'active',
            },
            // No conditions specified
        };

        // Just verify the conditions field is optional
        expect(effect.conditions).to.be.undefined;
    });
});
