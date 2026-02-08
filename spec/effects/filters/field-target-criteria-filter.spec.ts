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

        it('should filter by stage - basic only', () => {
            const cardRepository = new MockCardRepository();
            const handlerData = HandlerDataBuilder.default();
            
            // Set up field: Basic, Stage 1, and Stage 2 creatures
            const basic = { templateId: 'basic-creature', type: 'creature' as const, instanceId: '1', damageTaken: 0 };
            const stage1 = { templateId: 'evolution-creature', type: 'creature' as const, instanceId: '2', damageTaken: 0 };
            const stage2 = { templateId: 'stage-2-creature', type: 'creature' as const, instanceId: '3', damageTaken: 0 };
            const field = [ basic, stage1, stage2 ];
            
            const result = FieldTargetCriteriaFilter.filter(
                field as unknown as (FieldCard | undefined)[],
                { fieldCriteria: { cardCriteria: { stage: 0 }}},
                handlerData,
                cardRepository,
                0,
            );

            expect(result.length).to.equal(1);
            expect(result[0].fieldIndex).to.equal(0);
        });

        it('should filter by stage - stage 1 only', () => {
            const cardRepository = new MockCardRepository();
            const handlerData = HandlerDataBuilder.default();
            
            // Set up field: Basic, Stage 1, and Stage 2 creatures
            const basic = { templateId: 'basic-creature', type: 'creature' as const, instanceId: '1', damageTaken: 0 };
            const stage1 = { templateId: 'evolution-creature', type: 'creature' as const, instanceId: '2', damageTaken: 0 };
            const stage2 = { templateId: 'stage-2-creature', type: 'creature' as const, instanceId: '3', damageTaken: 0 };
            const field = [ basic, stage1, stage2 ];
            
            const result = FieldTargetCriteriaFilter.filter(
                field as unknown as (FieldCard | undefined)[],
                { fieldCriteria: { cardCriteria: { stage: 1 }}},
                handlerData,
                cardRepository,
                0,
            );

            expect(result.length).to.equal(1);
            expect(result[0].fieldIndex).to.equal(1);
        });

        it('should filter by stage - stage 2 only', () => {
            const cardRepository = new MockCardRepository();
            const handlerData = HandlerDataBuilder.default();
            
            // Set up field: Basic, Stage 1, and Stage 2 creatures
            const basic = { templateId: 'basic-creature', type: 'creature' as const, instanceId: '1', damageTaken: 0 };
            const stage1 = { templateId: 'evolution-creature', type: 'creature' as const, instanceId: '2', damageTaken: 0 };
            const stage2 = { templateId: 'stage-2-creature', type: 'creature' as const, instanceId: '3', damageTaken: 0 };
            const field = [ basic, stage1, stage2 ];
            
            const result = FieldTargetCriteriaFilter.filter(
                field as unknown as (FieldCard | undefined)[],
                { fieldCriteria: { cardCriteria: { stage: 2 }}},
                handlerData,
                cardRepository,
                0,
            );

            expect(result.length).to.equal(1);
            expect(result[0].fieldIndex).to.equal(2);
        });

        it('should filter by hasTool - creatures with tools only', () => {
            const cardRepository = new MockCardRepository();
            
            // Set up creatures
            const creature1 = { templateId: 'basic-creature', type: 'creature' as const, instanceId: '1', damageTaken: 0 };
            const creature2 = { templateId: 'basic-creature', type: 'creature' as const, instanceId: '2', damageTaken: 0 };
            const creature3 = { templateId: 'basic-creature', type: 'creature' as const, instanceId: '3', damageTaken: 0 };
            const field = [ creature1, creature2, creature3 ];
            
            // Set up tool attachment: creature1 and creature3 have tools
            const handlerData = HandlerDataBuilder.default(
                HandlerDataBuilder.withTools({
                    1: { templateId: 'test-tool', instanceId: 'tool-1' },
                    3: { templateId: 'test-tool', instanceId: 'tool-2' },
                }),
            );
            
            const result = FieldTargetCriteriaFilter.filter(
                field as unknown as (FieldCard | undefined)[],
                { fieldCriteria: { hasTool: true }},
                handlerData,
                cardRepository,
                0,
            );

            expect(result.length).to.equal(2);
            expect(result[0].fieldIndex).to.equal(0);
            expect(result[1].fieldIndex).to.equal(2);
        });

        it('should filter by hasTool - no creatures with tools', () => {
            const cardRepository = new MockCardRepository();
            
            // Set up creatures without tools
            const creature1 = { templateId: 'basic-creature', type: 'creature' as const, instanceId: '1', damageTaken: 0 };
            const creature2 = { templateId: 'basic-creature', type: 'creature' as const, instanceId: '2', damageTaken: 0 };
            const field = [ creature1, creature2 ];
            
            const handlerData = HandlerDataBuilder.default();
            
            const result = FieldTargetCriteriaFilter.filter(
                field as unknown as (FieldCard | undefined)[],
                { fieldCriteria: { hasTool: true }},
                handlerData,
                cardRepository,
                0,
            );

            expect(result.length).to.equal(0);
        });
    });
});

