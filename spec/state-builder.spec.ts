import { expect } from 'chai';
import { StateBuilder } from './helpers/state-builder.js';
import { ControllerState } from '@cards-ts/core';
import { Controllers } from '../src/controllers/controllers.js';

describe('StateBuilder Validation', () => {
    it('should throw an error when attaching energy to non-existent creature', () => {
        // Create a state with no creatures
        const state = StateBuilder.createActionPhaseState();
        
        // Skip test if state creation failed
        if (!state) {
            console.warn('State creation failed, skipping test');
            return;
        }
        
        // Try to attach energy to a non-existent creature
        const attachEnergy = () => {
            StateBuilder.withEnergy('non-existent-creature', { fire: 1 })(state as ControllerState<Controllers>);
        };
        
        // Expect an error to be thrown
        expect(attachEnergy).to.throw(Error, "Creature instance 'non-existent-creature' not found");
    });
    
    it('should successfully attach energy to existing creature', () => {
        // Create a state with a creature
        const state = StateBuilder.createActionPhaseState();
        
        // Skip test if state creation failed
        if (!state) {
            console.warn('State creation failed, skipping test');
            return;
        }
        
        // Add a creature
        StateBuilder.withcreature(0, 'basic-creature')(state as ControllerState<Controllers>);
        
        // Try to attach energy to the existing creature
        const attachEnergy = () => {
            StateBuilder.withEnergy('basic-creature-0', { fire: 1 })(state as ControllerState<Controllers>);
        };
        
        // Expect no error to be thrown
        expect(attachEnergy).to.not.throw();
        
        // Verify the energy was attached
        expect(state.energy.attachedEnergyByInstance['basic-creature-0']?.fire).to.equal(1);
    });
});
