// Pure source-of-truth conversion. Keeps every whiteboard element anchored
// to its authoritative event sequence, regardless of client re-render.
export function skeletonsFromEvents(events, revealSequence = null, revealCount = Infinity) {
  const skeletons = [];
  const ordered = [...events].sort((a,b) => Number(a.sequence||0)-Number(b.sequence||0));
  for (const event of ordered) {
    if (event.type === 'classroom_reset') { skeletons.length=0; continue; }
    if (event.type !== 'teacher_step') continue;
    const board = Array.isArray(event.payload?.board) ? event.payload.board.slice(0, 6) : [];
    const actions = revealSequence !== null && event.sequence === revealSequence
      ? board.slice(0, Math.max(0,revealCount)) : board;
    for (let index=0;index<actions.length;index++) {
      const action = actions[index];
      if (!action || typeof action !== 'object') continue;
      if (action.type === 'clear_whiteboard') { skeletons.length = 0; continue; }
      const id='teacher-'+String(event.sequence)+'-'+String(index);
      const x=Number(action.x),y=Number(action.y);
      if(!Number.isFinite(x)||!Number.isFinite(y))continue;
      if(action.type==='write_text'||action.type==='write_equation') {
        const text=typeof action.text==='string'?action.text.slice(0,180):'';
        if(!text)continue;
        skeletons.push({id,type:'text',x,y,text,fontSize:action.type==='write_equation'?32:23,strokeColor:'#23365b'});
      }else if(action.type==='draw_shape' && ['rectangle','ellipse'].includes(action.shape)){
        const width=Number(action.width),height=Number(action.height);
        if(width>0&&height>0&&Number.isFinite(width)&&Number.isFinite(height))
          skeletons.push({id,type:action.shape,x,y,width,height,strokeColor:'#5965e7',backgroundColor:'transparent'});
      }else if(action.type==='draw_arrow'){
        const endX=Number(action.endX),endY=Number(action.endY);
        if(Number.isFinite(endX)&&Number.isFinite(endY))
          skeletons.push({id,type:'arrow',x,y,points:[[0,0],[endX-x,endY-y]],strokeColor:'#5965e7'});
      }
    }
  }
  return skeletons;
}
