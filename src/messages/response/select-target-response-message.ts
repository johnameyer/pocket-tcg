import { Message } from '@cards-ts/core';

/**
 * Response message for selecting target(s) on the field.
 * Supports both single and multiple target selection.
 */
export class SelectTargetResponseMessage extends Message {
    readonly type = 'select-target-response';

    constructor(
        public readonly targets: Array<{ playerId: number; fieldIndex: number }>,
    ) {
        super([ targets.length === 1 
            ? `Selected target: Player ${targets[0].playerId + 1}, position ${targets[0].fieldIndex === 0 ? 'Active' : `Bench ${targets[0].fieldIndex}`}`
            : `Selected ${targets.length} target(s)`
        ]);
    }
    
    // Convenience getters for backwards compatibility with single-target usage
    get targetPlayerId(): number {
        return this.targets[0]?.playerId ?? -1;
    }
    
    get targetCreatureIndex(): number {
        return this.targets[0]?.fieldIndex ?? -1;
    }
}
