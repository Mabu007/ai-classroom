export interface WorkoutClock{
 start():void;pause():void;resume():void;seconds():number;isRunning():boolean;
}
export declare function createWorkoutClock(now?:()=>number):WorkoutClock;
