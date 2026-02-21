import { Message, Presentable } from '@cards-ts/core';

function generateMessage(cardName: string, playerNumber?: number): Presentable[] {
    if (playerNumber !== undefined) {
        return [ `Player ${playerNumber}'s ${cardName} was knocked out!` ];
    }
    return [ `${cardName} was knocked out!` ];
}

/**
 * Class that denotes that a player's card was knocked out
 */
export class KnockedOutMessage extends Message {

    public readonly type = 'knocked-out-message';

    /**
     * @param cardName the name of the card that was knocked out
     * @param playerNumber optional player number (1-indexed)
     */
    constructor(public readonly cardName: string, public readonly playerNumber?: number) {
        super(generateMessage(cardName, playerNumber));
    }
}
