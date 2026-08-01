import { expect } from 'chai';
import { FieldTargetCriteriaFilter } from '../../../src/effects/filters/field-target-criteria-filter.js';
import { MockCardRepository } from '../../mock-repository.js';
import { HandlerDataBuilder } from '../../helpers/handler-data-builder.js';
import { FieldCard } from '../../../src/controllers/field-controller.js';
import { StatusEffectType } from '../../../src/controllers/status-effect-controller.js';

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

        it('should filter by hasStatusCondition - active creature with sleep matches', () => {
            const cardRepository = new MockCardRepository();

            const active = { templateId: 'basic-creature', type: 'creature' as const, instanceId: '1', damageTaken: 0 };
            const bench = { templateId: 'basic-creature', type: 'creature' as const, instanceId: '2', damageTaken: 0 };
            const field = [ active, bench ];

            const handlerData = HandlerDataBuilder.default(
                HandlerDataBuilder.withStatusEffects(0, [{ type: StatusEffectType.ASLEEP, appliedTurn: 1 }]),
            );

            const result = FieldTargetCriteriaFilter.filter(
                field as unknown as (FieldCard | undefined)[],
                { fieldCriteria: { hasStatusCondition: [ 'sleep' ] }},
                handlerData,
                cardRepository,
                0,
            );

            expect(result.length).to.equal(1);
            expect(result[0].fieldIndex).to.equal(0);
        });

        it('should filter by hasStatusCondition - benched creatures never match', () => {
            const cardRepository = new MockCardRepository();

            const active = { templateId: 'basic-creature', type: 'creature' as const, instanceId: '1', damageTaken: 0 };
            const bench1 = { templateId: 'basic-creature', type: 'creature' as const, instanceId: '2', damageTaken: 0 };
            const bench2 = { templateId: 'basic-creature', type: 'creature' as const, instanceId: '3', damageTaken: 0 };
            const field = [ active, bench1, bench2 ];

            const handlerData = HandlerDataBuilder.default(
                HandlerDataBuilder.withStatusEffects(0, [{ type: StatusEffectType.ASLEEP, appliedTurn: 1 }]),
            );

            const result = FieldTargetCriteriaFilter.filter(
                field as unknown as (FieldCard | undefined)[],
                { fieldCriteria: { hasStatusCondition: [ 'sleep' ] }},
                handlerData,
                cardRepository,
                0,
            );

            expect(result.length).to.equal(1);
            expect(result[0].fieldIndex).to.equal(0);
        });

        it('should filter by hasStatusCondition - no match when creature has no status condition', () => {
            const cardRepository = new MockCardRepository();
            const handlerData = HandlerDataBuilder.default();

            const active = { templateId: 'basic-creature', type: 'creature' as const, instanceId: '1', damageTaken: 0 };
            const bench = { templateId: 'basic-creature', type: 'creature' as const, instanceId: '2', damageTaken: 0 };
            const field = [ active, bench ];

            const result = FieldTargetCriteriaFilter.filter(
                field as unknown as (FieldCard | undefined)[],
                { fieldCriteria: { hasStatusCondition: [ 'sleep' ] }},
                handlerData,
                cardRepository,
                0,
            );

            expect(result.length).to.equal(0);
        });

        it('should filter by hasStatusCondition - matches any of the provided conditions', () => {
            const cardRepository = new MockCardRepository();

            const active = { templateId: 'basic-creature', type: 'creature' as const, instanceId: '1', damageTaken: 0 };
            const bench = { templateId: 'basic-creature', type: 'creature' as const, instanceId: '2', damageTaken: 0 };
            const field = [ active, bench ];

            const handlerData = HandlerDataBuilder.default(
                HandlerDataBuilder.withStatusEffects(0, [{ type: StatusEffectType.POISONED, appliedTurn: 1 }]),
            );

            const result = FieldTargetCriteriaFilter.filter(
                field as unknown as (FieldCard | undefined)[],
                { fieldCriteria: { hasStatusCondition: [ 'sleep', 'poison' ] }},
                handlerData,
                cardRepository,
                0,
            );

            expect(result.length).to.equal(1);
            expect(result[0].fieldIndex).to.equal(0);
        });

        it('should filter by hasStatusCondition - no match when condition differs', () => {
            const cardRepository = new MockCardRepository();

            const active = { templateId: 'basic-creature', type: 'creature' as const, instanceId: '1', damageTaken: 0 };
            const bench = { templateId: 'basic-creature', type: 'creature' as const, instanceId: '2', damageTaken: 0 };
            const field = [ active, bench ];

            const handlerData = HandlerDataBuilder.default(
                HandlerDataBuilder.withStatusEffects(0, [{ type: StatusEffectType.POISONED, appliedTurn: 1 }]),
            );

            const result = FieldTargetCriteriaFilter.filter(
                field as unknown as (FieldCard | undefined)[],
                { fieldCriteria: { hasStatusCondition: [ 'sleep' ] }},
                handlerData,
                cardRepository,
                0,
            );

            expect(result.length).to.equal(0);
        });

        it('should filter by stage using NumberFilter - array of stages', () => {
            const cardRepository = new MockCardRepository();
            const handlerData = HandlerDataBuilder.default();
            
            // Set up field: Basic, Stage 1, and Stage 2 creatures
            const basic = { templateId: 'basic-creature', type: 'creature' as const, instanceId: '1', damageTaken: 0 };
            const stage1 = { templateId: 'evolution-creature', type: 'creature' as const, instanceId: '2', damageTaken: 0 };
            const stage2 = { templateId: 'stage-2-creature', type: 'creature' as const, instanceId: '3', damageTaken: 0 };
            const field = [ basic, stage1, stage2 ];
            
            const result = FieldTargetCriteriaFilter.filter(
                field as unknown as (FieldCard | undefined)[],
                { fieldCriteria: { cardCriteria: { stage: [ 1, 2 ] }}},
                handlerData,
                cardRepository,
                0,
            );

            expect(result.length).to.equal(2);
            expect(result[0].fieldIndex).to.equal(1);
            expect(result[1].fieldIndex).to.equal(2);
        });

        it('should filter by stage using NumberFilter - min stage', () => {
            const cardRepository = new MockCardRepository();
            const handlerData = HandlerDataBuilder.default();
            
            // Set up field: Basic, Stage 1, and Stage 2 creatures
            const basic = { templateId: 'basic-creature', type: 'creature' as const, instanceId: '1', damageTaken: 0 };
            const stage1 = { templateId: 'evolution-creature', type: 'creature' as const, instanceId: '2', damageTaken: 0 };
            const stage2 = { templateId: 'stage-2-creature', type: 'creature' as const, instanceId: '3', damageTaken: 0 };
            const field = [ basic, stage1, stage2 ];
            
            const result = FieldTargetCriteriaFilter.filter(
                field as unknown as (FieldCard | undefined)[],
                { fieldCriteria: { cardCriteria: { stage: { min: 1 }}}},
                handlerData,
                cardRepository,
                0,
            );

            expect(result.length).to.equal(2);
            expect(result[0].fieldIndex).to.equal(1);
            expect(result[1].fieldIndex).to.equal(2);
        });

        it('should filter by stage using NumberFilter - max stage', () => {
            const cardRepository = new MockCardRepository();
            const handlerData = HandlerDataBuilder.default();
            
            // Set up field: Basic, Stage 1, and Stage 2 creatures
            const basic = { templateId: 'basic-creature', type: 'creature' as const, instanceId: '1', damageTaken: 0 };
            const stage1 = { templateId: 'evolution-creature', type: 'creature' as const, instanceId: '2', damageTaken: 0 };
            const stage2 = { templateId: 'stage-2-creature', type: 'creature' as const, instanceId: '3', damageTaken: 0 };
            const field = [ basic, stage1, stage2 ];
            
            const result = FieldTargetCriteriaFilter.filter(
                field as unknown as (FieldCard | undefined)[],
                { fieldCriteria: { cardCriteria: { stage: { max: 1 }}}},
                handlerData,
                cardRepository,
                0,
            );

            expect(result.length).to.equal(2);
            expect(result[0].fieldIndex).to.equal(0);
            expect(result[1].fieldIndex).to.equal(1);
        });

        it('should filter by maxHp - exact value', () => {
            const cardRepository = new MockCardRepository();
            const handlerData = HandlerDataBuilder.default();
            
            // basic-creature: 60 HP, high-hp-creature: 180 HP
            const basic = { templateId: 'basic-creature', type: 'creature' as const, instanceId: '1', damageTaken: 0 };
            const highHp = { templateId: 'high-hp-creature', type: 'creature' as const, instanceId: '2', damageTaken: 0 };
            const field = [ basic, highHp ];
            
            const result = FieldTargetCriteriaFilter.filter(
                field as unknown as (FieldCard | undefined)[],
                { fieldCriteria: { cardCriteria: { maxHp: 60 }}},
                handlerData,
                cardRepository,
                0,
            );

            expect(result.length).to.equal(1);
            expect(result[0].fieldIndex).to.equal(0);
        });

        it('should filter by maxHp - max threshold', () => {
            const cardRepository = new MockCardRepository();
            const handlerData = HandlerDataBuilder.default();
            
            // basic-creature: 60 HP, evolution-creature: 120 HP, high-hp-creature: 180 HP
            const basic = { templateId: 'basic-creature', type: 'creature' as const, instanceId: '1', damageTaken: 0 };
            const evolution = { templateId: 'evolution-creature', type: 'creature' as const, instanceId: '2', damageTaken: 0 };
            const highHp = { templateId: 'high-hp-creature', type: 'creature' as const, instanceId: '3', damageTaken: 0 };
            const field = [ basic, evolution, highHp ];
            
            const result = FieldTargetCriteriaFilter.filter(
                field as unknown as (FieldCard | undefined)[],
                { fieldCriteria: { cardCriteria: { maxHp: { max: 120 }}}},
                handlerData,
                cardRepository,
                0,
            );

            expect(result.length).to.equal(2);
            expect(result[0].fieldIndex).to.equal(0);
            expect(result[1].fieldIndex).to.equal(1);
        });

        it('should filter by maxHp - min threshold', () => {
            const cardRepository = new MockCardRepository();
            const handlerData = HandlerDataBuilder.default();
            
            // basic-creature: 60 HP, evolution-creature: 120 HP, high-hp-creature: 180 HP
            const basic = { templateId: 'basic-creature', type: 'creature' as const, instanceId: '1', damageTaken: 0 };
            const evolution = { templateId: 'evolution-creature', type: 'creature' as const, instanceId: '2', damageTaken: 0 };
            const highHp = { templateId: 'high-hp-creature', type: 'creature' as const, instanceId: '3', damageTaken: 0 };
            const field = [ basic, evolution, highHp ];
            
            const result = FieldTargetCriteriaFilter.filter(
                field as unknown as (FieldCard | undefined)[],
                { fieldCriteria: { cardCriteria: { maxHp: { min: 120 }}}},
                handlerData,
                cardRepository,
                0,
            );

            expect(result.length).to.equal(2);
            expect(result[0].fieldIndex).to.equal(1);
            expect(result[1].fieldIndex).to.equal(2);
        });

        it('should filter by retreatCost - exact value', () => {
            const cardRepository = new MockCardRepository();
            const handlerData = HandlerDataBuilder.default();
            
            // basic-creature: 1 retreat, evolution-creature: 2 retreat, tank-creature: 3 retreat
            const basic = { templateId: 'basic-creature', type: 'creature' as const, instanceId: '1', damageTaken: 0 };
            const evolution = { templateId: 'evolution-creature', type: 'creature' as const, instanceId: '2', damageTaken: 0 };
            const tank = { templateId: 'tank-creature', type: 'creature' as const, instanceId: '3', damageTaken: 0 };
            const field = [ basic, evolution, tank ];
            
            const result = FieldTargetCriteriaFilter.filter(
                field as unknown as (FieldCard | undefined)[],
                { fieldCriteria: { cardCriteria: { retreatCost: 2 }}},
                handlerData,
                cardRepository,
                0,
            );

            expect(result.length).to.equal(1);
            expect(result[0].fieldIndex).to.equal(1);
        });

        it('should filter by retreatCost - min threshold', () => {
            const cardRepository = new MockCardRepository();
            const handlerData = HandlerDataBuilder.default();
            
            // basic-creature: 1 retreat, evolution-creature: 2 retreat, tank-creature: 3 retreat
            const basic = { templateId: 'basic-creature', type: 'creature' as const, instanceId: '1', damageTaken: 0 };
            const evolution = { templateId: 'evolution-creature', type: 'creature' as const, instanceId: '2', damageTaken: 0 };
            const tank = { templateId: 'tank-creature', type: 'creature' as const, instanceId: '3', damageTaken: 0 };
            const field = [ basic, evolution, tank ];
            
            const result = FieldTargetCriteriaFilter.filter(
                field as unknown as (FieldCard | undefined)[],
                { fieldCriteria: { cardCriteria: { retreatCost: { min: 3 }}}},
                handlerData,
                cardRepository,
                0,
            );

            expect(result.length).to.equal(1);
            expect(result[0].fieldIndex).to.equal(2);
        });

        it('should filter by retreatCost - array of values', () => {
            const cardRepository = new MockCardRepository();
            const handlerData = HandlerDataBuilder.default();
            
            // basic-creature: 1 retreat, evolution-creature: 2 retreat, tank-creature: 3 retreat
            const basic = { templateId: 'basic-creature', type: 'creature' as const, instanceId: '1', damageTaken: 0 };
            const evolution = { templateId: 'evolution-creature', type: 'creature' as const, instanceId: '2', damageTaken: 0 };
            const tank = { templateId: 'tank-creature', type: 'creature' as const, instanceId: '3', damageTaken: 0 };
            const field = [ basic, evolution, tank ];
            
            const result = FieldTargetCriteriaFilter.filter(
                field as unknown as (FieldCard | undefined)[],
                { fieldCriteria: { cardCriteria: { retreatCost: [ 1, 3 ] }}},
                handlerData,
                cardRepository,
                0,
            );

            expect(result.length).to.equal(2);
            expect(result[0].fieldIndex).to.equal(0);
            expect(result[1].fieldIndex).to.equal(2);
        });

        it('should filter by card name for in-play creatures', () => {
            const cardRepository = new MockCardRepository();
            const handlerData = HandlerDataBuilder.default();

            const basic = { templateId: 'basic-creature', type: 'creature' as const, instanceId: '1', damageTaken: 0 };
            const evolution = { templateId: 'evolution-creature', type: 'creature' as const, instanceId: '2', damageTaken: 0 };
            const tank = { templateId: 'tank-creature', type: 'creature' as const, instanceId: '3', damageTaken: 0 };
            const field = [ basic, evolution, tank ];

            const result = FieldTargetCriteriaFilter.filter(
                field as unknown as (FieldCard | undefined)[],
                { fieldCriteria: { cardCriteria: { name: [ 'Evolution Creature' ] }}},
                handlerData,
                cardRepository,
                0,
            );

            expect(result.length).to.equal(1);
            expect(result[0].fieldIndex).to.equal(1);
        });

        it('should filter by card name case-insensitively for in-play creatures', () => {
            const cardRepository = new MockCardRepository();
            const handlerData = HandlerDataBuilder.default();

            const basic = { templateId: 'basic-creature', type: 'creature' as const, instanceId: '1', damageTaken: 0 };
            const evolution = { templateId: 'evolution-creature', type: 'creature' as const, instanceId: '2', damageTaken: 0 };
            const field = [ basic, evolution ];

            const result = FieldTargetCriteriaFilter.filter(
                field as unknown as (FieldCard | undefined)[],
                { fieldCriteria: { cardCriteria: { name: [ 'evolution creature' ] }}},
                handlerData,
                cardRepository,
                0,
            );

            expect(result.length).to.equal(1);
            expect(result[0].fieldIndex).to.equal(1);
        });
    });

    describe('hasAbility criteria', () => {
        const cardRepository = new MockCardRepository({
            creatures: {
                'creature-with-ability': {
                    templateId: 'creature-with-ability',
                    name: 'Creature With Ability',
                    maxHp: 80,
                    type: 'psychic',
                    weakness: 'darkness',
                    retreatCost: 1,
                    attacks: [{ name: 'Psi Bolt', damage: 30, energyRequirements: [{ type: 'psychic', amount: 1 }] }],
                    ability: {
                        name: 'Mind Guard',
                        trigger: { type: 'passive' },
                        effects: [],
                    },
                },
                'creature-with-named-ability': {
                    templateId: 'creature-with-named-ability',
                    name: 'Creature With Named Ability',
                    maxHp: 70,
                    type: 'water',
                    weakness: 'lightning',
                    retreatCost: 1,
                    attacks: [{ name: 'Splash', damage: 10, energyRequirements: [{ type: 'water', amount: 1 }] }],
                    ability: {
                        name: 'Torrent',
                        trigger: { type: 'passive' },
                        effects: [],
                    },
                },
            },
        });

        it('should match creatures that have any ability when hasAbility is true', () => {
            const handlerData = HandlerDataBuilder.default();
            const withAbility = { templateId: 'creature-with-ability', type: 'creature' as const, instanceId: '1', damageTaken: 0 };
            const withoutAbility = { templateId: 'basic-creature', type: 'creature' as const, instanceId: '2', damageTaken: 0 };
            const field = [ withAbility, withoutAbility ];

            const result = FieldTargetCriteriaFilter.filter(
                field as unknown as (FieldCard | undefined)[],
                { fieldCriteria: { hasAbility: true }},
                handlerData,
                cardRepository,
                0,
            );

            expect(result.length).to.equal(1);
            expect(result[0].card.templateId).to.equal('creature-with-ability');
        });

        it('should match creatures with no ability when hasAbility is false', () => {
            const handlerData = HandlerDataBuilder.default();
            const withAbility = { templateId: 'creature-with-ability', type: 'creature' as const, instanceId: '1', damageTaken: 0 };
            const withoutAbility = { templateId: 'basic-creature', type: 'creature' as const, instanceId: '2', damageTaken: 0 };
            const field = [ withAbility, withoutAbility ];

            const result = FieldTargetCriteriaFilter.filter(
                field as unknown as (FieldCard | undefined)[],
                { fieldCriteria: { hasAbility: false }},
                handlerData,
                cardRepository,
                0,
            );

            expect(result.length).to.equal(1);
            expect(result[0].card.templateId).to.equal('basic-creature');
        });

        it('should match creatures whose ability name matches exactly when hasAbility is a string', () => {
            const handlerData = HandlerDataBuilder.default();
            const withAbility = { templateId: 'creature-with-ability', type: 'creature' as const, instanceId: '1', damageTaken: 0 };
            const withNamedAbility = { templateId: 'creature-with-named-ability', type: 'creature' as const, instanceId: '2', damageTaken: 0 };
            const withoutAbility = { templateId: 'basic-creature', type: 'creature' as const, instanceId: '3', damageTaken: 0 };
            const field = [ withAbility, withNamedAbility, withoutAbility ];

            const result = FieldTargetCriteriaFilter.filter(
                field as unknown as (FieldCard | undefined)[],
                { fieldCriteria: { hasAbility: 'Torrent' }},
                handlerData,
                cardRepository,
                0,
            );

            expect(result.length).to.equal(1);
            expect(result[0].card.templateId).to.equal('creature-with-named-ability');
        });
    });

    describe('hasMove criteria', () => {
        const sharedMoveName = 'Pack Strike';
        const cardRepository = new MockCardRepository({
            creatures: {
                'creature-with-shared-move': {
                    templateId: 'creature-with-shared-move',
                    name: 'Creature With Shared Move',
                    maxHp: 60,
                    type: 'colorless',
                    weakness: 'fighting',
                    retreatCost: 1,
                    attacks: [{ name: sharedMoveName, damage: 20, energyRequirements: [{ type: 'colorless', amount: 1 }] }],
                },
                'creature-with-other-move': {
                    templateId: 'creature-with-other-move',
                    name: 'Creature With Other Move',
                    maxHp: 60,
                    type: 'colorless',
                    weakness: 'fighting',
                    retreatCost: 1,
                    attacks: [{ name: 'Tackle', damage: 10, energyRequirements: [{ type: 'colorless', amount: 1 }] }],
                },
            },
        });

        it('should match creatures that have any of the given attack names when hasMove is an array', () => {
            const handlerData = HandlerDataBuilder.default();
            const withShared = { templateId: 'creature-with-shared-move', type: 'creature' as const, instanceId: '1', damageTaken: 0 };
            const withOther = { templateId: 'creature-with-other-move', type: 'creature' as const, instanceId: '2', damageTaken: 0 };
            const field = [ withShared, withOther ];

            const result = FieldTargetCriteriaFilter.filter(
                field as unknown as (FieldCard | undefined)[],
                { fieldCriteria: { hasMove: [ sharedMoveName, 'Tackle' ] }},
                handlerData,
                cardRepository,
                0,
            );

            expect(result.length).to.equal(2);
        });

        it('should match creatures whose attack name matches exactly when hasMove is a string', () => {
            const handlerData = HandlerDataBuilder.default();
            const withShared = { templateId: 'creature-with-shared-move', type: 'creature' as const, instanceId: '1', damageTaken: 0 };
            const withOther = { templateId: 'creature-with-other-move', type: 'creature' as const, instanceId: '2', damageTaken: 0 };
            const field = [ withShared, withOther ];

            const result = FieldTargetCriteriaFilter.filter(
                field as unknown as (FieldCard | undefined)[],
                { fieldCriteria: { hasMove: sharedMoveName }},
                handlerData,
                cardRepository,
                0,
            );

            expect(result.length).to.equal(1);
            expect(result[0].card.templateId).to.equal('creature-with-shared-move');
        });

        it('should not match creatures whose attack name does not match when hasMove is a string', () => {
            const handlerData = HandlerDataBuilder.default();
            const withOther = { templateId: 'creature-with-other-move', type: 'creature' as const, instanceId: '1', damageTaken: 0 };
            const field = [ withOther ];

            const result = FieldTargetCriteriaFilter.filter(
                field as unknown as (FieldCard | undefined)[],
                { fieldCriteria: { hasMove: sharedMoveName }},
                handlerData,
                cardRepository,
                0,
            );

            expect(result.length).to.equal(0);
        });
    });

    describe('hasName criteria', () => {
        const cardRepository = new MockCardRepository({
            creatures: {
                'creature-alpha': {
                    templateId: 'creature-alpha',
                    name: 'Alpha',
                    maxHp: 60,
                    type: 'colorless',
                    weakness: 'fighting',
                    retreatCost: 1,
                    attacks: [],
                },
                'creature-beta': {
                    templateId: 'creature-beta',
                    name: 'Beta',
                    maxHp: 60,
                    type: 'colorless',
                    weakness: 'fighting',
                    retreatCost: 1,
                    attacks: [],
                },
                'creature-gamma': {
                    templateId: 'creature-gamma',
                    name: 'Gamma',
                    maxHp: 60,
                    type: 'colorless',
                    weakness: 'fighting',
                    retreatCost: 1,
                    attacks: [],
                },
            },
        });

        it('should match a creature whose name equals the given string', () => {
            const handlerData = HandlerDataBuilder.default();
            const alpha = { templateId: 'creature-alpha', type: 'creature' as const, instanceId: '1', damageTaken: 0 };
            const beta = { templateId: 'creature-beta', type: 'creature' as const, instanceId: '2', damageTaken: 0 };
            const field = [ alpha, beta ];

            const result = FieldTargetCriteriaFilter.filter(
                field as unknown as (FieldCard | undefined)[],
                { fieldCriteria: { hasName: 'Alpha' }},
                handlerData,
                cardRepository,
                0,
            );

            expect(result.length).to.equal(1);
            expect(result[0].card.templateId).to.equal('creature-alpha');
        });

        it('should match creatures whose name is in the given array', () => {
            const handlerData = HandlerDataBuilder.default();
            const alpha = { templateId: 'creature-alpha', type: 'creature' as const, instanceId: '1', damageTaken: 0 };
            const beta = { templateId: 'creature-beta', type: 'creature' as const, instanceId: '2', damageTaken: 0 };
            const gamma = { templateId: 'creature-gamma', type: 'creature' as const, instanceId: '3', damageTaken: 0 };
            const field = [ alpha, beta, gamma ];

            const result = FieldTargetCriteriaFilter.filter(
                field as unknown as (FieldCard | undefined)[],
                { fieldCriteria: { hasName: [ 'Alpha', 'Gamma' ] }},
                handlerData,
                cardRepository,
                0,
            );

            expect(result.length).to.equal(2);
            expect(result.map(r => r.card.templateId)).to.include.members([ 'creature-alpha', 'creature-gamma' ]);
        });

        it('should not match creatures whose name is not in the given array', () => {
            const handlerData = HandlerDataBuilder.default();
            const beta = { templateId: 'creature-beta', type: 'creature' as const, instanceId: '1', damageTaken: 0 };
            const field = [ beta ];

            const result = FieldTargetCriteriaFilter.filter(
                field as unknown as (FieldCard | undefined)[],
                { fieldCriteria: { hasName: [ 'Alpha', 'Gamma' ] }},
                handlerData,
                cardRepository,
                0,
            );

            expect(result.length).to.equal(0);
        });
    });
});
