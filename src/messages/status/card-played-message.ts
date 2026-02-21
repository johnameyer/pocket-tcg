import { Message, Presentable } from '@cards-ts/core';

function generateMessage(playerNumber: number, cardName: string, target?: string): Presentable[] {
    if (target) {
        return [ `Player ${playerNumber} played ${cardName} to ${target}!` ];
    }
    return [ `Player ${playerNumber} played ${cardName}!` ];
}

/**
 * Class that displays when a card is played
 */
export class CardPlayedMessage extends Message {

    public readonly type = 'card-played-message';

    /**
     * @param playerNumber the player number (1-indexed)
     * @param cardName the name of the card played
     * @param target optional target description (e.g., "the bench" or creature name)
     */
    constructor(
        public readonly playerNumber: number,
        public readonly cardName: string,
        public readonly target?: string,
    ) {
        super(generateMessage(playerNumber, cardName, target));
    }
}
