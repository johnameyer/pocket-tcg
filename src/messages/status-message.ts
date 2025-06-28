import { GameOverMessage, KnockedOutMessage, AttackResultMessage } from './status/index.js';

export type StatusMessage = GameOverMessage | KnockedOutMessage | AttackResultMessage;