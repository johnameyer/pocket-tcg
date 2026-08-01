import { Controllers } from '../../controllers/controllers.js';
import { MoveDamageEffect } from '../../repository/effect-types.js';
import { EffectContext } from '../effect-context.js';
import { AbstractEffectHandler, ResolutionRequirement } from '../interfaces/effect-handler-interface.js';
import { getEffectValue } from '../effect-utils.js';
import { ResolvedFieldTarget } from '../../repository/targets/field-target.js';
import { FieldTargetResolver } from '../target-resolvers/field-target-resolver.js';
import { HandlerData } from '../../game-handler.js';
import { CardRepository } from '../../repository/card-repository.js';

export class MoveDamageEffectHandler extends AbstractEffectHandler<MoveDamageEffect> {
    getResolutionRequirements(effect: MoveDamageEffect): ResolutionRequirement[] {
        return [
            { targetProperty: 'from', target: effect.from, required: true },
            { targetProperty: 'to', target: effect.to, required: true },
        ];
    }

    canApply(handlerData: HandlerData, effect: MoveDamageEffect, context: EffectContext, cardRepository: CardRepository): boolean {
        return FieldTargetResolver.isTargetAvailable(effect.from, handlerData, context, cardRepository)
            && FieldTargetResolver.isTargetAvailable(effect.to, handlerData, context, cardRepository);
    }

    apply(controllers: Controllers, effect: MoveDamageEffect, context: EffectContext): void {
        const resolvedFrom = effect.from as unknown as ResolvedFieldTarget;
        const resolvedTo = effect.to as unknown as ResolvedFieldTarget;

        if (resolvedFrom.type !== 'resolved' || resolvedFrom.targets.length === 0) {
            controllers.players.messageAll({ type: 'status', components: [ `${context.effectName} could not find source!` ] });
            return;
        }
        if (resolvedTo.type !== 'resolved' || resolvedTo.targets.length === 0) {
            controllers.players.messageAll({ type: 'status', components: [ `${context.effectName} could not find destination!` ] });
            return;
        }

        const fromTarget = resolvedFrom.targets[0];
        const toTarget = resolvedTo.targets[0];

        const fromCard = controllers.field.getCardByPosition(fromTarget.playerId, fromTarget.fieldIndex);
        if (!fromCard || fromCard.damageTaken === 0) {
            controllers.players.messageAll({ type: 'status', components: [ `${context.effectName} — source has no damage to move!` ] });
            return;
        }

        const maxAmount = fromCard.damageTaken;
        const amount = effect.amount === 'all'
            ? maxAmount
            : Math.min(getEffectValue(effect.amount, controllers, context), maxAmount);

        if (amount <= 0) {
            return;
        }

        // Remove damage from source
        this.removeDamage(controllers, fromTarget.playerId, fromTarget.fieldIndex, amount);
        // Apply damage to destination (capped to max HP)
        controllers.field.applyDamage(toTarget.playerId, amount, toTarget.fieldIndex);

        controllers.players.messageAll({
            type: 'status',
            components: [ `${context.effectName} moved ${amount} damage!` ],
        });
    }

    private removeDamage(controllers: Controllers, playerId: number, fieldIndex: number, amount: number): void {
        if (fieldIndex === 0) {
            controllers.field.healDamage(playerId, amount);
        } else {
            controllers.field.healBenchedCard(playerId, fieldIndex - 1, amount);
        }
    }
}

export const moveDamageEffectHandler = new MoveDamageEffectHandler();
