/**
 * Pausable workout duration. Never counts wall-clock time spent paused.
 * No browser globals: deterministic and regression-testable.
 */
export function createWorkoutClock(now=()=>Date.now()){
 let accrued=0;
 let runningFrom=null;
 return {
  start(){accrued=0;runningFrom=now();},
  pause(){
   if(runningFrom!==null){
    accrued+=Math.max(0,now()-runningFrom);
    runningFrom=null;
   }
  },
  resume(){if(runningFrom===null)runningFrom=now();},
  seconds(){return Math.min(1200,Math.floor((accrued+(runningFrom===null?0:Math.max(0,now()-runningFrom)))/1000));},
  isRunning(){return runningFrom!==null;}
 };
}
