import { Controllers } from '../../controllers/controllers.js';
import { HpBonusEffect } from '../../repository/effect-types.js';
import { EffectContext } from '../effect-context.js';
import { AbstractEffectHandler, ResolutionRequirement } from '../effect-handler.js';
import { getEffectValue } from '../effect-utils.js';

/**
 * Handler for HP bonus effects that increase a creature's maximum HP.
 */
export class HpBonusEffectHandler extends AbstractEffectHandler<HpBonusEffect> {
    /**
     * Get the resolution requirements for an HP bonus effect.
     * HP bonus effects don't require any targets as they apply to the creature the tool/ability is attached to.
     * 
     * @param effect The HP bonus effect to get resolution requirements for
     * @returns Empty array as HP bonus effects don't have targets
     */
    getResolutionRequirements(effect: HpBonusEffect): ResolutionRequirement[] {
        return []; // HP bonus effects don't have targets, they apply to the creature the tool/ability is attached to
    }
    
    /**
     * Apply a fully resolved HP bonus effect.
     * This increases the maximum HP of the creature the tool/ability is attached to.
     * 
     * @param controllers Game controllers
     * @param effect The HP bonus effect to apply
     * @param context Effect context
     */
    apply(controllers: Controllers, effect: HpBonusEffect, context: EffectContext): void {
        // Get the amount of HP to add
        const amount = getEffectValue(effect.amount, controllers, context);
        
        /*
         * HP bonus effects are typically applied by tools
         * The tool controller already handles HP bonuses through getHpBonus()
         * This handler is mainly for completeness and future extensibility
         */
        
        /*
         * For tools, the effect is applied when the tool is attached
         * The creatureController uses ToolController.getHpBonus() when calculating creature HP
         */
        
        // We can still show a message about the HP bonus being applied
        if(context.type === 'trainer') {
            // This is a trainer card being played
            controllers.players.messageAll({
                type: 'status',
                components: [ `${context.effectName} increases creature's HP by ${amount}!` ],
            });
        } else if((context.type === 'ability' || context.type === 'trigger') && context.creatureInstanceId) {
            // This is an ability or trigger
            const creatureName = controllers.cardRepository.getCreature(context.creatureInstanceId.split('-')[0]).name;
            
            controllers.players.messageAll({
                type: 'status',
                components: [ `${context.effectName} increases ${creatureName}'s HP by ${amount}!` ],
            });
        }
        
        /*
         * The actual HP bonus application is handled by the ToolController and creatureController
         * when they calculate a creature's current HP
         */
    }
}

export const hpBonusEffectHandler = new HpBonusEffectHandler();
