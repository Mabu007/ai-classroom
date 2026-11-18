import { useEffect, useMemo, useState } from 'react';
import { Excalidraw, convertToExcalidrawElements } from '@excalidraw/excalidraw';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import type { BoardAction, ClassroomEvent } from '../lib/types';

function sceneFromEvents(events: ClassroomEvent[]) {
  const skeletons: Array<Record<string, unknown>> = [];
  for (const event of events) {
    if (event.type !== 'teacher_step') continue;
    const actions = (event.payload.board ?? []) as BoardAction[];
    for (const action of actions) {
      if (action.type === 'clear_whiteboard') { skeletons.length = 0; continue; }
      if (action.type === 'write_text' || action.type === 'write_equation') {
        skeletons.push({ type: 'text', x: action.x, y: action.y, text: action.text, fontSize: action.type === 'write_equation' ? 30 : 23, strokeColor: '#14294c' });
      } else if (action.type === 'draw_shape') {
        skeletons.push({ type: action.shape, x: action.x, y: action.y, width: action.width, height: action.height, strokeColor: '#4569d3', backgroundColor: 'transparent' });
      } else if (action.type === 'draw_arrow') {
        skeletons.push({ type: 'arrow', x: action.x, y: action.y, points: [[0,0],[action.endX - action.x, action.endY - action.y]], strokeColor: '#4569d3' });
      }
    }
  }
  return convertToExcalidrawElements(skeletons as Parameters<typeof convertToExcalidrawElements>[0]);
}
export default function Whiteboard({ events }: { events: ClassroomEvent[] }) {
  const [api, setApi] = useState<ExcalidrawImperativeAPI | null>(null);
  const elements = useMemo(() => sceneFromEvents(events), [events]);
  useEffect(() => { if (api) api.updateScene({ elements }); }, [api, elements]);
  return <div className="canvas-inner"><Excalidraw excalidrawAPI={setApi} initialData={{ elements, appState: { viewBackgroundColor: '#fff' } }} viewModeEnabled zenModeEnabled gridModeEnabled={false} UIOptions={{ canvasActions: { saveToActiveFile: false, loadScene: false, export: false, clearCanvas: false } }}/></div>;
}
