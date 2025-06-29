import { GameOverMessage, KnockedOutMessage, AttackResultMessage, EvolutionMessage } from './status/index.js';

export type StatusMessage = GameOverMessage | KnockedOutMessage | AttackResultMessage | EvolutionMessage;
