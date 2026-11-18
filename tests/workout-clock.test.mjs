import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorkoutClock} from '../shared/workout-clock.mjs';

test('pause excludes time spent stopped and resume continues elapsed time',()=>{
 let now=0;
 const clock=createWorkoutClock(()=>now);
 clock.start();
 now=3700;assert.equal(clock.seconds(),3);
 clock.pause();now=9700;assert.equal(clock.seconds(),3);
 clock.resume();now=13300;assert.equal(clock.seconds(),7);
 clock.pause();assert.equal(clock.seconds(),7);
});
test('repeated pause and resume do not double count seconds',()=>{
 let now=1000;
 const clock=createWorkoutClock(()=>now);
 clock.start();now=2500;clock.pause();clock.pause();
 now=8300;clock.resume();clock.resume();
 now=9300;assert.equal(clock.seconds(),2);
 clock.start();assert.equal(clock.seconds(),0);
});
test('clock caps duration at twenty minutes to match the API',()=>{
 let now=0;
 const clock=createWorkoutClock(()=>now);
 clock.start();now=5_000_000;
 assert.equal(clock.seconds(),1200);
});
