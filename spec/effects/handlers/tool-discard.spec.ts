import { expect } from 'chai';
import { runTestGame } from '../../helpers/test-helpers.js';
import { StateBuilder } from '../../helpers/state-builder.js';
import { MockCardRepository } from '../../mock-repository.js';
import { PlayCardResponseMessage } from '../../../src/messages/response/play-card-response-message.js';
import { HandlerDataBuilder } from '../../helpers/handler-data-builder.js';
import { ToolDiscardEffectHandler } from '../../../src/effects/handlers/tool-discard-effect-handler.js';
import { EffectContextFactory } from '../../../src/effects/effect-context.js';
import { ToolDiscardEffect } from '../../../src/repository/effect-types.js';
import { getFieldInstanceId } from '../../../src/utils/field-card-utils.js';

describe('Tool Discard Effect', () => {
    describe('canApply', () => {
        const handler = new ToolDiscardEffectHandler();
        const mockRepository = new MockCardRepository();

        it('should return true when target has a tool attached', () => {
            const handlerData = HandlerDataBuilder.default(
                HandlerDataBuilder.withCreatures(0, 'basic-creature', []),
                HandlerDataBuilder.withCreatures(1, 'basic-creature', []),
                HandlerDataBuilder.withTools({
                    'basic-creature-1': { templateId: 'test-tool', instanceId: 'tool-1' },
                }),
            );

            const effect: ToolDiscardEffect = {
                type: 'tool-discard',
                target: { type: 'fixed', player: 'opponent', position: 'active' },
            };

            const context = EffectContextFactory.createCardContext(0, 'Test Tool Discard', 'item');
            const result = handler.canApply(handlerData, effect, context, mockRepository);
            
            expect(result).to.be.true;
        });

        it('should return false when target has no tool attached', () => {
            const handlerData = HandlerDataBuilder.default(
                HandlerDataBuilder.withCreatures(0, 'basic-creature', []),
                HandlerDataBuilder.withCreatures(1, 'basic-creature', []),
            );

            const effect: ToolDiscardEffect = {
                type: 'tool-discard',
                target: { type: 'fixed', player: 'opponent', position: 'active' },
            };

            const context = EffectContextFactory.createCardContext(0, 'Test Tool Discard', 'item');
            const result = handler.canApply(handlerData, effect, context, mockRepository);
            
            expect(result).to.be.false;
        });

        it('should return false when there is no creature at target position', () => {
            const handlerData = HandlerDataBuilder.default(
                HandlerDataBuilder.withCreatures(0, 'basic-creature', []),
            );

            const effect: ToolDiscardEffect = {
                type: 'tool-discard',
                target: { type: 'fixed', player: 'opponent', position: 'active' },
            };

            const context = EffectContextFactory.createCardContext(0, 'Test Tool Discard', 'item');
            const result = handler.canApply(handlerData, effect, context, mockRepository);
            
            expect(result).to.be.false;
        });
    });

    it('should discard tool from opponent active creature', () => {
        const testRepository = new MockCardRepository({
            items: new Map([
                [ 'tool-discard-item', {
                    templateId: 'tool-discard-item',
                    name: 'Tool Discard Item',
                    effects: [{
                        type: 'tool-discard',
                        target: { type: 'fixed', player: 'opponent', position: 'active' },
                    }],
                }],
            ]),
        });

        const { state } = runTestGame({
            actions: [ new PlayCardResponseMessage('tool-discard-item', 'item') ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature'),
                StateBuilder.withCreatures(1, 'basic-creature'),
                StateBuilder.withHand(0, [{ templateId: 'tool-discard-item', type: 'item' }]),
                StateBuilder.withTool('basic-creature-1', 'test-tool'),
            ),
        });

        // Check that opponent's creature no longer has a tool
        const opponentCreature = state.field.creatures[1][0];
        const fieldInstanceId = getFieldInstanceId(opponentCreature);
        const attachedTool = state.tools.attachedTools[fieldInstanceId];
        
        expect(attachedTool).to.be.undefined;
        
        // Check that the tool was discarded
        expect(state.discard[1]).to.have.length(1);
        expect(state.discard[1][0].type).to.equal('tool');
    });

    it('should do nothing when target creature has no tool', () => {
        const testRepository = new MockCardRepository({
            items: new Map([
                [ 'tool-discard-item', {
                    templateId: 'tool-discard-item',
                    name: 'Tool Discard Item',
                    effects: [{
                        type: 'tool-discard',
                        target: { type: 'fixed', player: 'opponent', position: 'active' },
                    }],
                }],
            ]),
        });

        const { state } = runTestGame({
            actions: [ new PlayCardResponseMessage('tool-discard-item', 'item') ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature'),
                StateBuilder.withCreatures(1, 'basic-creature'),
                StateBuilder.withHand(0, [{ templateId: 'tool-discard-item', type: 'item' }]),
            ),
        });

        // Check that discard pile is empty (no tool to discard)
        expect(state.discard[1]).to.have.length(0);
    });

    it('should target creatures with tools using hasTool filter', () => {
        const testRepository = new MockCardRepository({
            items: new Map([
                [ 'tool-discard-filter-item', {
                    templateId: 'tool-discard-filter-item',
                    name: 'Tool Discard Filter Item',
                    effects: [{
                        type: 'tool-discard',
                        target: {
                            type: 'all-matching',
                            criteria: {
                                player: 'opponent',
                                location: 'field',
                                fieldCriteria: { hasTool: true },
                            },
                        },
                    }],
                }],
            ]),
        });

        const { state } = runTestGame({
            actions: [ new PlayCardResponseMessage('tool-discard-filter-item', 'item') ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature'),
                StateBuilder.withCreatures(1, 'basic-creature', [ 'basic-creature', 'basic-creature' ]),
                StateBuilder.withHand(0, [{ templateId: 'tool-discard-filter-item', type: 'item' }]),
                StateBuilder.withTool('basic-creature-1', 'test-tool'),
                StateBuilder.withTool('basic-creature-1-0', 'test-tool'),
            ),
        });

        // Check that both tools were discarded (active and one bench creature)
        expect(state.discard[1]).to.have.length(2);
        expect(state.discard[1].every(card => card.type === 'tool')).to.be.true;
    });
});
