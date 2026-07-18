import { InstancedFieldCard } from '../repository/card-types.js';
import { FieldCard } from '../controllers/field-controller.js';

/**
 * Get the current instance ID (of the topmost evolution form).
 */
export function getCurrentInstanceId(card: FieldCard | InstancedFieldCard): string {
    if ('evolutionStack' in card) {
        return card.evolutionStack[card.evolutionStack.length - 1].instanceId;
    }
    return card.instanceId;
}

/**
 * Get the current template ID (of the topmost evolution form).
 */
export function getCurrentTemplateId(card: FieldCard | InstancedFieldCard): string {
    if ('evolutionStack' in card) {
        return card.evolutionStack[card.evolutionStack.length - 1].templateId;
    }
    return card.templateId;
}

/**
 * Get the field instance ID (persists through evolution).
 * This ID is used for energy and tool attachments.
 */
export function getFieldInstanceId(card: FieldCard | InstancedFieldCard): string {
    if ('evolutionStack' in card) {
        return card.fieldInstanceId;
    }
    return card.instanceId;
}

/**
 * Get the original instance ID (first card in the evolution chain).
 * @deprecated Use getFieldInstanceId instead for energy/tool attachments
 */
export function getOriginalInstanceId(card: FieldCard | InstancedFieldCard): string {
    if ('evolutionStack' in card) {
        return card.evolutionStack[0].instanceId;
    }
    return card.instanceId;
}

/**
 * Convert an InstancedFieldCard to the simplified FieldCard format.
 * This is useful for code that doesn't need evolution history.
 */
export function toFieldCard(card: InstancedFieldCard): FieldCard {
    const current = card.evolutionStack[card.evolutionStack.length - 1];
    return {
        instanceId: current.instanceId,
        templateId: current.templateId,
        damageTaken: card.damageTaken,
        turnPlayed: card.turnLastPlayed,
    };
}

/**
 * Create an InstancedFieldCard from a basic template.
 */
export function createInstancedFieldCard(
    instanceId: string,
    templateId: string,
    turnPlayed: number = 0,
): InstancedFieldCard {
    return {
        fieldInstanceId: instanceId, // Use the first instance ID as the field instance ID
        evolutionStack: [{ instanceId, templateId }],
        damageTaken: 0,
        turnLastPlayed: turnPlayed,
    };
}

/**
 * Add an evolution to an InstancedFieldCard.
 */
export function addEvolution(
    card: InstancedFieldCard,
    instanceId: string,
    templateId: string,
    turnPlayed: number,
): InstancedFieldCard {
    return {
        ...card,
        evolutionStack: [ ...card.evolutionStack, { instanceId, templateId }],
        turnLastPlayed: turnPlayed,
    };
}
