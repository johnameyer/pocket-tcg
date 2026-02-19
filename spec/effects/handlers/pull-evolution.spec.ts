import { expect } from 'chai';
import { HandlerDataBuilder } from '../../helpers/handler-data-builder.js';
import { PullEvolutionEffectHandler } from '../../../src/effects/handlers/pull-evolution-effect-handler.js';
import { EffectContextFactory } from '../../../src/effects/effect-context.js';
import { PullEvolutionEffect } from '../../../src/repository/effect-types.js';
import { MockCardRepository } from '../../mock-repository.js';
import { FieldTarget } from '../../../src/index.js';

describe('Pull Evolution Effect', () => {
    describe('canApply', () => {
        const handler = new PullEvolutionEffectHandler();
        const mockRepository = new MockCardRepository();

        it('should return true when target creature exists', () => {
            const handlerData = HandlerDataBuilder.default(
                HandlerDataBuilder.withCreatures(0, 'basic-creature', []),
                HandlerDataBuilder.withCreatures(1, 'basic-creature', []),
            );

            const effect: PullEvolutionEffect = {
                type: 'pull-evolution',
                target: { type: 'fixed', player: 'self', position: 'active' },
                evolutionCriteria: { cardType: 'creature', stage: 2 },
            };

            const context = EffectContextFactory.createCardContext(0, 'Test Pull Evolution', 'item');
            const result = handler.canApply(handlerData, effect, context, mockRepository);
            
            expect(result).to.be.true;
        });

        it('should return false when target creature does not exist', () => {
            const handlerData = HandlerDataBuilder.default(
                HandlerDataBuilder.withCreatures(1, 'basic-creature', []),
            );

            const effect: PullEvolutionEffect = {
                type: 'pull-evolution',
                target: { type: 'fixed', player: 'self', position: 'active' },
            };

            const context = EffectContextFactory.createCardContext(0, 'Test Pull Evolution', 'item');
            const result = handler.canApply(handlerData, effect, context, mockRepository);
            
            expect(result).to.be.false;
        });

        it('should return false when no target is specified', () => {
            const handlerData = HandlerDataBuilder.default(
                HandlerDataBuilder.withCreatures(0, 'basic-creature', []),
            );

            const effect: PullEvolutionEffect = {
                type: 'pull-evolution',
                target: undefined as unknown as FieldTarget,
            };

            const context = EffectContextFactory.createCardContext(0, 'Test Pull Evolution', 'item');
            const result = handler.canApply(handlerData, effect, context, mockRepository);
            
            expect(result).to.be.false;
        });
    });

    describe('getResolutionRequirements', () => {
        const handler = new PullEvolutionEffectHandler();

        it('should require target resolution', () => {
            const effect: PullEvolutionEffect = {
                type: 'pull-evolution',
                target: { type: 'fixed', player: 'self', position: 'active' },
            };

            const requirements = handler.getResolutionRequirements(effect);
            
            expect(requirements).to.have.length(1);
            expect(requirements[0].targetProperty).to.equal('target');
            expect(requirements[0].required).to.be.true;
        });
    });

    // Note: Full implementation tests would go here
    // Currently, the handler only displays messages without actual implementation
});
