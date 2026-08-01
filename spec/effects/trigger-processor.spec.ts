import { expect } from 'chai';
import { TriggerProcessor } from '../../src/effects/trigger-processor.js';
import { EndOfTurnTriggerEffectContext } from '../../src/effects/effect-context.js';
import { Effect } from '../../src/repository/effect-types.js';
import { Controllers } from '../../src/controllers/controllers.js';
import { MockCardRepository } from '../mock-repository.js';

// ---------------------------------------------------------------------------
// Minimal controller builder
// ---------------------------------------------------------------------------
// We stub only the controllers that TriggerProcessor.processEndOfTurn accesses,
// allowing direct invocation and queue inspection without running the full game.

type PushedEntry = { effects: Effect[]; context: EndOfTurnTriggerEffectContext };

function buildMinimalControllers(overrides: {
    repository: MockCardRepository;
    getAttachedTool?: (instanceId: string) => { templateId: string; instanceId: string } | null;
    getActiveStadium?: () => { templateId: string; instanceId: string; owner: number } | null;
    currentTurn?: number;
    turnNumber?: number;
}): { controllers: Controllers; pushed: PushedEntry[] } {
    const pushed: PushedEntry[] = [];
    const repo = overrides.repository;

    const controllers = {
        tools: {
            getAttachedTool: overrides.getAttachedTool ?? (() => null),
        },
        cardRepository: {
            getTool: (templateId: string) => {
                try { return repo.getTool(templateId); } catch { return undefined; }
            },
            getCreature: (templateId: string) => {
                try { return repo.getCreature(templateId); } catch { return undefined; }
            },
            getStadium: (templateId: string) => {
                try { return repo.getStadium(templateId); } catch { return undefined; }
            },
        },
        turn: {
            get: () => overrides.currentTurn ?? 0,
        },
        turnCounter: {
            getTurnNumber: () => overrides.turnNumber ?? 2,
        },
        effects: {
            pushPendingEffect: (effects: Effect[], context: unknown) => {
                pushed.push({ effects, context: context as EndOfTurnTriggerEffectContext });
            },
        },
        stadium: {
            getActiveStadium: overrides.getActiveStadium ?? (() => null),
        },
        players: { count: 2 },
    } as unknown as Controllers;

    return { controllers, pushed };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TriggerProcessor context fields (passive-effect cleanup)', () => {
    // -------------------------------------------------------------------
    // Tool trigger
    // -------------------------------------------------------------------
    // When a tool fires a trigger, the pushed EffectContext must carry:
    //   sourceToolInstanceId = the tool's instanceId   (used by passive-effect-handler
    //                                                    to clean up tool passive effects)
    //   sourceInstanceId     = the creature's instanceId (used to clean up creature
    //                                                    passive effects when creature
    //                                                    leaves the field)
    // -------------------------------------------------------------------
    describe('Tool trigger — processEndOfTurn', () => {
        const CREATURE_ID = 'trigger-tool-creature';
        const TOOL_ID = 'trigger-tool';

        function buildToolRepo() {
            return new MockCardRepository({
                creatures: {
                    [CREATURE_ID]: {
                        templateId: CREATURE_ID,
                        name: 'Trigger Tool Creature',
                        maxHp: 60,
                        type: 'colorless',
                        retreatCost: 1,
                        attacks: [],
                    },
                },
                tools: {
                    [TOOL_ID]: {
                        templateId: TOOL_ID,
                        name: 'Trigger Tool',
                        effects: [{
                            type: 'hp',
                            amount: { type: 'constant', value: 10 },
                            target: { type: 'fixed', player: 'self', position: 'source' },
                            operation: 'heal',
                        }],
                        trigger: { type: 'end-of-turn' },
                    },
                },
            });
        }

        it('should set sourceToolInstanceId to the tool\'s instanceId', () => {
            const creatureInstanceId = 'creature-inst-1';
            const toolInstanceId = 'tool-inst-1';
            const repo = buildToolRepo();

            const { controllers, pushed } = buildMinimalControllers({
                repository: repo,
                getAttachedTool: (id) =>
                    id === creatureInstanceId
                        ? { templateId: TOOL_ID, instanceId: toolInstanceId }
                        : null,
            });

            TriggerProcessor.processEndOfTurn(controllers, 0, creatureInstanceId, CREATURE_ID);

            expect(pushed).to.have.length(1, 'expected exactly one pending effect');
            const ctx = pushed[0].context;
            // CURRENTLY FAILING: TriggerProcessor never sets sourceToolInstanceId
            expect(ctx.sourceToolInstanceId, 'sourceToolInstanceId should equal the tool instanceId').to.equal(toolInstanceId);
        });

        it('should set sourceInstanceId to the creature\'s instanceId for a tool trigger', () => {
            const creatureInstanceId = 'creature-inst-1';
            const repo = buildToolRepo();

            const { controllers, pushed } = buildMinimalControllers({
                repository: repo,
                getAttachedTool: (id) =>
                    id === creatureInstanceId
                        ? { templateId: TOOL_ID, instanceId: 'tool-inst-1' }
                        : null,
            });

            TriggerProcessor.processEndOfTurn(controllers, 0, creatureInstanceId, CREATURE_ID);

            expect(pushed).to.have.length(1, 'expected exactly one pending effect');
            const ctx = pushed[0].context;
            // CURRENTLY FAILING: TriggerProcessor never sets sourceInstanceId for tool triggers
            expect(ctx.sourceInstanceId, 'sourceInstanceId should equal the creature instanceId').to.equal(creatureInstanceId);
        });
    });

    // -------------------------------------------------------------------
    // Ability trigger
    // -------------------------------------------------------------------
    // When a creature's ability fires a trigger, the pushed EffectContext
    // must carry:
    //   sourceInstanceId = the creature's instanceId  (used to clean up passive
    //                                                   effects when the creature
    //                                                   leaves the field)
    // -------------------------------------------------------------------
    describe('Ability trigger — processEndOfTurn', () => {
        const CREATURE_ID = 'trigger-ability-creature';

        function buildAbilityRepo() {
            return new MockCardRepository({
                creatures: {
                    [CREATURE_ID]: {
                        templateId: CREATURE_ID,
                        name: 'Trigger Ability Creature',
                        maxHp: 60,
                        type: 'colorless',
                        retreatCost: 1,
                        attacks: [],
                        ability: {
                            name: 'End Turn Ability',
                            effects: [{
                                type: 'hp',
                                amount: { type: 'constant', value: 10 },
                                target: { type: 'fixed', player: 'self', position: 'source' },
                                operation: 'heal',
                            }],
                            trigger: { type: 'end-of-turn' },
                        },
                    },
                },
            });
        }

        it('should set sourceInstanceId to the creature\'s instanceId for an ability trigger', () => {
            const creatureInstanceId = 'creature-inst-1';
            const repo = buildAbilityRepo();

            const { controllers, pushed } = buildMinimalControllers({
                repository: repo,
                getAttachedTool: () => null,
            });

            TriggerProcessor.processEndOfTurn(controllers, 0, creatureInstanceId, CREATURE_ID);

            expect(pushed).to.have.length(1, 'expected exactly one pending effect');
            const ctx = pushed[0].context;
            // CURRENTLY FAILING: TriggerProcessor never sets sourceInstanceId for ability triggers
            expect(ctx.sourceInstanceId, 'sourceInstanceId should equal the creature instanceId').to.equal(creatureInstanceId);
        });
    });

    // -------------------------------------------------------------------
    // Stadium trigger
    // -------------------------------------------------------------------
    // When a stadium fires a trigger, the pushed EffectContext must:
    //   1. have type 'trigger' (not 'trainer') — currently uses createCardPlayedContext
    //      which produces type: 'trainer'. Note: TriggerContextualRefs has
    //      'end-of-turn': never, so stadium end-of-turn effects intentionally
    //      cannot use creature-scoped field target references — the typing
    //      enforces this. The fix only changes the context type, not target refs.
    //   2. have sourceInstanceId = the stadium's instanceId (used by
    //      passive-effect-handler to clean up when the stadium is removed)
    // -------------------------------------------------------------------
    describe('Stadium trigger — processEndOfTurn', () => {
        const STADIUM_ID = 'trigger-stadium';

        function buildStadiumRepo() {
            return new MockCardRepository({
                stadiums: {
                    [STADIUM_ID]: {
                        templateId: STADIUM_ID,
                        name: 'Trigger Stadium',
                        effects: [{
                            type: 'hp',
                            amount: { type: 'constant', value: 10 },
                            target: { type: 'fixed', player: 'self', position: 'active' },
                            operation: 'heal',
                        }],
                        trigger: { type: 'end-of-turn' },
                    },
                },
            });
        }

        it('should push a "trigger"-type context (not "trainer") for a stadium trigger', () => {
            const stadiumInstanceId = 'stadium-inst-1';
            const repo = buildStadiumRepo();

            const { controllers, pushed } = buildMinimalControllers({
                repository: repo,
                getAttachedTool: () => null,
                // Return no creature template so only the stadium fires
                getActiveStadium: () => ({ templateId: STADIUM_ID, instanceId: stadiumInstanceId, owner: 0 }),
            });

            TriggerProcessor.processEndOfTurn(controllers, 0, 'creature-inst-1', 'no-such-creature');

            expect(pushed).to.have.length(1, 'expected exactly one pending effect (stadium)');
            const ctx = pushed[0].context;
            expect(ctx.type, 'stadium trigger context type should be "end-of-turn-trigger"').to.equal('end-of-turn-trigger');
        });

        it('should set sourceInstanceId to the stadium\'s instanceId', () => {
            const stadiumInstanceId = 'stadium-inst-1';
            const repo = buildStadiumRepo();

            const { controllers, pushed } = buildMinimalControllers({
                repository: repo,
                getAttachedTool: () => null,
                getActiveStadium: () => ({ templateId: STADIUM_ID, instanceId: stadiumInstanceId, owner: 0 }),
            });

            TriggerProcessor.processEndOfTurn(controllers, 0, 'creature-inst-1', 'no-such-creature');

            expect(pushed).to.have.length(1);
            const ctx = pushed[0].context;
            // CURRENTLY FAILING: createCardPlayedContext never sets sourceInstanceId
            expect(ctx.sourceInstanceId, 'sourceInstanceId should equal the stadium instanceId').to.equal(stadiumInstanceId);
        });
    });
});
