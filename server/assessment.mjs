// A deliberately narrow deterministic checker for the seeded exercise.
// Reorders factors, strips whitespace and standardises sign; does not use eval or an LLM.
function factor(term) {
  const normalized = term.replace(/\s/g, '').replace(/−/g,'-').toLowerCase();
  const m = normalized.match(/^\(x([+-])([0-9]+)\)\(x([+-])([0-9]+)\)$/);
  if (!m) return null;
  return [Number(`${m[1]}${m[2]}`), Number(`${m[3]}${m[4]}`)];
}
export function checkFactorisation(answer) {
  const values = factor(answer);
  return values !== null && values[0] + values[1] === 5 && values[0] * values[1] === 6;
}
