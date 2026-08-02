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

    describe('findEvolutionIndex', () => {
        const handler = new PullEvolutionEffectHandler();

        const testRepository = new MockCardRepository({
            creatures: {
                'basic-fire': {
                    templateId: 'basic-fire',
                    name: 'Basic Fire',
                    maxHp: 60,
                    type: 'fire',
                    weakness: 'water',
                    retreatCost: 1,
                    attacks: [],
                },
                'fire-evolution': {
                    templateId: 'fire-evolution',
                    name: 'Fire Evolution',
                    maxHp: 100,
                    type: 'fire',
                    weakness: 'water',
                    retreatCost: 2,
                    previousStageName: 'Basic Fire',
                    attacks: [],
                },
                'water-evolution': {
                    templateId: 'water-evolution',
                    name: 'Water Evolution',
                    maxHp: 100,
                    type: 'water',
                    weakness: 'grass',
                    retreatCost: 2,
                    previousStageName: 'Basic Fire',
                    attacks: [],
                },
            },
        });

        const makeCreatureCard = (templateId: string, idx: number) => ({
            instanceId: `${templateId}-${idx}`,
            templateId,
            type: 'creature' as const,
        });

        const makeItemCard = (templateId: string, idx: number) => ({
            instanceId: `${templateId}-${idx}`,
            templateId,
            type: 'item' as const,
        });

        it('should find an evolution card by previousStageName', () => {
            const deck = [
                makeCreatureCard('basic-fire', 0),
                makeCreatureCard('fire-evolution', 1),
            ];
            const result = handler.findEvolutionIndex(deck, 'Basic Fire', undefined, testRepository);
            expect(result).to.equal(1);
        });

        it('should return -1 when no evolution matches previousStageName', () => {
            const deck = [
                makeCreatureCard('basic-fire', 0),
            ];
            const result = handler.findEvolutionIndex(deck, 'Basic Fire', undefined, testRepository);
            expect(result).to.equal(-1);
        });

        it('should skip non-creature cards in the deck', () => {
            const deck = [
                makeItemCard('basic-item', 0),
                makeCreatureCard('fire-evolution', 1),
            ];
            const result = handler.findEvolutionIndex(deck, 'Basic Fire', undefined, testRepository);
            expect(result).to.equal(1);
        });

        it('should respect evolutionCriteria when filtering', () => {
            const deck = [
                makeCreatureCard('fire-evolution', 0),
                makeCreatureCard('water-evolution', 1),
            ];
            const result = handler.findEvolutionIndex(deck, 'Basic Fire', { isType: 'water' }, testRepository);
            expect(result).to.equal(1);
        });

        it('should return -1 when evolutionCriteria filters out all matches', () => {
            const deck = [
                makeCreatureCard('fire-evolution', 0),
            ];
            const result = handler.findEvolutionIndex(deck, 'Basic Fire', { isType: 'water' }, testRepository);
            expect(result).to.equal(-1);
        });
    });
});
