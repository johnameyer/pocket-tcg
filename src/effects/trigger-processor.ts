import { Controllers } from '../controllers/controllers.js';
import { EffectApplier } from './effect-applier.js';
import { EffectContextFactory } from './effect-context.js';

/**
 * These methods should only be called from the state machine and event handler
 */
export class TriggerProcessor {
    // Process when-damaged triggers
    static processWhenDamaged(
        controllers: Controllers,
        playerId: number,
        creatureInstanceId: string,
        creatureCardId: string,
        damageAmount: number
    ): void {
        // Process ability triggers
        const pokemonData = controllers.cardRepository.getCreature(creatureCardId);
        if (pokemonData && pokemonData.abilities) {
            for (const ability of pokemonData.abilities) {
                if (ability.trigger?.type === 'damaged' && ability.effects) {
                    const context = EffectContextFactory.createTriggerContext(
                        playerId,
                        `${pokemonData.name}'s ${ability.name}`,
                        'damaged',
                        creatureInstanceId
                    );
                    
                    EffectApplier.applyEffects(ability.effects, controllers, context);
                }
            }
        }
    }

    // Process end-of-turn triggers
    static processEndOfTurn(
        controllers: Controllers,
        playerId: number,
        creatureInstanceId: string,
        creatureCardId: string
    ): void {
        // Process ability triggers
        const pokemonData = controllers.cardRepository.getCreature(creatureCardId);
        if (pokemonData && pokemonData.abilities) {
            for (const ability of pokemonData.abilities) {
                if (ability.trigger?.type === 'end-of-turn' && ability.effects) {
                    const context = EffectContextFactory.createTriggerContext(
                        playerId,
                        `${pokemonData.name}'s ${ability.name}`,
                        'end-of-turn',
                        creatureInstanceId
                    );
                    
                    EffectApplier.applyEffects(ability.effects, controllers, context);
                }
            }
        }
    }
}
