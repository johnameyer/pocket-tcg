import { GenericControllerProvider, GlobalController, Serializable } from '@cards-ts/core';
import { CoinFlipState } from '../../src/controllers/coinflip-controller.js';

// TODO: Same file as controller following normal pattern for controllers
interface MockCoinFlipState extends CoinFlipState {
    [key: string]: Serializable;
    mockCoinFlipResults?: boolean[];
    mockCoinFlipIndex?: number;
}

export class MockCoinFlipController extends GlobalController<MockCoinFlipState, {}> {
    validate() {
        // No validation needed for mock
    }

    public flip(): boolean {
        if (this.state.mockedResults && this.state.mockedResults.length > 0) {
            const result = this.state.mockedResults[this.state.mockedResultIndex % this.state.mockedResults.length];
            this.state.mockedResultIndex++;
            return result;
        }
        return Math.random() < 0.5;
    }
}

export class MockCoinFlipControllerProvider implements GenericControllerProvider<MockCoinFlipState, {}, MockCoinFlipController> {
    controller(state: MockCoinFlipState, controllers: {}): MockCoinFlipController {
        return new MockCoinFlipController(state, controllers);
    }

    initialState(): MockCoinFlipState {
        return {
            nextFlipGuaranteedHeads: false,
            mockedResults: [],
            mockedResultIndex: 0,
            mockCoinFlipResults: undefined,
            mockCoinFlipIndex: 0
        };
    }

    dependencies() {
        return {} as const;
    }
}
