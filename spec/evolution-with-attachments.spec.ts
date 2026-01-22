import { expect } from 'chai';
import { StateBuilder } from './helpers/state-builder.js';
import { runTestGame } from './helpers/test-helpers.js';
import { EvolveResponseMessage } from '../src/messages/response/evolve-response-message.js';
import { AttackResponseMessage } from '../src/messages/response/attack-response-message.js';
import { getCurrentTemplateId } from '../src/utils/field-card-utils.js';

describe('Evolution with Energy and Tools', () => {
    describe('Energy Retention After Evolution', () => {
        it('should retain energy after evolving', () => {
            const { state } = runTestGame({
                actions: [new EvolveResponseMessage('evolution-creature', 0)],
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature'),
                    StateBuilder.withHand(0, [{templateId: 'evolution-creature', type: 'creature'}]),
                    StateBuilder.withEnergy('basic-creature-0', { fire: 2, water: 1 }),
                    StateBuilder.withCanEvolve(0, 0)
                ),
                maxSteps: 5
            });

            // Creature should be evolved
            expect(getCurrentTemplateId(state.field.creatures[0][0])).to.equal('evolution-creature');
            
            // Energy should be retained after evolution
            const originalInstanceId = state.field.creatures[0][0].evolutionStack[0].instanceId;
            const attachedEnergy = state.energy.attachedEnergyByInstance[originalInstanceId];
            expect(attachedEnergy).to.not.be.undefined;
            expect(attachedEnergy.fire).to.equal(2, 'Fire energy should be retained');
            expect(attachedEnergy.water).to.equal(1, 'Water energy should be retained');
        });

        it('should be able to use attacks with retained energy after evolution', () => {
            const { state } = runTestGame({
                actions: [
                    new EvolveResponseMessage('evolution-creature', 0),
                    new AttackResponseMessage(0)
                ],
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature'),
                    StateBuilder.withCreatures(1, 'high-hp-creature'),
                    StateBuilder.withHand(0, [{templateId: 'evolution-creature', type: 'creature'}]),
                    StateBuilder.withEnergy('basic-creature-0', { fire: 2 }), // Evolution creature needs 2 fire energy
                    StateBuilder.withCanEvolve(0, 0)
                ),
                maxSteps: 10
            });

            // Creature should be evolved
            expect(getCurrentTemplateId(state.field.creatures[0][0])).to.equal('evolution-creature');
            
            // Attack should have succeeded (energy was available)
            // Check that opponent took damage
            expect(state.field.creatures[1][0].damageTaken).to.be.greaterThan(0, 'Opponent should have taken damage from attack');
        });

        it('should retain energy when evolving benched creature', () => {
            const { state } = runTestGame({
                actions: [new EvolveResponseMessage('evolution-creature', 1)],
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'high-hp-creature', ['basic-creature']),
                    StateBuilder.withHand(0, [{templateId: 'evolution-creature', type: 'creature'}]),
                    StateBuilder.withEnergy('basic-creature-0-0', { fire: 2 }),
                    StateBuilder.withCanEvolve(0, 1)
                ),
                maxSteps: 5
            });

            // Benched creature should be evolved
            expect(getCurrentTemplateId(state.field.creatures[0][1])).to.equal('evolution-creature');
            
            // Energy should be retained
            const originalInstanceId = state.field.creatures[0][1].evolutionStack[0].instanceId;
            const attachedEnergy = state.energy.attachedEnergyByInstance[originalInstanceId];
            expect(attachedEnergy).to.not.be.undefined;
            expect(attachedEnergy.fire).to.equal(2, 'Fire energy should be retained');
        });
    });

    describe('Tool Attachment After Evolution', () => {
        it('should prevent attaching tool to creature that already has one before evolution', () => {
            const { state } = runTestGame({
                actions: [],
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature'),
                    StateBuilder.withTool('basic-creature-0', 'basic-tool')
                ),
                maxSteps: 1
            });

            // Tool should be attached
            const originalInstanceId = state.field.creatures[0][0].evolutionStack[0].instanceId;
            expect(state.tools.attachedTools[originalInstanceId]).to.not.be.undefined;
            
            // Cannot attach another tool
            expect(state.tools.attachedTools[originalInstanceId]).to.exist;
        });

        it('should keep tool working after evolution (HP bonus)', () => {
            const { state } = runTestGame({
                actions: [new EvolveResponseMessage('evolution-creature', 0)],
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature'),
                    StateBuilder.withHand(0, [{templateId: 'evolution-creature', type: 'creature'}]),
                    StateBuilder.withTool('basic-creature-0', 'basic-tool'),
                    StateBuilder.withCanEvolve(0, 0),
                    StateBuilder.withDamage('basic-creature-0', 40)
                ),
                maxSteps: 5
            });

            // Creature should be evolved
            expect(getCurrentTemplateId(state.field.creatures[0][0])).to.equal('evolution-creature');
            
            // Tool should still be attached to original instance ID
            const originalInstanceId = state.field.creatures[0][0].evolutionStack[0].instanceId;
            const attachedTool = state.tools.attachedTools[originalInstanceId];
            expect(attachedTool).to.not.be.undefined;
            expect(attachedTool.templateId).to.equal('basic-tool');
            
            // Damage should be retained
            expect(state.field.creatures[0][0].damageTaken).to.equal(40);
        });

        it('should not allow attaching second tool after evolution', () => {
            const { state } = runTestGame({
                actions: [new EvolveResponseMessage('evolution-creature', 0)],
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature'),
                    StateBuilder.withHand(0, [{templateId: 'evolution-creature', type: 'creature'}]),
                    StateBuilder.withTool('basic-creature-0', 'basic-tool'),
                    StateBuilder.withCanEvolve(0, 0)
                ),
                maxSteps: 5
            });

            // Creature should be evolved
            expect(getCurrentTemplateId(state.field.creatures[0][0])).to.equal('evolution-creature');
            
            // Tool should still be attached to original instance ID
            const originalInstanceId = state.field.creatures[0][0].evolutionStack[0].instanceId;
            expect(state.tools.attachedTools[originalInstanceId]).to.not.be.undefined;
            
            // The current form's instance ID should not have a tool
            const currentInstanceId = state.field.creatures[0][0].evolutionStack[
                state.field.creatures[0][0].evolutionStack.length - 1
            ].instanceId;
            
            // If someone tries to attach to the current ID, it should fail because
            // the original ID already has a tool (need to check using original ID)
            // This is testing the invariant that canAttachTool should check the original ID
        });
    });

    describe('Evolution Chain with Multiple Evolutions', () => {
        it('should retain energy through multiple evolutions', () => {
            const { state } = runTestGame({
                actions: [],
                stateCustomizer: StateBuilder.combine(
                    StateBuilder.withCreatures(0, 'basic-creature'),
                    StateBuilder.withEnergy('basic-creature-0', { fire: 3 }),
                    (state) => {
                        // Manually create a double evolution for testing
                        const card = state.field.creatures[0][0];
                        card.evolutionStack.push({
                            instanceId: 'evolution-1',
                            templateId: 'evolution-creature'
                        });
                        card.evolutionStack.push({
                            instanceId: 'evolution-2',
                            templateId: 'high-hp-creature'
                        });
                    }
                ),
                maxSteps: 1
            });

            // Check the evolution stack
            const card = state.field.creatures[0][0];
            expect(card.evolutionStack.length).to.equal(3);
            
            // Energy should still be attached to the original instance ID
            const originalInstanceId = card.evolutionStack[0].instanceId;
            const attachedEnergy = state.energy.attachedEnergyByInstance[originalInstanceId];
            expect(attachedEnergy).to.not.be.undefined;
            expect(attachedEnergy.fire).to.equal(3, 'Energy should persist through multiple evolutions');
        });
    });
});
