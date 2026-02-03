import { expect } from 'chai';
import { PlayCardResponseMessage } from '../../../src/messages/response/play-card-response-message.js';
import { AttackResponseMessage } from '../../../src/messages/response/attack-response-message.js';
import { StateBuilder } from '../../helpers/state-builder.js';
import { runTestGame } from '../../helpers/test-helpers.js';
import { MockCardRepository } from '../../mock-repository.js';
import { CreatureData, SupporterData } from '../../../src/repository/card-types.js';

describe('Coin Flip Manipulation Effect', () => {
    const testRepository = new MockCardRepository({
        supporters: new Map<string, SupporterData>([
            [ 'coin-flip-supporter', { // Generic supporter name
                templateId: 'coin-flip-supporter',
                name: 'Will Supporter',
                effects: [{
                    type: 'coin-flip-manipulation',
                    guaranteeNextHeads: true,
                    duration: { type: 'until-end-of-turn' },
                }],
            }],
        ]),
        creatures: new Map<string, CreatureData>([
            [ 'coin-flip-attacker', {
                templateId: 'coin-flip-attacker',
                name: 'Coin Flip Attacker',
                maxHp: 80,
                type: 'lightning',
                weakness: 'fighting',
                retreatCost: 1,
                attacks: [{
                    name: 'Lucky Strike',
                    damage: { type: 'coin-flip', headsValue: 50, tailsValue: 0 },
                    energyRequirements: [{ type: 'lightning', amount: 1 }],
                }],
            }],
            [ 'high-hp-creature', {
                templateId: 'high-hp-creature',
                name: 'High HP Creature',
                maxHp: 140,
                type: 'colorless',
                weakness: 'fighting',
                retreatCost: 3,
                attacks: [{
                    name: 'Body Slam',
                    damage: 30,
                    energyRequirements: [{ type: 'colorless', amount: 2 }],
                }],
            }],
        ]),
    });

    const coinFlipSupporter = { templateId: 'coin-flip-supporter', type: 'supporter' as const };

    it('should set next coin flip to heads (basic operation)', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [ new PlayCardResponseMessage('coin-flip-supporter', 'supporter') ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature'),
                StateBuilder.withHand(0, [ coinFlipSupporter ]),
            ),
            maxSteps: 10,
        });

        expect(getExecutedCount()).to.equal(1, 'Should have executed Will');
        expect(state.coinFlip.nextFlipGuaranteedHeads).to.be.true;
    });

    it('should guarantee heads for coin flip attacks (observable damage)', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [
                new PlayCardResponseMessage('coin-flip-supporter', 'supporter'),
                new AttackResponseMessage(0), // Use coin flip attack
            ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'coin-flip-attacker'),
                StateBuilder.withCreatures(1, 'high-hp-creature'),
                StateBuilder.withHand(0, [ coinFlipSupporter ]),
                StateBuilder.withEnergy('coin-flip-attacker-0', { lightning: 1 }),
            ),
            maxSteps: 15,
        });

        expect(getExecutedCount()).to.equal(2, 'Should have executed Will and attack');
        expect(state.field.creatures[1][0].damageTaken).to.equal(50, 'Should deal 50 damage (guaranteed heads)');
        expect(state.coinFlip.nextFlipGuaranteedHeads).to.be.false;
    });

    it('should deal no damage on tails (without Will)', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [ new AttackResponseMessage(0) ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'coin-flip-attacker'),
                StateBuilder.withCreatures(1, 'high-hp-creature'),
                StateBuilder.withEnergy('coin-flip-attacker-0', { lightning: 1 }),
                StateBuilder.withMockedCoinFlips([ false ]), // Force tails
            ),
            maxSteps: 10,
        });

        expect(getExecutedCount()).to.equal(1, 'Should have executed attack');
        expect(state.field.creatures[1][0].damageTaken).to.equal(0, 'Should deal 0 damage (tails)');
    });

    it('should deal damage on heads (without Will)', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [ new AttackResponseMessage(0) ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'coin-flip-attacker'),
                StateBuilder.withCreatures(1, 'high-hp-creature'),
                StateBuilder.withEnergy('coin-flip-attacker-0', { lightning: 1 }),
                StateBuilder.withMockedCoinFlips([ true ]), // Force heads
            ),
            maxSteps: 10,
        });

        expect(getExecutedCount()).to.equal(1, 'Should have executed attack');
        expect(state.field.creatures[1][0].damageTaken).to.equal(50, 'Should deal 50 damage (heads)');
    });

    it('should preserve Will effect until used', () => {
        const { state, getExecutedCount } = runTestGame({
            actions: [
                new PlayCardResponseMessage('coin-flip-supporter', 'supporter'),
                // Don't attack yet - just verify Will is active
            ],
            customRepository: testRepository,
            stateCustomizer: StateBuilder.combine(
                StateBuilder.withCreatures(0, 'basic-creature'),
                StateBuilder.withHand(0, [ coinFlipSupporter ]),
            ),
            maxSteps: 10,
        });

        expect(getExecutedCount()).to.equal(1, 'Should have executed Will');
        expect(state.coinFlip.nextFlipGuaranteedHeads).to.be.true;
        expect(state.hand[0].length).to.equal(0, 'Will should be played from hand');
    });
});
