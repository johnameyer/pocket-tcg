import { Message, Presentable } from '@cards-ts/core';

function generateMessage(attackerName: string, attackName: string, damage: number, targetName: string, remainingHp: number, baseAttackDamage?: number): Presentable[] {
    // If the attack naturally does 0 damage, just mention the attack without damage
    if (baseAttackDamage === 0) {
        return [ `${attackerName} used ${attackName}!` ];
    }
    // If damage was reduced to 0, show that
    return [ `${attackerName} used ${attackName} for ${damage} damage! ${targetName} has ${remainingHp} HP remaining.` ];
}

/**
 * Class that shows the result of an attack
 */
export class AttackResultMessage extends Message {

    public readonly type = 'attack-result-message';

    /**
     * @param attackerName the name of the attacking player
     * @param attackName the name of the attack used
     * @param damage the amount of damage dealt
     * @param targetName the name of the target player
     * @param remainingHp the remaining HP of the target
     * @param baseAttackDamage optional base damage of the attack (for 0-damage attacks)
     */
    constructor(
        public readonly attackerName: string,
        public readonly attackName: string,
        public readonly damage: number,
        public readonly targetName: string,
        public readonly remainingHp: number,
        public readonly baseAttackDamage?: number,
    ) {
        super(generateMessage(attackerName, attackName, damage, targetName, remainingHp, baseAttackDamage));
    }
}
