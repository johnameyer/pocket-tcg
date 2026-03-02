import { GenericControllerProvider, GlobalController } from '@cards-ts/core';

export type RandomState = {
    mockedSelections: number[];
    mockedSelectionIndex: number;
};

/**
 * Controller that provides random index selection, supporting mocked results for testing.
 */
export class RandomController extends GlobalController<RandomState, {}> {
    validate() {
        // No validation needed
    }

    /**
     * Pick a random index in the range [0, count).
     * Uses mocked selections if available (FIFO order).
     */
    pickIndex(count: number): number {
        if (count <= 0) {
            throw new Error('count must be positive');
        }
        if (this.state.mockedSelections.length > 0) {
            return this.state.mockedSelections.splice(0, 1)![0] % count;
        }
        return Math.floor(Math.random() * count);
    }

    setMockedSelections(selections: number[]): void {
        this.state.mockedSelections = selections;
        this.state.mockedSelectionIndex = 0;
    }

    clearMockedSelections(): void {
        this.state.mockedSelections = [];
        this.state.mockedSelectionIndex = 0;
    }
}

export class RandomControllerProvider implements GenericControllerProvider<RandomState, {}, RandomController> {
    controller(state: RandomState, controllers: {}): RandomController {
        return new RandomController(state, controllers);
    }

    initialState(): RandomState {
        return {
            mockedSelections: [],
            mockedSelectionIndex: 0,
        };
    }

    dependencies() {
        return {} as const;
    }
}
