import test from 'node:test';
import assert from 'node:assert/strict';
import { guidedLessonLength, guidedLessonStep, nextGuidedState } from '../server/guided-lesson.mjs';

test('the curriculum has five complete, bounded, accurately-labelled beats', () => {
  assert.equal(guidedLessonLength, 5);
  for(let stage=0;stage<guidedLessonLength;stage++){
    const step=guidedLessonStep(stage);
    assert.equal(step.origin,'guided');
    assert.ok(step.speech.length>=15&&step.speech.length<=1200);
    assert.ok(step.heading.length>=2&&step.heading.length<=100);
    assert.ok(step.board.length>=1&&step.board.length<=6);
    for(const action of step.board){
      assert.ok(['write_text','write_equation','draw_arrow','draw_shape','clear_whiteboard'].includes(action.type));
      if ('text' in action) assert.ok(action.text.length<=180);
    }
  }
});

test('exercise does not reveal the answer before the learner responds', () => {
  const exercise=guidedLessonStep(3);
  assert.match(exercise.speech,/your turn/i);
  assert.ok(exercise.question);
  assert.ok(!exercise.board.some(b=>('text' in b)&&/\(x\s*\+\s*2\)\s*\(x\s*\+\s*3\)/.test(b.text)));
  assert.equal(nextGuidedState(3).status,'awaiting_answer');
});

test('stages advance in order and finish exactly once', () => {
  for(let i=0;i<guidedLessonLength;i++){
    const next=nextGuidedState(i);
    assert.equal(next.stage,i+1);
    assert.equal(next.status,i===3?'awaiting_answer':i===4?'completed':'teaching');
  }
  assert.throws(()=>guidedLessonStep(5),RangeError);
  assert.throws(()=>nextGuidedState(-1),RangeError);
});
