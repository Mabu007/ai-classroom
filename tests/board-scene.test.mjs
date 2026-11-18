import test from 'node:test';
import assert from 'node:assert/strict';
import { skeletonsFromEvents } from '../src/lib/board-scene.mjs';

const beat=(seq,board)=>({id:String(seq),type:'teacher_step',sequence:seq,payload:{board}});
test('scene reconstruction produces stable IDs and chronological order',()=>{
  const one=beat(1,[{type:'write_text',x:10,y:30,text:'hello'}]);
  const two=beat(2,[{type:'draw_arrow',x:10,y:30,endX:40,endY:80}]);
  const result=skeletonsFromEvents([two,one]);
  assert.deepEqual(result.map(x=>x.id),['teacher-1-0','teacher-2-0']);
  assert.deepEqual(skeletonsFromEvents([one,two]),result);
});
test('late join replays all drawings, reset clears previous scenes',()=>{
  const list=[beat(1,[{type:'write_text',x:10,y:30,text:'before'}]),{id:'reset',sequence:2,type:'classroom_reset',payload:{}},beat(3,[{type:'write_text',x:10,y:50,text:'after'}])];
  assert.deepEqual(skeletonsFromEvents(list).map(e=>e.text),['after']);
});
test('incremental reveal is bounded and does not mutate the event log',()=>{
  const events=[beat(1,[{type:'write_text',x:10,y:20,text:'a'}]),beat(2,[{type:'write_text',x:10,y:30,text:'b'},{type:'write_text',x:10,y:40,text:'c'}])];
  const one=skeletonsFromEvents(events,2,1);
  assert.deepEqual(one.map(x=>x.text),['a','b']);
  assert.equal(events[1].payload.board.length,2);
  const all=skeletonsFromEvents(events,2,2);
  assert.deepEqual(all.map(x=>x.text),['a','b','c']);
});
test('malformed events and unbounded payloads never crash the canvas',()=>{
  const bad=beat(1,[null,{}, {type:'write_text',x:NaN,y:0,text:'x'}, {type:'draw_shape',shape:'rectangle',x:0,y:0,width:-9,height:2}]);
  assert.deepEqual(skeletonsFromEvents([bad]),[]);
});
