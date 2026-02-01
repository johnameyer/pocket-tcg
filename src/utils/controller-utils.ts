import { reconstruct } from '@cards-ts/core';
import { Controllers } from '../controllers/controllers.js';
import { HandlerData } from '../game-handler.js';

type ControllerWithGetFor = {
    getFor(position: number): unknown;
};

function hasGetFor(controller: unknown): controller is ControllerWithGetFor {
    return typeof controller === 'object' 
           && controller !== null 
           && 'getFor' in controller 
           && typeof (controller as ControllerWithGetFor).getFor === 'function';
}

/**
 * Utility functions for working with Controllers and HandlerData
 */
export class ControllerUtils {
    /**
     * Converts Controllers to HandlerData for a given player position.
     * This is similar to the asHandlerData method in GenericGameState from the core library.
     * 
     * @param controllers The controllers to convert
     * @param position The player position
     * @returns HandlerData view of the controllers
     */
    static createPlayerView(controllers: Controllers, position: number): HandlerData {
        // Check if controllers is already HandlerData
        if(this.isHandlerData(controllers)) {
            return controllers as HandlerData;
        }
        
        // Create a HandlerData view by calling getFor on each controller
        return Object.fromEntries(
            Object.entries(controllers).map(([ key, value ]) => {
                // Skip null or undefined values
                if(value === null || value === undefined) {
                    return [ key, value ];
                }
                
                // Call getFor on controllers that have this method
                const handlerData = hasGetFor(value) ? value.getFor(position) : value;
                
                // Deep clone the handler data to avoid modifying the original
                return [ key, reconstruct(handlerData) ];
            }),
        ) as HandlerData;
    }
    
    /**
     * Determines if an object is HandlerData or Controllers.
     * 
     * @param obj The object to check
     * @returns True if the object is HandlerData, false if it's Controllers
     */
    static isHandlerData(obj: HandlerData | Controllers): obj is HandlerData {
        const hasExpectedProps = 'creature' in obj && 'turn' in obj;
        const hasControllerMethods = 'fieldCard' in obj 
                                    && typeof (obj as Record<string, unknown>).fieldCard === 'object'
                                    && (obj as Record<string, unknown>).fieldCard !== null
                                    && 'getPlayedCards' in ((obj as Record<string, unknown>).fieldCard as Record<string, unknown>);
        
        return hasExpectedProps && !hasControllerMethods;
    }
}
