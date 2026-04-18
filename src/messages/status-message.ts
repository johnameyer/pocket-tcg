import { GameOverMessage, KnockedOutMessage, AttackResultMessage, EvolutionMessage, CreaturePlayedMessage, ItemPlayedMessage, SupporterPlayedMessage, ToolPlayedMessage, StadiumPlayedMessage } from './status/index.js';

export type StatusMessage = GameOverMessage | KnockedOutMessage | AttackResultMessage | EvolutionMessage | CreaturePlayedMessage | ItemPlayedMessage | SupporterPlayedMessage | ToolPlayedMessage | StadiumPlayedMessage;
