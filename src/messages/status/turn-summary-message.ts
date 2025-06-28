import { Message, Presentable } from '@cards-ts/core';

interface CreatureInfo {
    name: string;
    hp: number;
    maxHp: number;
}

function generateMessage(myCreature: CreatureInfo, opponentCreature: CreatureInfo, myBench: CreatureInfo[], opponentBench: CreatureInfo[], handCards: string, drawnCardName?: string): Presentable[] {
    const components = [
        `Opponent's ${opponentCreature.name}: ${opponentCreature.hp}/${opponentCreature.maxHp} HP`,
        `Your ${myCreature.name}: ${myCreature.hp}/${myCreature.maxHp} HP`
    ];
    
    if (opponentBench.length > 0) {
        components.push(`Opponent's Bench:`);
        opponentBench.forEach(p => components.push(`  ${p.name}: ${p.hp}/${p.maxHp} HP`));
    }
    
    if (myBench.length > 0) {
        components.push(`Your Bench:`);
        myBench.forEach(p => components.push(`  ${p.name}: ${p.hp}/${p.maxHp} HP`));
    }
    
    components.push(`Hand: ${handCards}`);
    
    if (drawnCardName) {
        components.unshift(`You drew ${drawnCardName}`);
    } else if (drawnCardName === null) {
        components.unshift('Your deck is empty!');
    }
    
    return components;
}

/**
 * Class that displays turn summary information
 */
export class TurnSummaryMessage extends Message {

    public readonly type = 'turn-summary-message';

    /**
     * @param myCreature the current player's active creature
     * @param opponentCreature the opponent's active creature
     * @param myBench the current player's bench
     * @param opponentBench the opponent's bench
     * @param handCards the current player's hand as a string
     * @param drawnCardName the name of the drawn card (if any)
     */
    constructor(myCreature: CreatureInfo, opponentCreature: CreatureInfo, myBench: CreatureInfo[], opponentBench: CreatureInfo[], handCards: string, drawnCardName?: string) {
        super(generateMessage(myCreature, opponentCreature, myBench, opponentBench, handCards, drawnCardName));
    }
}
