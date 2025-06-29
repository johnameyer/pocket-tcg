import { SelectActiveCardResponseMessage, SetupCompleteResponseMessage, EvolveResponseMessage, AttackResponseMessage, PlayCardResponseMessage, EndTurnResponseMessage, AttachEnergyResponseMessage } from './response/index.js';

export type ResponseMessage = AttackResponseMessage | PlayCardResponseMessage | EndTurnResponseMessage | SelectActiveCardResponseMessage | SetupCompleteResponseMessage | EvolveResponseMessage | AttachEnergyResponseMessage;
