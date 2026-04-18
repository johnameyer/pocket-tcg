import { Message, Presentable } from '@cards-ts/core';

export type PlayedCardType = 'creature' | 'item' | 'supporter' | 'tool' | 'stadium';

export type CardPlayedDetails =
    | {
        placement: 'bench';
    }
    | {
        placement: 'discard-after-use';
    }
    | {
        placement: 'tool-attachment';
        targetPlayerId: number;
        targetFieldPosition: number;
        targetCardTemplateId: string;
    }
    | {
        placement: 'stadium';
    };

function generateMessage(playerName: string, cardName: string, details: CardPlayedDetails): Presentable[] {
    if (details.placement === 'bench') {
        return [ `${playerName} played ${cardName} to the bench!` ];
    }
    if (details.placement === 'discard-after-use') {
        return [ `${playerName} played ${cardName}.` ];
    }
    if (details.placement === 'tool-attachment') {
        return [ `${playerName} attached ${cardName} to ${details.targetCardTemplateId}!` ];
    }
    return [ `${playerName} played ${cardName}!` ];
}

export class CardPlayedMessage extends Message {
    public readonly type = 'card-played';

    constructor(
        public readonly playerId: number,
        public readonly playerName: string,
        public readonly cardTemplateId: string,
        public readonly cardName: string,
        public readonly cardType: PlayedCardType,
        public readonly details: CardPlayedDetails,
    ) {
        super(generateMessage(playerName, cardName, details));
    }
}
