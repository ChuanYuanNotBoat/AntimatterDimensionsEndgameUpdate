const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const formula = fs.readFileSync(path.join(root, 'src/core/secret-formula/celestials/ra.js'), 'utf8');
const runtime = fs.readFileSync(path.join(root, 'src/core/celestials/ra/ra.js'), 'utf8');

// This is a type-contract test, NOT a full numerical simulation. In-game valueOf()
// throws, and an extreme but finite Decimal can exceed JS Number.MAX_VALUE.
class HugeDecimal {
  valueOf() { throw new Error('Implicit conversion from Decimal to number'); }
  div() { return this; }
  add() { return this; }
  pLog10() { return this; }
  toNumber() { return Infinity; }
  static pow() { return new HugeDecimal(); }
}
const DC = { D1: new HugeDecimal() };
const player = { disablePostReality: false, records: { bestReality: { glyphLevel: new HugeDecimal() } } };
const Currency = { realityMachines: { value: new HugeDecimal() } };

function effect(name) {
  const block = formula.split(`${name}: {`)[1];
  assert.ok(block, `Missing ${name} Ra unlock`);
  const line = block.match(/^\s*effect: \(\) => (.+),\s*$/m);
  assert.ok(line, `Missing effect of ${name}`);
  return vm.runInNewContext(`(() => ${line[1]})`, { DC, Decimal: HugeDecimal, player, Currency });
}

test('extreme glyph-level Ra memory factor never goes through Number', () => {
  const formulaFn = effect('effarigXP');
  assert.ok(formulaFn() instanceof HugeDecimal);
  player.disablePostReality = true;
  assert.ok(formulaFn() instanceof HugeDecimal);
  player.disablePostReality = false;
});

test('extreme RM-based Ra memory factor also remains Decimal', () => {
  const formulaFn = effect('teresaXP');
  assert.ok(formulaFn() instanceof HugeDecimal);
  player.disablePostReality = true;
  assert.ok(formulaFn() instanceof HugeDecimal);
  player.disablePostReality = false;
});

test('Ra multipliers and chunk production are composed via Decimal operations', () => {
  assert.match(runtime, /res = res\.times\(pet\.memoryProductionMultiplier\)/);
  assert.match(runtime, /this\.memoryChunks\.add\(newMemoryChunks\.div\(2\)\)\)\.times\(seconds\)\.times\(Ra\.productionPerMemoryChunk\)/);
  assert.match(runtime, /Decimal\.eq\(pet\.memoryProductionMultiplier, 1\)/);
});
