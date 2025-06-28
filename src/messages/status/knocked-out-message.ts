import { Message, Presentable } from '@cards-ts/core';

function generateMessage(player: string): Presentable[] {
    return [ `${player}'s card was knocked out!` ];
}

/**
 * Class that denotes that a player's card was knocked out
 */
export class KnockedOutMessage extends Message {

    public readonly type = 'knocked-out-message';

    /**
     * @param player the player whose card was knocked out
     */
    constructor(public readonly player: string) {
        super(generateMessage(player));
    }
}
