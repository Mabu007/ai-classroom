export type Review={
 strength:string;improvement:string;nextRep:string;source:string;
 dimensions:string[];evidence:{turns:number;words:number;questions:number;developedAnswers:number};disclaimer:string
};
export type TranscriptTurn={role:'user'|'character';text:string;source?:'ai'|'guided'|'opening';turn?:number};
export type Session={
 id:string;challengeId:string;challengeVersion:number;status:string;turnsCount:number;
 durationSeconds:number;review:Review|null;startedAt:number;updatedAt:number;
 transcriptConsent:boolean;hasTranscript?:boolean;paused?:boolean;transcript?:TranscriptTurn[];
};
export type Profile={adultConfirmed?:boolean;transcriptConsent?:boolean}|null;
export function formatDuration(seconds:number){
 const s=Math.max(0,Math.floor(Number.isFinite(seconds)?seconds:0));
 return Math.floor(s/60)+':'+String(s%60).padStart(2,'0');
}
