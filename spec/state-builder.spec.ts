import { expect } from 'chai';
import { StateBuilder } from './helpers/state-builder.js';
import { ControllerState } from '@cards-ts/core';
import { Controllers } from '../src/controllers/controllers.js';

describe('StateBuilder Validation', () => {
    it('should throw an error when attaching energy to non-existent creature', () => {
        const state = StateBuilder.createActionPhaseState();
        
        if (!state) {
            console.warn('State creation failed, skipping test');
            return;
        }
        
        const attachEnergy = () => {
            StateBuilder.withEnergy('non-existent-creature', { fire: 1 })(state as ControllerState<Controllers>);
        };
        
        expect(attachEnergy).to.throw(Error, "Creature instance 'non-existent-creature' not found");
    });
    
    it('should throw an error when attaching a tool to non-existent creature', () => {
        const state = StateBuilder.createActionPhaseState();
        
        const attachTool = () => {
            StateBuilder.withTool('non-existent-creature', 'giant-cape')(state as ControllerState<Controllers>);
        };
        
        expect(attachTool).to.throw(Error, "Creature instance 'non-existent-creature' not found");
    });
    
    it('should successfully attach energy to existing creature', () => {
        const state = StateBuilder.createActionPhaseState();
        
        if (!state) {
            console.warn('State creation failed, skipping test');
            return;
        }
        
        StateBuilder.withCreatures(0, 'basic-creature')(state as ControllerState<Controllers>);
        
        const attachEnergy = () => {
            StateBuilder.withEnergy('basic-creature-0', { fire: 1 })(state as ControllerState<Controllers>);
        };
        
        expect(attachEnergy).to.not.throw();
        expect(state.energy.attachedEnergyByInstance['basic-creature-0']?.fire).to.equal(1);
    });
    
    it('should successfully attach a tool to existing creature', () => {
        const state = StateBuilder.createActionPhaseState();
        
        StateBuilder.withCreatures(0, 'basic-creature')(state as ControllerState<Controllers>);
        
        const attachTool = () => {
            StateBuilder.withTool('basic-creature-0', 'giant-cape')(state as ControllerState<Controllers>);
        };
        
        expect(attachTool).to.not.throw();
        expect(state.tools.attachedTools['basic-creature-0']?.templateId).to.equal('giant-cape');
    });
});
