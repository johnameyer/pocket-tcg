import { Controllers } from '../../controllers/controllers.js';
import { RegisterPassiveEffect } from '../../repository/effect-types.js';
import { EffectContext } from '../effect-context.js';
import { AbstractEffectHandler, ResolutionRequirement } from '../interfaces/effect-handler-interface.js';

/**
 * Handler for the unified passive effect type.
 * Registers any modifier effect as a passive effect that persists over time.
 */
export class PassiveEffectHandler extends AbstractEffectHandler<RegisterPassiveEffect> {
    private resolveContextualInstanceId(
        reference: 'defender' | 'attacker',
        context: EffectContext,
    ): string | undefined {
        if (reference === 'defender') {
            if (context.type === 'attack') {
                return context.defenderInstanceId;
            }
            if (context.type === 'trigger' && context.triggerType === 'on-attack') {
                return context.defenderInstanceId;
            }
            return undefined;
        }

        if (context.type === 'attack') {
            return context.attackerInstanceId;
        }
        if (context.type === 'trigger' && (context.triggerType === 'damaged' || context.triggerType === 'before-knockout')) {
            return context.attackerInstanceId;
        }

        return undefined;
    }

    /**
     * Passive effects require no target resolution — they match criteria passively at query time.
     *
     * @param effect The register-passive effect
     * @returns Empty array (no resolution needed)
     */
    getResolutionRequirements(_effect: RegisterPassiveEffect): ResolutionRequirement[] {
        return [];
    }

    /**
     * Apply a passive effect by registering its modifier into the active passive effects store.
     *
     * @param controllers Game controllers
     * @param effect The register-passive effect to apply
     * @param context Effect context
     */
    apply(controllers: Controllers, effect: RegisterPassiveEffect, context: EffectContext): void {
        let modifier = effect.modifier;
        let cardInstanceId = context.sourceInstanceId;

        if (modifier.type === 'prevent-attack' && modifier.targetContextReference) {
            const resolvedTargetInstanceId = this.resolveContextualInstanceId(modifier.targetContextReference, context);
            modifier = {
                ...modifier,
                resolvedTargetInstanceId,
            };
            if (resolvedTargetInstanceId) {
                cardInstanceId = resolvedTargetInstanceId;
            }
        }

        if (modifier.type === 'damage-reduction' && modifier.damageSourceContextReference) {
            const resolvedDamageSourceInstanceId = this.resolveContextualInstanceId(modifier.damageSourceContextReference, context);
            modifier = {
                ...modifier,
                resolvedDamageSourceInstanceId,
            };
            if (resolvedDamageSourceInstanceId) {
                cardInstanceId = resolvedDamageSourceInstanceId;
            }
        }

        controllers.effects.registerPassiveEffect(
            context.sourcePlayer,
            context.effectName,
            modifier,
            modifier.duration,
            controllers.turnCounter.getTurnNumber(),
            cardInstanceId,
            context.sourceToolInstanceId,
        );

        controllers.players.messageAll({
            type: 'status',
            components: [ `${context.effectName} is now active!` ],
        });
    }
}

export const passiveEffectHandler = new PassiveEffectHandler();
