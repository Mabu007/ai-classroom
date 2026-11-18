import test from 'node:test';
import assert from 'node:assert/strict';
import {groupSessionsByChallenge,transcriptAsText} from '../shared/session-history.mjs';

test('one challenge groups multiple independently deletable attempts',()=>{
 const groups=groupSessionsByChallenge([
  {id:'a',challengeId:'mafia-boss',startedAt:100,status:'completed'},
  {id:'b',challengeId:'mafia-boss',startedAt:400,status:'completed'},
  {id:'c',challengeId:'think-fast',startedAt:300,status:'active'},
 ]);
 assert.equal(groups.length,2);
 assert.equal(groups[0].challengeId,'mafia-boss');
 assert.deepEqual(groups[0].attempts.map(x=>x.id),['b','a']);
 assert.equal(groups[0].completed,2);
 assert.equal(groups[1].attempts.length,1);
});
test('transcript resource contains guided provenance and no invented timestamps',()=>{
 const txt=transcriptAsText('Meeting challenge',{transcript:[
 {role:'character',text:'What happened?',source:'ai'},
 {role:'user',text:'The meeting surprised me.'},
 {role:'character',text:'Explain the twist.',source:'guided'}
 ]});
 assert.match(txt,/YOU: The meeting surprised me/);
 assert.match(txt,/GUIDED PROMPT/);
 assert.doesNotMatch(txt,/\d{2}:\d{2}:\d{2}/);
 assert.ok(transcriptAsText('None',{transcript:[]}).includes('None'));
});
test('grouping ignores malformed and does not mutate original ordering',()=>{
 const source=[{id:'1',challengeId:'x',startedAt:1,status:'completed'},{id:'2',challengeId:'x',startedAt:5,status:'active'}];
 const g=groupSessionsByChallenge(source);
 assert.equal(source[0].id,'1'); assert.equal(g[0].attempts[0].id,'2');
 assert.equal(groupSessionsByChallenge(null).length,0);
});
