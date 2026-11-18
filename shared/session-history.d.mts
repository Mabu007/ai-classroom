export type SessionGroup<T>={challengeId:string;attempts:T[];lastPractised:number;completed:number};
export declare function groupSessionsByChallenge<T extends {id:string;challengeId:string;startedAt:number;status:string}>(sessions:T[]):SessionGroup<T>[];
export declare function transcriptAsText(challengeTitle:string,session:{transcript?:Array<{role:string;text:string;source?:string}>}|null):string;
