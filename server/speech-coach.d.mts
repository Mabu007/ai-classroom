import type {Challenge} from '../shared/catalog.mjs';
export type Review={strength:string;improvement:string;nextRep:string;source:string;dimensions:string[];evidence:{turns:number;words:number;questions:number;developedAnswers:number};disclaimer:string};
export declare function countWords(text:unknown):number;
export declare function sanitizeConversation(turns:unknown):Array<{role:'user'|'character';text:string}>;
export declare function guidedFollowUp(challenge:Challenge,turnIndex:number):string;
export declare function deterministicReview(challenge:Challenge,userTurns:string[]):Review;
export declare function validateAIReview(candidate:unknown,challenge:Challenge,userTurns:string[]):Review|null;
