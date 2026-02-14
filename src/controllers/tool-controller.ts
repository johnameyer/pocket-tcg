import { GenericControllerProvider, GenericHandlerController, GlobalController, SystemHandlerParams } from '@cards-ts/core';
import { ResponseMessage } from '../messages/response-message.js';
import { GameHandlerParams } from '../game-handler-params.js';
import { CardRepositoryController } from './card-repository-controller.js';

export type ToolState = {
    // Map of FieldCard instance ID to attached tool info
    attachedTools: {
        [fieldCardInstanceId: string]: { templateId: string; instanceId: string };
    };
};

type ToolDependencies = {
    players: GenericHandlerController<ResponseMessage, GameHandlerParams & SystemHandlerParams>;
    cardRepository: CardRepositoryController;
};

export class ToolControllerProvider implements GenericControllerProvider<ToolState, ToolDependencies, ToolController> {
    controller(state: ToolState, controllers: ToolDependencies): ToolController {
        return new ToolController(state, controllers);
    }
    
    initialState(): ToolState {
        return {
            attachedTools: {},
        };
    }
    
    dependencies() {
        return { players: true, cardRepository: true } as const;
    }
}

export class ToolController extends GlobalController<ToolState, ToolDependencies> {
    validate() {
        // Validate that all attached tools exist in the repository
        for (const [ fieldCardInstanceId, tool ] of Object.entries(this.state.attachedTools)) {
            try {
                this.controllers.cardRepository.getTool(tool.templateId);
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                throw new Error(`Invalid tool templateId "${tool.templateId}" attached to field card "${fieldCardInstanceId}": ${errorMessage}`);
            }
        }
    }
    
    // Get attached tool for a FieldCard
    public getAttachedTool(fieldCardInstanceId: string): { templateId: string; instanceId: string } | undefined {
        return this.state.attachedTools[fieldCardInstanceId];
    }
    
    // Attach a tool to a FieldCard
    public attachTool(fieldCardInstanceId: string, toolTemplateId: string, toolInstanceId: string): boolean {
        // Check if FieldCard already has a tool
        if (this.state.attachedTools[fieldCardInstanceId]) {
            return false;
        }
        
        // Verify tool exists
        const toolData = this.controllers.cardRepository.getTool(toolTemplateId);
        if (!toolData) {
            return false;
        }
        
        this.state.attachedTools[fieldCardInstanceId] = { 
            templateId: toolTemplateId, 
            instanceId: toolInstanceId, 
        };
        return true;
    }
    
    // Detach a tool from a FieldCard
    public detachTool(fieldCardInstanceId: string): void {
        delete this.state.attachedTools[fieldCardInstanceId];
    }
    
    // Check if a FieldCard can have a tool attached
    public canAttachTool(fieldCardInstanceId: string): boolean {
        return !this.state.attachedTools[fieldCardInstanceId];
    }
    
    /*
     * TODO: Probably shouldn't be handled in this class
     * Calculate HP bonus from attached tool
     */
    public getHpBonus(fieldCardInstanceId: string): number {
        const tool = this.getAttachedTool(fieldCardInstanceId);
        if (!tool) {
            return 0; 
        }
        
        const toolData = this.controllers.cardRepository.getTool(tool.templateId);
        if (!toolData || !toolData.effects) {
            return 0; 
        }
        
        let hpBonus = 0;
        
        // Calculate HP bonus from tool effects
        for (const effect of toolData.effects) {
            if (effect.type === 'hp-bonus') {
                if (effect.amount.type === 'constant') {
                    hpBonus += effect.amount.value;
                }
                // TODO: Add support for other amount types if needed
            }
        }
        
        return hpBonus;
    }

    // Get all field card instance IDs that have tools attached (for validation purposes)
    public getInstancesWithTools(): string[] {
        return Object.keys(this.state.attachedTools);
    }
}
