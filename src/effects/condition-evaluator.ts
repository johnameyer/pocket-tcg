import { Condition } from '../repository/condition-types.js';
import { HandlerData } from '../game-handler.js';
import { FieldCard } from '../controllers/field-controller.js';
import { CardRepository } from '../repository/card-repository.js';
import { AttachableEnergyType } from '../repository/energy-types.js';
import { CreatureData } from '../repository/card-types.js';
import { getFieldInstanceId } from '../utils/field-card-utils.js';

/**
 * Centralized class for evaluating componentized conditions.
 * This eliminates scattered special-case handling and provides a consistent
 * interface for condition evaluation across all effect implementations.
 */
export class ConditionEvaluator {
    /**
     * Evaluates a componentized condition against a creature.
     * 
     * @param condition The componentized condition to evaluate
     * @param creature The creature to check against
     * @param handlerData Handler data view
     * @returns True if the creature matches the condition, false otherwise
     */
    static evaluateCondition(
        condition: Condition | undefined,
        creature: FieldCard,
        handlerData: HandlerData,
        cardRepository: CardRepository,
    ): boolean {
        // If no condition, always match
        if(!condition) {
            return true; 
        }
        
        // Check each condition property
        
        // Check hasEnergy condition
        if(condition.hasEnergy !== undefined) {
            const attachedEnergyByInstance = handlerData.energy?.attachedEnergyByInstance;
            if(!attachedEnergyByInstance) {
                return false; 
            }
            
            const fieldInstanceId = getFieldInstanceId(creature);
            const creatureEnergy = attachedEnergyByInstance[fieldInstanceId];
            if(!creatureEnergy) {
                return false; 
            }
            
            // Get the energy type and required count
            const energyType = Object.keys(condition.hasEnergy)[0] as AttachableEnergyType;
            const requiredCount = condition.hasEnergy[energyType] || 1; // Default to 1 if undefined
            
            if((creatureEnergy[energyType] || 0) < requiredCount) {
                return false;
            }
        }
        
        // Check hasDamage condition
        if(condition.hasDamage === true && creature.damageTaken <= 0) {
            return false;
        }
        
        // Check stage condition
        if(condition.stage !== undefined) {
            try {
                const creatureData = cardRepository.getCreature(creature.templateId);
                const actualStage = this.calculateStage(creatureData, cardRepository);
                if(condition.stage !== actualStage) {
                    return false;
                }
            } catch (error) {
                return false;
            }
        }
        
        // Check attributes condition
        if(condition.attributes !== undefined) {
            try {
                const creatureData = cardRepository.getCreature(creature.templateId);
                
                if(condition.attributes.ex !== undefined) {
                    const isEx = creatureData.attributes?.ex || false;
                    if(condition.attributes.ex !== isEx) {
                        return false;
                    }
                }
                
                if(condition.attributes.mega !== undefined) {
                    const isMega = creatureData.attributes?.mega || false;
                    if(condition.attributes.mega !== isMega) {
                        return false;
                    }
                }
                
                if(condition.attributes.ultraBeast !== undefined) {
                    const isUltraBeast = creatureData.attributes?.ultraBeast || false;
                    if(condition.attributes.ultraBeast !== isUltraBeast) {
                        return false;
                    }
                }
            } catch (error) {
                return false;
            }
        }
        
        // Check evolvesFrom condition
        if(condition.previousStageName !== undefined) {
            try {
                const creatureData = cardRepository.getCreature(creature.templateId);
                if(!creatureData.previousStageName || creatureData.previousStageName.toLowerCase() !== condition.previousStageName.toLowerCase()) {
                    return false;
                }
            } catch (error) {
                return false;
            }
        }
        
        // Check isCreatureType condition
        if(condition.isType !== undefined) {
            try {
                const creatureData = cardRepository.getCreature(creature.templateId);
                if(creatureData.type !== condition.isType) {
                    return false;
                }
            } catch (error) {
                return false;
            }
        }
        
        return true;
    }

    /**
     * Calculate the stage of a creature based on its evolution chain.
     * Stage 0 = Basic (no evolvesFrom)
     * Stage 1 = Evolves from Basic
     * Stage 2 = Evolves from Stage 1
     */
    private static calculateStage(creatureData: CreatureData, cardRepository: CardRepository): number {
        if(!creatureData.previousStageName) {
            return 0; // Basic creature
        }
        
        try {
            const prevStageData = cardRepository.getCreature(creatureData.previousStageName);
            if(!prevStageData.previousStageName) {
                return 1; // Stage 1 (evolves from Basic)
            } 
            return 2; // Stage 2 (evolves from Stage 1)
            
        } catch (error) {
            return 0; // Default to Basic if can't resolve evolution chain
        }
    }
}
