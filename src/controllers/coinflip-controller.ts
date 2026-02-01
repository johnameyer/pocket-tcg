import { GenericControllerProvider, GlobalController } from '@cards-ts/core';

export type CoinFlipState = {
    nextFlipGuaranteedHeads: boolean;
    mockedResults: boolean[];
    mockedResultIndex: number;
};

export class CoinFlipController extends GlobalController<CoinFlipState, {}> {
    validate() {
        // No validation needed
    }

    setNextFlipGuaranteedHeads(): void {
        this.state.nextFlipGuaranteedHeads = true;
    }

    setMockedResults(results: boolean[]): void {
        this.state.mockedResults = results;
        this.state.mockedResultIndex = 0;
    }

    performCoinFlip(): boolean {
        /*
         * TODO can we remove mockedResults here since we have the mocked coin flip controller in spec
         * Use mocked results if available (FIFO order)
         */
        if (this.state.mockedResults.length > 0) {
            return this.state.mockedResults.splice(0, 1)![0];
        }

        // Use guaranteed heads if set
        if (this.state.nextFlipGuaranteedHeads) {
            this.state.nextFlipGuaranteedHeads = false;
            return true; // heads
        }

        // Default random flip
        return Math.random() >= 0.5;
    }

    clearGuaranteedHeads(): void {
        this.state.nextFlipGuaranteedHeads = false;
    }

    clearMockedResults(): void {
        this.state.mockedResults = [];
        this.state.mockedResultIndex = 0;
    }
}

export class CoinFlipControllerProvider implements GenericControllerProvider<CoinFlipState, {}, CoinFlipController> {
    controller(state: CoinFlipState, controllers: {}): CoinFlipController {
        return new CoinFlipController(state, controllers);
    }

    initialState(): CoinFlipState {
        return {
            nextFlipGuaranteedHeads: false,
            mockedResults: [],
            mockedResultIndex: 0,
        };
    }

    dependencies() {
        return {} as const;
    }
}
