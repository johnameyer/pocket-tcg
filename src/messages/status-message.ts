import { GameOverMessage, KnockedOutMessage, AttackResultMessage, EvolutionMessage, CardPlayedMessage } from './status/index.js';

export type StatusMessage = GameOverMessage | KnockedOutMessage | AttackResultMessage | EvolutionMessage | CardPlayedMessage;
