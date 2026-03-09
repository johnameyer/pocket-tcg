import { Message } from '@cards-ts/core';

/**
 * Response message for voluntarily discarding a fossil from the bench.
 * Fossils can be discarded at any time by the player without awarding points to the opponent.
 */
export class DiscardFossilResponseMessage extends Message {
    readonly type = 'discard-fossil-response';

    /**
     * @param benchIndex The 0-based index into the bench (position 0 = first bench slot)
     */
    constructor(public readonly benchIndex: number) {
        super([ `Chose to discard fossil at bench position ${benchIndex}` ]);
    }
}
