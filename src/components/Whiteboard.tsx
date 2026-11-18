import { useEffect, useMemo, useRef, useState } from 'react';
import { Excalidraw, convertToExcalidrawElements } from '@excalidraw/excalidraw';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import type { ClassroomEvent } from '../lib/types';
import { skeletonsFromEvents } from '../lib/board-scene.mjs';

export default function Whiteboard({ events, grid = false }: { events: ClassroomEvent[]; grid?: boolean }) {
  const [api, setApi] = useState<ExcalidrawImperativeAPI|null>(null);
  const [revealCount, setRevealCount] = useState(Infinity);
  const stageId=events.filter(e=>e.type==='teacher_step'||e.type==='classroom_reset').at(-1)?.id;
  const stageEvent=events.find(e=>e.id===stageId);
  const stageSequence=stageEvent?.type==='teacher_step'?stageEvent.sequence:null;
  const actionCount=stageEvent?.type==='teacher_step' && Array.isArray(stageEvent.payload.board)
    ? stageEvent.payload.board.length:0;
  const lastStageRef=useRef<string|undefined>(undefined);
  // Draw one authored action at a time; never invent whiteboard content in the browser.
  useEffect(()=>{
    if(!stageId || !actionCount){setRevealCount(Infinity);return;}
    if(lastStageRef.current===stageId) return;
    lastStageRef.current=stageId;
    setRevealCount(1); // the first chalk stroke appears immediately
    let count=1;
    const interval=window.setInterval(()=>{
      count++;
      setRevealCount(count);
      if(count>=actionCount)window.clearInterval(interval);
    },Math.max(700,Math.min(3400,Math.round(Math.min(18000,Math.max(6000,String(stageEvent?.payload.speech ?? '').length*65))/Math.max(1,actionCount)))));
    return ()=>window.clearInterval(interval);
  },[stageId,actionCount]);
  const key=events.filter(e=>e.type==='teacher_step'||e.type==='classroom_reset').map(e=>e.id).join(',');
  const elements=useMemo(()=>{
    const skeletons=skeletonsFromEvents(events,stageSequence,revealCount);
    return convertToExcalidrawElements(skeletons as Parameters<typeof convertToExcalidrawElements>[0]);
  },[key,revealCount,stageSequence]);
  useEffect(()=>{
    if(!api)return;
    api.updateScene({elements});
    if(!elements.length)return;
    // Fit after the complete step rather than re-centering on every stroke.
    if(revealCount !== 1 && revealCount < actionCount)return;
    const frame=window.requestAnimationFrame(()=>{
      try{api.scrollToContent(elements,{fitToViewport:true,viewportZoomFactor:.62,animate:true,duration:350});}
      catch(error){console.warn('Board fitting unavailable:',error instanceof Error?error.name:'unknown');}
    });
    return ()=>window.cancelAnimationFrame(frame);
  },[api,elements,revealCount,actionCount]);
  return <div className="canvas-inner">
    <Excalidraw excalidrawAPI={setApi} initialData={{elements,appState:{viewBackgroundColor:'#fff'}}}
      viewModeEnabled zenModeEnabled gridModeEnabled={grid}
      UIOptions={{canvasActions:{saveToActiveFile:false,loadScene:false,export:false,clearCanvas:false}}}/>
  </div>;
}
