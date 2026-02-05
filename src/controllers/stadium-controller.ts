import { GlobalController, GenericControllerProvider } from '@cards-ts/core';
import { GameCard } from './card-types.js';
import { DiscardController } from './discard-controller.js';

export type StadiumState = {
    activeStadium?: {
        templateId: string;
        instanceId: string;
        owner: number; // Player who played the stadium
        name: string;
    };
};

type StadiumDependencies = {
    discard: DiscardController;
};

export class StadiumControllerProvider implements GenericControllerProvider<StadiumState, StadiumDependencies, StadiumController> {
    controller(state: StadiumState, controllers: StadiumDependencies): StadiumController {
        return new StadiumController(state, controllers);
    }
    
    initialState(): StadiumState {
        return {
            activeStadium: undefined,
        };
    }
    
    dependencies() {
        return { discard: true } as const;
    }
}

export class StadiumController extends GlobalController<StadiumState, StadiumDependencies> {
    validate() {
        return true;
    }

    /**
     * Play a stadium card to the field. If there's an existing stadium, it will be discarded.
     * 
     * @param templateId - The template ID of the stadium card being played
     * @param instanceId - The instance ID of the specific stadium card copy
     * @param owner - The player index (0 or 1) who is playing the stadium
     * @param name - The display name of the stadium for tracking and UI purposes
     */
    public playStadium(templateId: string, instanceId: string, owner: number, name: string): void {
        // Discard the existing stadium if there is one
        if (this.state.activeStadium) {
            this.controllers.discard.discardCard(this.state.activeStadium.owner, {
                instanceId: this.state.activeStadium.instanceId,
                templateId: this.state.activeStadium.templateId,
                type: 'stadium',
            });
        }
        
        // Set the new stadium
        this.state.activeStadium = {
            templateId,
            instanceId,
            owner,
            name,
        };
    }

    /**
     * Get the currently active stadium, if any.
     */
    public getActiveStadium(): { templateId: string; instanceId: string; owner: number; name: string } | undefined {
        return this.state.activeStadium;
    }

    /**
     * Clear the active stadium and discard it.
     */
    public clearStadium(): void {
        if (this.state.activeStadium) {
            this.controllers.discard.discardCard(this.state.activeStadium.owner, {
                instanceId: this.state.activeStadium.instanceId,
                templateId: this.state.activeStadium.templateId,
                type: 'stadium',
            });
            this.state.activeStadium = undefined;
        }
    }
}
