import { expect } from 'chai';
import { FieldTargetCriteriaFilter } from '../../../src/effects/filters/field-target-criteria-filter.js';
import { MockCardRepository } from '../../mock-repository.js';
import { HandlerDataBuilder } from '../../helpers/handler-data-builder.js';
import { FieldCard } from '../../../src/controllers/field-controller.js';

describe('FieldTargetCriteriaFilter', () => {
    describe('filter', () => {
        it('should return all creatures when criteria is undefined', () => {
            const cardRepository = new MockCardRepository();
            const handlerData = HandlerDataBuilder.default();
            
            // Set up field with creatures
            const creature1 = { templateId: 'basic-creature', type: 'creature' as const, instanceId: '1', damageTaken: 0 };
            const creature2 = { templateId: 'basic-creature', type: 'creature' as const, instanceId: '2', damageTaken: 0 };
            const field = [ creature1, undefined, creature2 ];
            
            const result = FieldTargetCriteriaFilter.filter(
                field as unknown as (FieldCard | undefined)[],
                undefined,
                handlerData,
                cardRepository,
                0,
            );

            expect(result.length).to.equal(2);
        });

        it('should filter by position - active only', () => {
            const cardRepository = new MockCardRepository();
            const handlerData = HandlerDataBuilder.default();
            
            // Set up field: active + benched creatures
            const active = { templateId: 'basic-creature', type: 'creature' as const, instanceId: '1', damageTaken: 0 };
            const bench1 = { templateId: 'basic-creature', type: 'creature' as const, instanceId: '2', damageTaken: 0 };
            const bench2 = { templateId: 'basic-creature', type: 'creature' as const, instanceId: '3', damageTaken: 0 };
            const field = [ active, bench1, bench2 ];
            
            const result = FieldTargetCriteriaFilter.filter(
                field as unknown as (FieldCard | undefined)[],
                { position: 'active' },
                handlerData,
                cardRepository,
                0,
            );

            expect(result.length).to.equal(1);
            expect(result[0].fieldIndex).to.equal(0);
        });

        it('should filter by position - bench only', () => {
            const cardRepository = new MockCardRepository();
            const handlerData = HandlerDataBuilder.default();
            
            // Set up field: active + benched creatures
            const active = { templateId: 'basic-creature', type: 'creature' as const, instanceId: '1', damageTaken: 0 };
            const bench1 = { templateId: 'basic-creature', type: 'creature' as const, instanceId: '2', damageTaken: 0 };
            const bench2 = { templateId: 'basic-creature', type: 'creature' as const, instanceId: '3', damageTaken: 0 };
            const field = [ active, bench1, bench2 ];
            
            const result = FieldTargetCriteriaFilter.filter(
                field as unknown as (FieldCard | undefined)[],
                { position: 'bench' },
                handlerData,
                cardRepository,
                0,
            );

            expect(result.length).to.equal(2);
            expect(result.every(r => r.fieldIndex > 0)).to.be.true;
        });
    });
});

