export type BoardSkeleton = {id:string;type:string;x:number;y:number;[key:string]:unknown};
export declare function skeletonsFromEvents(
 events: Array<{id?:string;sequence:number;type:string;payload?:{board?:unknown}}>,
 revealSequence?:number|null,revealCount?:number
): BoardSkeleton[];
