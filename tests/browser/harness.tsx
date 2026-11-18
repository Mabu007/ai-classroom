import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import '@excalidraw/excalidraw/index.css';
import '../../src/styles/app.css';
import Whiteboard from '../../src/components/Whiteboard';
import { guidedLessonStep } from '../../server/guided-lesson.mjs';
import type { ClassroomEvent } from '../../src/lib/types';

function Harness() {
  const [events,setEvents] = useState<ClassroomEvent[]>([]);
  const [grid,setGrid] = useState(false);
  function addStep() {
    setEvents(old=>{
      const stage=old.filter(e=>e.type==='teacher_step').length;
      if(stage>=5)return old;
      const step=guidedLessonStep(stage);
      return [...old,{id:String(stage+1),sequence:stage+1,type:'teacher_step',payload:{...step,stage}}];
    });
  }
  function reset() {setEvents([{id:'reset',sequence:100,type:'classroom_reset',payload:{}}]);}
  return <div style={{padding:12,background:'#f5f6fb'}}>
    <div style={{display:'flex',gap:12,alignItems:'center',minHeight:45}}>
      <button onClick={addStep} data-testid="draw-step">Draw next step</button>
      <button onClick={()=>setGrid(!grid)} data-testid="toggle-grid">Toggle grid</button>
      <button onClick={reset} data-testid="reset">Reset</button>
      <output data-testid="event-count">{events.filter(e=>e.type==='teacher_step').length}</output>
    </div>
    <div style={{width:'100%',height:'75vh',background:'white',position:'relative'}} data-testid="whiteboard-root">
      <Whiteboard events={events} grid={grid}/>
    </div>
  </div>;
}
createRoot(document.getElementById('browser-test-root')!).render(<Harness/>);
