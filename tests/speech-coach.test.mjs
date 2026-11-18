import test from 'node:test';
import assert from 'node:assert/strict';
import {challenges} from '../shared/catalog.mjs';
import {countWords,sanitizeConversation,guidedFollowUp,deterministicReview,validateAIReview} from '../server/speech-coach.mjs';
test('feedback never invents acoustic or personality scores',()=>{
 const d=deterministicReview(challenges[0],['Hello there, I enjoy music and walking. What do you like doing?']);
 assert.ok(d.strength&&d.improvement&&d.nextRep);
 assert.equal(d.evidence.turns,1);
 assert.equal(d.evidence.questions,1);
 assert.ok(!('confidence' in d));
 assert.match(d.disclaimer,/accent/i);
});
test('no speech gives transparent, useful retry feedback',()=>{
 const d=deterministicReview(challenges[0],[]);
 assert.match(d.improvement,/no spoken/i);
 assert.match(d.nextRep,/again/i);
});
test('history bounds strip invalid turns and long prompts',()=>{
 const history=Array.from({length:35},(_,i)=>({role:i%2?'character':'user',text:'x'.repeat(2000)}));
 const clean=sanitizeConversation(history);
 assert.equal(clean.length,14);assert.equal(clean[0].text.length,1200);
 assert.deepEqual(sanitizeConversation([{role:'admin',text:'hello'}]),[]);
});
test('guided follow-ups stay in a challenge and generated rubric requires evidence-safe fields',()=>{
 const c=challenges[6];
 assert.ok(guidedFollowUp(c,4).includes('closing'));
 assert.equal(validateAIReview({},c,[]),null);
 assert.equal(countWords('hello  world'),2);
});
