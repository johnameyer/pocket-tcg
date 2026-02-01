import { Message, Presentable } from '@cards-ts/core';
import { StatusEffectType } from '../../controllers/status-effect-controller.js';

// TODO use union of strings like elsewhere
export enum StatusEffectRemovalReason {
    COIN_FLIP = 'coin-flip',
    RETREAT = 'retreat', 
    EVOLUTION = 'evolution',
    TURN_END = 'turn-end',
    CARD_EFFECT = 'card-effect',
}

function generateMessage(fieldCardName: string, effect: StatusEffectType, playerId: number, reason: StatusEffectRemovalReason): Presentable[] {
    const reasonText = reason === StatusEffectRemovalReason.COIN_FLIP ? 'due to coin flip' 
        : reason === StatusEffectRemovalReason.RETREAT ? 'due to retreating'
            : reason === StatusEffectRemovalReason.EVOLUTION ? 'due to evolution'
                : reason === StatusEffectRemovalReason.TURN_END ? 'at turn end' : 'due to card effect';
    return [ `${fieldCardName} (Player ${playerId + 1}) is no longer ${effect} ${reasonText}.` ];
}

/**
 * Class that shows when a status effect is removed from a FieldCard
 */
export class StatusEffectRemovedMessage extends Message {
    public readonly type = 'status-effect-removed';

    /**
     * @param playerId the player whose FieldCard was affected
     * @param fieldCardName the name of the affected FieldCard
     * @param effect the status effect that was removed
     * @param reason the reason the effect was removed
     */
    constructor(
        public readonly playerId: number,
        public readonly fieldCardName: string,
        public readonly effect: StatusEffectType,
        public readonly reason: StatusEffectRemovalReason,
    ) {
        super(generateMessage(fieldCardName, effect, playerId, reason));
    }
}
