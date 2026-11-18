import test from 'node:test';
import assert from 'node:assert/strict';
import { checkFactorisation } from '../server/assessment.mjs';
test('accepts correct factorisation, including reversed factors', () => {
  assert.equal(checkFactorisation('(x+2)(x+3)'), true);
  assert.equal(checkFactorisation(' (x+3) (x+2) '), true);
});
test('rejects expansions, incorrect sums, malicious expressions and partial work', () => {
  for (const v of ['x^2+5x+6','(x+1)(x+6)', 'process.exit()', '(x+2)', '(x-2)(x-3)']) assert.equal(checkFactorisation(v), false);
});
