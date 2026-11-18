import test from 'node:test';
import assert from 'node:assert/strict';
import {challenges,categories,challengeById,catalogueVersion} from '../shared/catalog.mjs';
test('18 versioned challenges cover every category without duplicate ids',()=>{
 assert.ok(challenges.length>=16);
 assert.equal(new Set(challenges.map(x=>x.id)).size,challenges.length);
 for(const c of categories)assert.ok(challenges.some(x=>x.category===c.id),'missing '+c.id);
 assert.equal(catalogueVersion,1);
});
test('every challenge is distinctly structured and safe',()=>{
 const openers=new Set();
 for(const c of challenges){
  assert.ok(c.version>0);
  assert.ok(c.opening.length>30);
  assert.ok(c.objective.length>35);
  assert.ok(c.beats.length>=3);
  assert.ok(c.rubric.length>=2);
  assert.ok(c.maxTurns>=4&&c.maxTurns<=8);
  assert.ok(c.archetype.length>=6&&c.style);
  assert.ok(c.voice.rate>0);
  assert.equal(challengeById(c.id)?.id,c.id);
  openers.add(c.opening);
 }
 assert.equal(openers.size,challenges.length);
});
test('catalogue rejects unknown challenge ids',()=>{assert.equal(challengeById('not-a-challenge'),null);});
