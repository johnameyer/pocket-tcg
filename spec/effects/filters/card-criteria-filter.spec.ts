import { expect } from 'chai';
import { CardCriteriaFilter } from '../../../src/effects/filters/card-criteria-filter.js';
import { GameCard } from '../../../src/controllers/card-types.js';
import { MockCardRepository } from '../../mock-repository.js';

describe('CardCriteriaFilter', () => {
    describe('filter', () => {
        it('should return all cards when criteria is undefined', () => {
            const cardRepository = new MockCardRepository();
            const cards: GameCard[] = [
                { instanceId: '1', type: 'item', templateId: 'item-1' },
                { instanceId: '2', type: 'supporter', templateId: 'supporter-1' },
                { instanceId: '3', type: 'creature', templateId: 'basic-creature' },
            ];

            const result = CardCriteriaFilter.filter(cards, undefined, cardRepository);

            expect(result.length).to.equal(3);
        });

        it('should return all cards when criteria is empty', () => {
            const cardRepository = new MockCardRepository();
            const cards: GameCard[] = [
                { instanceId: '1', type: 'item', templateId: 'item-1' },
                { instanceId: '2', type: 'supporter', templateId: 'supporter-1' },
            ];

            const result = CardCriteriaFilter.filter(cards, {}, cardRepository);

            expect(result.length).to.equal(2);
        });

        it('should filter by card type', () => {
            const cardRepository = new MockCardRepository();
            const cards: GameCard[] = [
                { instanceId: '1', type: 'item', templateId: 'item-1' },
                { instanceId: '2', type: 'supporter', templateId: 'supporter-1' },
                { instanceId: '3', type: 'item', templateId: 'item-2' },
            ];

            const result = CardCriteriaFilter.filter(
                cards,
                { cardType: 'item' },
                cardRepository,
            );

            expect(result.length).to.equal(2);
            expect(result.every(c => c.type === 'item')).to.be.true;
        });

        it('should filter trainer cards (item or supporter)', () => {
            const cardRepository = new MockCardRepository();
            const cards: GameCard[] = [
                { instanceId: '1', type: 'item', templateId: 'item-1' },
                { instanceId: '2', type: 'supporter', templateId: 'supporter-1' },
                { instanceId: '3', type: 'creature', templateId: 'basic-creature' },
            ];

            const result = CardCriteriaFilter.filter(
                cards,
                { cardType: 'trainer' },
                cardRepository,
            );

            expect(result.length).to.equal(2);
            expect(result.every(c => c.type === 'item' || c.type === 'supporter')).to.be.true;
        });

        it('should return empty array when no cards match criteria', () => {
            const cardRepository = new MockCardRepository();
            const cards: GameCard[] = [
                { instanceId: '1', type: 'creature', templateId: 'basic-creature' },
            ];

            const result = CardCriteriaFilter.filter(
                cards,
                { cardType: 'item' },
                cardRepository,
            );

            expect(result.length).to.equal(0);
        });

        it('should return empty array when cards array is empty', () => {
            const cardRepository = new MockCardRepository();
            const cards: GameCard[] = [];

            const result = CardCriteriaFilter.filter(
                cards,
                { cardType: 'item' },
                cardRepository,
            );

            expect(result.length).to.equal(0);
        });
    });
});
