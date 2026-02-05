import { expect } from 'chai';
import { PlayCardResponseMessage } from '../../../src/messages/response/play-card-response-message.js';
import { AttachEnergyResponseMessage } from '../../../src/messages/response/attach-energy-response-message.js';
import { EndTurnResponseMessage } from '../../../src/messages/response/end-turn-response-message.js';
import { StateBuilder } from '../../helpers/state-builder.js';
import { runTestGame } from '../../helpers/test-helpers.js';
import { MockCardRepository } from '../../mock-repository.js';
import { CreatureData, ItemData } from '../../../src/repository/card-types.js';
import { PreventEnergyAttachmentEffectHandler } from '../../../src/effects/handlers/prevent-energy-attachment-effect-handler.js';
import { PreventEnergyAttachmentEffect } from '../../../src/repository/effect-types.js';

describe('Prevent Energy Attachment Effect', () => {
    describe('getResolutionRequirements', () => {
        const handler = new PreventEnergyAttachmentEffectHandler();

        it('should return empty array (no resolution needed)', () => {
            const effect: PreventEnergyAttachmentEffect = {
                type: 'prevent-energy-attachment',
                target: 'opponent',
                duration: { type: 'until-end-of-turn' },
            };

            const result = handler.getResolutionRequirements(effect);
            
            expect(result).to.be.an('array').that.is.empty;
        });
    });

    const basicCreature = { templateId: 'basic-creature', type: 'creature' as const };
    const highHpCreature = { templateId: 'high-hp-creature', type: 'creature' as const };
    const preventItem = { templateId: 'prevent-item', type: 'item' as const };

    const testRepository = new MockCardRepository({
        creatures: new Map<string, CreatureData>([
            [ 'basic-creature', {
                templateId: 'basic-creature',
                name: 'Basic Creature',
                maxHp: 80,
                type: 'fire',
                weakness: 'water',
                retreatCost: 1,
                attacks: [{ name: 'Basic Attack', damage: 20, energyRequirements: [{ type: 'fire', amount: 1 }] }],
            }],
            [ 'high-hp-creature', {
                templateId: 'high-hp-creature',
                name: 'High HP Creature',
                maxHp: 180,
                type: 'water',
                weakness: 'grass',
                retreatCost: 2,
                attacks: [{ name: 'Water Attack', damage: 30, energyRequirements: [{ type: 'water', amount: 2 }] }],
            }],
        ]),
        items: new Map<string, ItemData>([
            [ 'prevent-item', {
                templateId: 'prevent-item',
                name: 'Prevent Energy Item',
                effects: [{
                    type: 'prevent-energy-attachment',
                    target: 'opponent',
                    duration: { type: 'until-end-of-next-turn' },
                }],
            }],
            [ 'self-prevent-item', {
                templateId: 'self-prevent-item',
                name: 'Self Prevent Energy Item',
                effects: [{
                    type: 'prevent-energy-attachment',
                    target: 'self',
                    duration: { type: 'until-end-of-next-turn' },
                }],
            }],
            [ 'both-prevent-item', {
                templateId: 'both-prevent-item',
                name: 'Both Prevent Energy Item',
                effects: [{
                    type: 'prevent-energy-attachment',
                    target: 'both',
                    duration: { type: 'until-end-of-next-turn' },
                }],
            }],
        ]),
    });

    const selfPreventItem = { templateId: 'self-prevent-item', type: 'item' as const };
    const bothPreventItem = { templateId: 'both-prevent-item', type: 'item' as const };

    it('should prevent opponent from attaching energy (basic operation)', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [
                new PlayCardResponseMessage('prevent-item', 'item'),
                new EndTurnResponseMessage(),
                new AttachEnergyResponseMessage(0), // Opponent tries to attach energy
            ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature'),
                StateBuilder.withCreatures(1, 'high-hp-creature'),
                StateBuilder.withHand(0, [ preventItem ]),
                (state) => {
                    // Set up energy for opponent to attach
                    state.energy.currentEnergy[1] = 'water';
                },
            ),
            maxSteps: 20,
        });

        expect(getExecutedCount()).to.equal(2, 'Should have executed prevent item and end turn (energy attachment blocked)');
        // Verify energy was not attached to opponent's creature
        const attachedEnergy = state.energy.attachedEnergyByInstance['high-hp-creature-1'];
        expect(attachedEnergy?.water || 0).to.equal(0, 'No energy should be attached (attachment prevented)');
    });

    it('should allow self to attach energy when preventing opponent', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [
                new PlayCardResponseMessage('prevent-item', 'item'),
                new AttachEnergyResponseMessage(0), // Self attaches energy (allowed)
            ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature'),
                StateBuilder.withCreatures(1, 'high-hp-creature'),
                StateBuilder.withHand(0, [ preventItem ]),
                (state) => {
                    // Set up energy for self to attach
                    state.energy.currentEnergy[0] = 'fire';
                },
            ),
            maxSteps: 15,
        });

        expect(getExecutedCount()).to.equal(2, 'Should have executed prevent item and attach energy');
        // Verify energy was attached to own creature
        const attachedEnergy = state.energy.attachedEnergyByInstance['basic-creature-0'];
        expect(attachedEnergy?.fire || 0).to.equal(1, 'Energy should be attached (self not prevented)');
    });

    it('should prevent self from attaching energy when targeted', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [
                new PlayCardResponseMessage('self-prevent-item', 'item'),
                new AttachEnergyResponseMessage(0), // Self tries to attach energy
            ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature'),
                StateBuilder.withCreatures(1, 'high-hp-creature'),
                StateBuilder.withHand(0, [ selfPreventItem ]),
                (state) => {
                    // Set up energy for self to attach
                    state.energy.currentEnergy[0] = 'fire';
                },
            ),
            maxSteps: 15,
        });

        expect(getExecutedCount()).to.equal(1, 'Should have executed prevent item only (energy attachment blocked)');
        // Verify energy was not attached to own creature
        const attachedEnergy = state.energy.attachedEnergyByInstance['basic-creature-0'];
        expect(attachedEnergy?.fire || 0).to.equal(0, 'No energy should be attached (self prevented)');
    });

    it('should prevent both players from attaching energy', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [
                new PlayCardResponseMessage('both-prevent-item', 'item'),
                new AttachEnergyResponseMessage(0), // Self tries to attach energy (blocked)
                new EndTurnResponseMessage(),
                new AttachEnergyResponseMessage(0), // Opponent tries to attach energy (blocked)
            ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature'),
                StateBuilder.withCreatures(1, 'high-hp-creature'),
                StateBuilder.withHand(0, [ bothPreventItem ]),
                (state) => {
                    // Set up energy for both players
                    state.energy.currentEnergy[0] = 'fire';
                    state.energy.currentEnergy[1] = 'water';
                },
            ),
            maxSteps: 25,
        });

        expect(getExecutedCount()).to.equal(2, 'Should have executed prevent item and end turn (both energy attachments blocked)');
        // Verify no energy was attached to either creature
        const selfEnergy = state.energy.attachedEnergyByInstance['basic-creature-0'];
        const opponentEnergy = state.energy.attachedEnergyByInstance['high-hp-creature-1'];
        expect(selfEnergy?.fire || 0).to.equal(0, 'No energy should be attached to self (both prevented)');
        expect(opponentEnergy?.water || 0).to.equal(0, 'No energy should be attached to opponent (both prevented)');
    });

    it('should not prevent energy attachment during same turn', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [
                new AttachEnergyResponseMessage(0), // Attach before playing prevent item
                new PlayCardResponseMessage('prevent-item', 'item'),
            ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature'),
                StateBuilder.withCreatures(1, 'high-hp-creature'),
                StateBuilder.withHand(0, [ preventItem ]),
                (state) => {
                    // Set up energy for self to attach
                    state.energy.currentEnergy[0] = 'fire';
                },
            ),
            maxSteps: 15,
        });

        expect(getExecutedCount()).to.equal(2, 'Should have executed attach energy and prevent item');
        // Verify energy was attached before prevention
        const attachedEnergy = state.energy.attachedEnergyByInstance['basic-creature-0'];
        expect(attachedEnergy?.fire || 0).to.equal(1, 'Energy should be attached (before prevention)');
    });

    it('should allow energy attachment after prevention expires', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [
                new PlayCardResponseMessage('prevent-item', 'item'),
                new EndTurnResponseMessage(),
                new EndTurnResponseMessage(), // Opponent's turn ends (until-end-of-next-turn)
                new EndTurnResponseMessage(), // Back to player 0's turn
                new EndTurnResponseMessage(), // Player 0's turn ends
                new AttachEnergyResponseMessage(0), // Opponent should now be able to attach
            ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature'),
                StateBuilder.withCreatures(1, 'high-hp-creature'),
                StateBuilder.withHand(0, [ preventItem ]),
                (state) => {
                    // Set up energy for opponent to attach
                    state.energy.currentEnergy[1] = 'water';
                },
            ),
            maxSteps: 30,
        });

        expect(getExecutedCount()).to.equal(6, 'Should have executed all actions including final energy attachment');
        // Verify energy was attached after prevention expired
        const attachedEnergy = state.energy.attachedEnergyByInstance['high-hp-creature-1'];
        expect(attachedEnergy?.water || 0).to.equal(1, 'Energy should be attached after prevention expired');
    });

    it('should stack multiple prevent energy attachment effects', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [
                new PlayCardResponseMessage('prevent-item', 'item'),
                new PlayCardResponseMessage('prevent-item', 'item'),
                new EndTurnResponseMessage(),
                new AttachEnergyResponseMessage(0), // Opponent tries to attach energy
            ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature'),
                StateBuilder.withCreatures(1, 'high-hp-creature'),
                StateBuilder.withHand(0, [ preventItem, preventItem ]),
                (state) => {
                    // Set up energy for opponent to attach
                    state.energy.currentEnergy[1] = 'water';
                },
            ),
            maxSteps: 25,
        });

        expect(getExecutedCount()).to.equal(3, 'Should have executed both prevent items and end turn (energy attachment blocked)');
        // Verify energy was not attached (multiple preventions)
        const attachedEnergy = state.energy.attachedEnergyByInstance['high-hp-creature-1'];
        expect(attachedEnergy?.water || 0).to.equal(0, 'No energy should be attached (multiple preventions)');
    });

    it('should prevent attaching to active creature', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [
                new PlayCardResponseMessage('prevent-item', 'item'),
                new EndTurnResponseMessage(),
                new AttachEnergyResponseMessage(0), // Opponent tries to attach to active
            ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature'),
                StateBuilder.withCreatures(1, 'high-hp-creature'),
                StateBuilder.withHand(0, [ preventItem ]),
                (state) => {
                    // Set up energy for opponent to attach
                    state.energy.currentEnergy[1] = 'water';
                },
            ),
            maxSteps: 20,
        });

        expect(getExecutedCount()).to.equal(2, 'Should have executed prevent item and end turn (energy attachment blocked)');
        // Verify energy was not attached to active creature
        const attachedEnergy = state.energy.attachedEnergyByInstance['high-hp-creature-1'];
        expect(attachedEnergy?.water || 0).to.equal(0, 'No energy should be attached to active');
    });

    it('should prevent attaching to bench creature', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [
                new PlayCardResponseMessage('prevent-item', 'item'),
                new EndTurnResponseMessage(),
                new AttachEnergyResponseMessage(1), // Opponent tries to attach to bench
            ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature'),
                StateBuilder.withCreatures(1, 'high-hp-creature'),
                StateBuilder.withHand(0, [ preventItem ]),
                (state) => {
                    // Add bench creature for opponent
                    state.field.creatures[1].push({
                        fieldInstanceId: 'bench-creature',
                        evolutionStack: [{ instanceId: 'bench-card', templateId: 'basic-creature' }],
                        damageTaken: 0,
                        turnLastPlayed: 0,
                    });
                    // Set up energy for opponent to attach
                    state.energy.currentEnergy[1] = 'water';
                },
            ),
            maxSteps: 20,
        });

        expect(getExecutedCount()).to.equal(2, 'Should have executed prevent item and end turn (energy attachment blocked)');
        // Verify energy was not attached to bench creature
        const attachedEnergy = state.energy.attachedEnergyByInstance['bench-card'];
        expect(attachedEnergy?.water || 0).to.equal(0, 'No energy should be attached to bench');
    });

    it('should work with different energy types', () => {
        const testRepoMultiType = new MockCardRepository({
            creatures: new Map<string, CreatureData>([
                [ 'basic-creature', {
                    templateId: 'basic-creature',
                    name: 'Basic Creature',
                    maxHp: 80,
                    type: 'fire',
                    weakness: 'water',
                    retreatCost: 1,
                    attacks: [{ name: 'Basic Attack', damage: 20, energyRequirements: [{ type: 'fire', amount: 1 }] }],
                }],
                [ 'electric-creature', {
                    templateId: 'electric-creature',
                    name: 'Electric Creature',
                    maxHp: 70,
                    type: 'lightning',
                    weakness: 'fighting',
                    retreatCost: 1,
                    attacks: [{ name: 'Thunder', damage: 25, energyRequirements: [{ type: 'lightning', amount: 2 }] }],
                }],
            ]),
            items: new Map<string, ItemData>([
                [ 'prevent-item', {
                    templateId: 'prevent-item',
                    name: 'Prevent Energy Item',
                    effects: [{
                        type: 'prevent-energy-attachment',
                        target: 'opponent',
                        duration: { type: 'until-end-of-next-turn' },
                    }],
                }],
            ]),
        });

        const electricCreature = { templateId: 'electric-creature', type: 'creature' as const };

        const { state, getExecutedCount } = runTestGame({
            actions: [
                new PlayCardResponseMessage('prevent-item', 'item'),
                new EndTurnResponseMessage(),
                new AttachEnergyResponseMessage(0), // Opponent tries to attach lightning energy
            ],
            customRepository: testRepoMultiType,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature'),
                StateBuilder.withCreatures(1, 'electric-creature'),
                StateBuilder.withHand(0, [ preventItem ]),
                (state) => {
                    // Set up lightning energy for opponent to attach
                    state.energy.currentEnergy[1] = 'lightning';
                },
            ),
            maxSteps: 20,
        });

        expect(getExecutedCount()).to.equal(2, 'Should have executed prevent item and end turn (energy attachment blocked)');
        // Verify lightning energy was not attached
        const attachedEnergy = state.energy.attachedEnergyByInstance['electric-creature-1'];
        expect(attachedEnergy?.lightning || 0).to.equal(0, 'No lightning energy should be attached');
    });
});
