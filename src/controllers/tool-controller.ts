import { GenericControllerProvider, GenericHandlerController, GlobalController, Serializable } from '@cards-ts/core';
import { CardRepository } from '../repository/card-repository.js';

export type ToolState = {
    // Map of FieldCard instance ID to attached tool info
    attachedTools: { [fieldCardInstanceId: string]: { templateId: string; instanceId: string } };
};

type ToolDependencies = {
    players: GenericHandlerController<any, any>;
};

export class ToolControllerProvider implements GenericControllerProvider<ToolState, ToolDependencies, ToolController> {
    constructor(private cardRepository: CardRepository) {}

    controller(state: ToolState, controllers: ToolDependencies): ToolController {
        return new ToolController(state, controllers, this.cardRepository);
    }
    
    initialState(): ToolState {
        return {
            attachedTools: {}
        };
    }
    
    dependencies() {
        return { players: true } as const;
    }
}

export class ToolController extends GlobalController<ToolState, ToolDependencies> {
    constructor(
        state: ToolState,
        controllers: ToolDependencies,
        private cardRepository: CardRepository
    ) {
        super(state, controllers);
    }

    validate() {
        // No validation needed
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
        const toolData = this.cardRepository.getTool(toolTemplateId);
        if (!toolData) {
            return false;
        }
        
        this.state.attachedTools[fieldCardInstanceId] = { 
            templateId: toolTemplateId, 
            instanceId: toolInstanceId 
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
    
    // TODO: Probably shouldn't be handled in this class
    // Calculate HP bonus from attached tool
    public getHpBonus(fieldCardInstanceId: string): number {
        const tool = this.getAttachedTool(fieldCardInstanceId);
        if (!tool) return 0;
        
        const toolData = this.cardRepository.getTool(tool.templateId);
        if (!toolData) return 0;
        
        // No hp-bonus effects supported
        let hpBonus = 0;
        
        return hpBonus;
    }
}
