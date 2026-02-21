import { Message, Presentable } from '@cards-ts/core';

function generateMessage(cardNames: string[]): Presentable[] {
    const components = [ 'You drew:' ];
    cardNames.forEach(name => components.push(`  ${name}`));
    return components;
}

/**
 * Class that displays the initial cards drawn during setup
 */
export class DrawnCardsMessage extends Message {

    public readonly type = 'drawn-cards-message';

    /**
     * @param cardNames the names of the drawn cards
     */
    constructor(public readonly cardNames: string[]) {
        super(generateMessage(cardNames));
    }
}
