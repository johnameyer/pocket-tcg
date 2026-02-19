import { expect } from 'chai';
import { NumberFilter } from '../../../src/effects/filters/number-filter.js';

describe('NumberFilter', () => {
    describe('matches', () => {
        describe('undefined filter', () => {
            it('should match any value when filter is undefined', () => {
                expect(NumberFilter.matches(0, undefined)).to.be.true;
                expect(NumberFilter.matches(10, undefined)).to.be.true;
                expect(NumberFilter.matches(100, undefined)).to.be.true;
            });
        });

        describe('exact number match', () => {
            it('should match when value equals the filter', () => {
                expect(NumberFilter.matches(5, 5)).to.be.true;
                expect(NumberFilter.matches(0, 0)).to.be.true;
                expect(NumberFilter.matches(100, 100)).to.be.true;
            });

            it('should not match when value does not equal the filter', () => {
                expect(NumberFilter.matches(5, 6)).to.be.false;
                expect(NumberFilter.matches(0, 1)).to.be.false;
                expect(NumberFilter.matches(100, 99)).to.be.false;
            });
        });

        describe('array of allowed values', () => {
            it('should match when value is in the array', () => {
                expect(NumberFilter.matches(1, [ 0, 1, 2 ])).to.be.true;
                expect(NumberFilter.matches(0, [ 0, 1, 2 ])).to.be.true;
                expect(NumberFilter.matches(2, [ 0, 1, 2 ])).to.be.true;
            });

            it('should not match when value is not in the array', () => {
                expect(NumberFilter.matches(3, [ 0, 1, 2 ])).to.be.false;
                expect(NumberFilter.matches(-1, [ 0, 1, 2 ])).to.be.false;
                expect(NumberFilter.matches(10, [ 0, 1, 2 ])).to.be.false;
            });

            it('should handle empty array', () => {
                expect(NumberFilter.matches(5, [])).to.be.false;
            });

            it('should handle single-element array', () => {
                expect(NumberFilter.matches(5, [ 5 ])).to.be.true;
                expect(NumberFilter.matches(4, [ 5 ])).to.be.false;
            });
        });

        describe('min filter', () => {
            it('should match when value is greater than or equal to min', () => {
                expect(NumberFilter.matches(5, { min: 5 })).to.be.true;
                expect(NumberFilter.matches(6, { min: 5 })).to.be.true;
                expect(NumberFilter.matches(100, { min: 5 })).to.be.true;
            });

            it('should not match when value is less than min', () => {
                expect(NumberFilter.matches(4, { min: 5 })).to.be.false;
                expect(NumberFilter.matches(0, { min: 5 })).to.be.false;
                expect(NumberFilter.matches(-1, { min: 5 })).to.be.false;
            });

            it('should handle zero min', () => {
                expect(NumberFilter.matches(0, { min: 0 })).to.be.true;
                expect(NumberFilter.matches(1, { min: 0 })).to.be.true;
                expect(NumberFilter.matches(-1, { min: 0 })).to.be.false;
            });
        });

        describe('max filter', () => {
            it('should match when value is less than or equal to max', () => {
                expect(NumberFilter.matches(5, { max: 5 })).to.be.true;
                expect(NumberFilter.matches(4, { max: 5 })).to.be.true;
                expect(NumberFilter.matches(0, { max: 5 })).to.be.true;
            });

            it('should not match when value is greater than max', () => {
                expect(NumberFilter.matches(6, { max: 5 })).to.be.false;
                expect(NumberFilter.matches(10, { max: 5 })).to.be.false;
                expect(NumberFilter.matches(100, { max: 5 })).to.be.false;
            });

            it('should handle zero max', () => {
                expect(NumberFilter.matches(0, { max: 0 })).to.be.true;
                expect(NumberFilter.matches(-1, { max: 0 })).to.be.true;
                expect(NumberFilter.matches(1, { max: 0 })).to.be.false;
            });
        });
    });
});
