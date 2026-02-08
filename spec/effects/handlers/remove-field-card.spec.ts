import { expect } from 'chai';
import { HandlerDataBuilder } from '../../helpers/handler-data-builder.js';
import { RemoveFieldCardEffectHandler } from '../../../src/effects/handlers/remove-field-card-effect-handler.js';
import { EffectContextFactory } from '../../../src/effects/effect-context.js';
import { RemoveFieldCardEffect } from '../../../src/repository/effect-types.js';
import { MockCardRepository } from '../../mock-repository.js';

describe('Remove Field Card Effect', () => {
    describe('canApply', () => {
        const handler = new RemoveFieldCardEffectHandler();
        const mockRepository = new MockCardRepository();

        it('should return true when target creature exists', () => {
            const handlerData = HandlerDataBuilder.default(
                HandlerDataBuilder.withCreatures(0, 'basic-creature', []),
                HandlerDataBuilder.withCreatures(1, 'basic-creature', []),
            );

            const effect: RemoveFieldCardEffect = {
                type: 'remove-field-card',
                target: { type: 'fixed', player: 'opponent', position: 'active' },
                destination: 'hand',
            };

            const context = EffectContextFactory.createCardContext(0, 'Test Remove Field Card', 'item');
            const result = handler.canApply(handlerData, effect, context, mockRepository);
            
            expect(result).to.be.true;
        });

        it('should return false when target creature does not exist', () => {
            const handlerData = HandlerDataBuilder.default(
                HandlerDataBuilder.withCreatures(0, 'basic-creature', []),
            );

            const effect: RemoveFieldCardEffect = {
                type: 'remove-field-card',
                target: { type: 'fixed', player: 'opponent', position: 'active' },
                destination: 'hand',
            };

            const context = EffectContextFactory.createCardContext(0, 'Test Remove Field Card', 'item');
            const result = handler.canApply(handlerData, effect, context, mockRepository);
            
            expect(result).to.be.false;
        });

        it('should return false when no target is specified', () => {
            const handlerData = HandlerDataBuilder.default(
                HandlerDataBuilder.withCreatures(0, 'basic-creature', []),
                HandlerDataBuilder.withCreatures(1, 'basic-creature', []),
            );

            const effect: RemoveFieldCardEffect = {
                type: 'remove-field-card',
                target: undefined as any,
                destination: 'hand',
            };

            const context = EffectContextFactory.createCardContext(0, 'Test Remove Field Card', 'item');
            const result = handler.canApply(handlerData, effect, context, mockRepository);
            
            expect(result).to.be.false;
        });
    });

    describe('getResolutionRequirements', () => {
        const handler = new RemoveFieldCardEffectHandler();

        it('should require target resolution', () => {
            const effect: RemoveFieldCardEffect = {
                type: 'remove-field-card',
                target: { type: 'fixed', player: 'opponent', position: 'active' },
                destination: 'hand',
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
