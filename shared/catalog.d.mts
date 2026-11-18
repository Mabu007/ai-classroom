export type Category={id:string;title:string;subtitle:string;order:number};
export type Challenge={
 id:string;version:number;category:string;title:string;tagline:string;minutes:number;
 difficulty:'Beginner'|'Intermediate'|'Advanced';archetype:string;opening:string;
 objective:string;style:string;rubric:string[];beats:string[];art:string;accent:string;icon:string;
 maxTurns:number;voice:{lang:string;rate:number;pitch:number};completion:string;safety:string;
};
export declare const categories:Category[];
export declare const challenges:Challenge[];
export declare const catalogueVersion:number;
export declare function challengeById(id:string):Challenge|null;
export declare function challengeSummaries():Array<Omit<Challenge,'opening'|'beats'|'safety'|'completion'>>;
