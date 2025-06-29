import { SelectActiveCardResponseMessage, SetupCompleteResponseMessage, EvolveResponseMessage, AttackResponseMessage, PlayCardResponseMessage, EndTurnResponseMessage } from './response/index.js';

export type ResponseMessage = AttackResponseMessage | PlayCardResponseMessage | EndTurnResponseMessage | SelectActiveCardResponseMessage | SetupCompleteResponseMessage | EvolveResponseMessage;
