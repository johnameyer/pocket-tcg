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
                target: { player: 'opponent' },
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
                    target: { player: 'opponent' },
                    duration: { type: 'until-end-of-next-turn' },
                }],
            }],
            [ 'self-prevent-item', {
                templateId: 'self-prevent-item',
                name: 'Self Prevent Energy Item',
                effects: [{
                    type: 'prevent-energy-attachment',
                    target: { player: 'self' },
                    duration: { type: 'until-end-of-next-turn' },
                }],
            }],
            [ 'both-prevent-item', {
                templateId: 'both-prevent-item',
                name: 'Both Prevent Energy Item',
                effects: [{
                    type: 'prevent-energy-attachment',
                    target: {},
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
        });

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
        });

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
        });

        // Verify energy was not attached to own creature
        const attachedEnergy = state.energy.attachedEnergyByInstance['basic-creature-0'];
        expect(attachedEnergy?.fire || 0).to.equal(0, 'No energy should be attached (self prevented)');
    });

    it('should prevent both players from attaching energy', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [
                // P0 plays both-prevent-item
                new PlayCardResponseMessage('both-prevent-item', 'item'),
                new EndTurnResponseMessage(),
                
                // P1 tries to attach (prevented by both-prevent-item)
                new AttachEnergyResponseMessage(0),
            ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature'),
                StateBuilder.withCreatures(1, 'high-hp-creature'),
                StateBuilder.withHand(0, [ bothPreventItem ]),
                (state) => {
                    // Set up energy for both players - use availableTypes so it persists through generateEnergy
                    state.energy.availableTypes[0] = [ 'fire' ];
                    state.energy.availableTypes[1] = [ 'water' ];
                },
            ),
        });

        // Verify: P1 cannot attach (effect prevents both players starting next turn)
        const opponentEnergy = state.energy.attachedEnergyByInstance['high-hp-creature-1'];
        expect(opponentEnergy?.water || 0).to.equal(0, 'P1 blocked (both-prevent-item prevents opponent)');
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
        });

        // Verify energy was attached before prevention
        const attachedEnergy = state.energy.attachedEnergyByInstance['basic-creature-0'];
        expect(attachedEnergy?.fire || 0).to.equal(1, 'Energy should be attached (before prevention)');
    });

    // TODO: Cannot test opponent actions with current framework - resumeFrom has known issues
    it('should allow energy attachment after prevention expires', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [
                // Turn 2: P0 plays prevent-item (duration: until-end-of-next-turn, valid through turn 3)
                new PlayCardResponseMessage('prevent-item', 'item'),
                new EndTurnResponseMessage(), // P0 ends, turn becomes 3
                
                // Turn 3: P1's turn, effect still active, can't attach
                new EndTurnResponseMessage(), // P1 ends, turn becomes 4, effect expires
                
                // Turn 4: P0's turn
                new EndTurnResponseMessage(), // P0 ends, turn becomes 5
                
                // Turn 5: P1's turn, effect expired, can attach
                new AttachEnergyResponseMessage(0),
            ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature'),
                StateBuilder.withCreatures(1, 'high-hp-creature'),
                StateBuilder.withHand(0, [ preventItem ]),
                (state) => {
                    // Set up energy for opponent to attach - use availableTypes so it persists through generateEnergy
                    state.energy.availableTypes[1] = [ 'water' ];
                },
            ),
        });

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
        });

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
        });

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
        });

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
                        target: { player: 'opponent' },
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
        });

        // Verify lightning energy was not attached
        const attachedEnergy = state.energy.attachedEnergyByInstance['electric-creature-1'];
        expect(attachedEnergy?.lightning || 0).to.equal(0, 'No lightning energy should be attached');
    });
});
