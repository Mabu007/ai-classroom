export type GuidedBoardAction =
 | {type:'write_text'|'write_equation';text:string;x:number;y:number}
 | {type:'draw_shape';shape:'rectangle'|'ellipse';x:number;y:number;width:number;height:number}
 | {type:'draw_arrow';x:number;y:number;endX:number;endY:number}
 | {type:'clear_whiteboard'};
export type GuidedLessonStep = {heading:string;speech:string;board:GuidedBoardAction[];question?:string;origin:'guided'};
export declare const guidedLessonLength: number;
export declare function guidedLessonStep(stage:number): GuidedLessonStep;
export declare function nextGuidedState(stage:number): {stage:number;status:'teaching'|'awaiting_answer'|'completed'};
