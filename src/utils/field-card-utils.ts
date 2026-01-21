import { InstancedFieldCard, EvolutionStackCard } from '../repository/card-types.js';
import { FieldCard } from '../controllers/field-controller.js';

/**
 * Get the current instance ID (of the topmost evolution form).
 */
export function getCurrentInstanceId(card: FieldCard | InstancedFieldCard): string {
    if ('evolutionStack' in card) {
        // InstancedFieldCard - get from top of evolution stack
        return card.evolutionStack[card.evolutionStack.length - 1].instanceId;
    }
    // FieldCard - direct access
    return card.instanceId;
}

/**
 * Get the current template ID (of the topmost evolution form).
 */
export function getCurrentTemplateId(card: FieldCard | InstancedFieldCard): string {
    if ('evolutionStack' in card) {
        // InstancedFieldCard - get from top of evolution stack
        return card.evolutionStack[card.evolutionStack.length - 1].templateId;
    }
    // FieldCard - direct access
    return card.templateId;
}

/**
 * Get the original instance ID (first card in the evolution chain).
 */
export function getOriginalInstanceId(card: FieldCard | InstancedFieldCard): string {
    if ('evolutionStack' in card) {
        // InstancedFieldCard - get from bottom of evolution stack
        return card.evolutionStack[0].instanceId;
    }
    // FieldCard - same as current
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
        turnPlayed: card.turnLastPlayed
    };
}

/**
 * Create an InstancedFieldCard from a basic template.
 */
export function createInstancedFieldCard(
    instanceId: string,
    templateId: string,
    turnPlayed: number = 0
): InstancedFieldCard {
    return {
        evolutionStack: [{ instanceId, templateId }],
        damageTaken: 0,
        turnLastPlayed: turnPlayed
    };
}

/**
 * Add an evolution to an InstancedFieldCard.
 */
export function addEvolution(
    card: InstancedFieldCard,
    instanceId: string,
    templateId: string,
    turnPlayed: number
): InstancedFieldCard {
    return {
        ...card,
        evolutionStack: [...card.evolutionStack, { instanceId, templateId }],
        turnLastPlayed: turnPlayed
    };
}
