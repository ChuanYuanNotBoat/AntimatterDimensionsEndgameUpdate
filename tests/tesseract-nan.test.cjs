// Regression tests against the actual Tesseracts getters, without loading the game UI.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../src/core/celestials/enslaved.js'), 'utf8')
  .replace(/\r\n/g, '\n');
const start = source.indexOf('export const Tesseracts = {');
const end = source.indexOf('\n};\n\nEventHub.', start);
assert.ok(start >= 0 && end > start, 'Tesseracts object must be present');
const getters = source.slice(start, end + 3).replace('export const', 'const') + '\nthis.tesseracts = Tesseracts;';

class MockDecimal {
  constructor(value) { this.value = Number(value); }
  valueOf() { return this.value; }
  times(value) { return new MockDecimal(this.value * Number(value)); }
  add(value) { return new MockDecimal(this.value + Number(value)); }
  static pow(base, exponent) {
    assert.ok(Number.isFinite(Number(exponent)), 'Decimal.pow must not receive an infinite Tesseract count');
    return new MockDecimal(1);
  }
}

function setup({ bought = 10, singularityMultiplier = 2, mastery = 0, thresholdMultiplier = 2,
  raMultiplier = 1, totalMultiplier = 1, destroyed = false } = {}) {
  const context = {
    player: { celestials: { enslaved: { tesseracts: bought } }, disablePostReality: false },
    SingularityMilestone: { tesseractMultFromSingularities: { effectOrDefault: () => singularityMultiplier } },
    EndgameMastery: () => ({}),
    Effects: { sum: () => mastery, product: () => totalMultiplier },
    EndgameUpgrade: () => ({ effectOrDefault: () => thresholdMultiplier }),
    Ra: { unlocks: { freeTesseractIncrease: { effectOrDefault: () => raMultiplier } } },
    Alpha: { isDestroyed: destroyed },
    BreakEternityUpgrade: { tesseractMultiplier: {} },
    Decimal: MockDecimal, DC: { D0: new MockDecimal(0) },
    // The real module imports these helpers; this VM fixture evaluates only
    // the Tesseracts object, so provide equivalent API stubs explicitly.
    boundedPositivePower: (base, exponent) => MockDecimal.pow(base, exponent),
    boundedPositiveProduct: (left, right) => new MockDecimal(
      Math.min(Number(left) * Number(right), Number.MAX_VALUE)),
    Octeracts: { cubeBoost: () => 1 }, AlchemyResource: { boundless: { effectValue: 0 } },
    ExpansionPack: { enslavedPack: { isBought: false } },
    Number, Math, Error,
  };
  vm.runInNewContext(getters, context);
  return context.tesseracts;
}

function originalFiniteSoftcap(raw, start, destroyed) {
  return Math.max(
    Math.max((raw - start) * (1 / (1 + (raw - start) / start)), 0) + Math.min(raw, start),
    destroyed ? Math.min(raw, start) * (Math.log10(Math.max(raw - start, 1)) + 1) : 0
  );
}

test('finite Tesseract counts preserve the original gameplay formula, including destroyed Alpha', () => {
  for (const destroyed of [false, true]) {
    for (const [bought, singularityMultiplier, thresholdMultiplier, mastery] of [
      [0, 1, 1, 0], [10, 2, 2, 5], [50, 8, 1, 1], [100, 1, 5, 15], [1234, 1.23, 120, 1],
    ]) {
      const instance = setup({ bought, singularityMultiplier, thresholdMultiplier, mastery, destroyed });
      const actual = instance.extra;
      const expected = originalFiniteSoftcap(instance.rawExtra, instance.freeSoftcapStart, destroyed);
      assert.ok(Math.abs(actual - expected) <= 1e-11 * Math.max(1, expected),
        `expected ${expected}, got ${actual}`);
    }
  }
});

test('overflowed softcap threshold leaves a finite raw count unchanged', () => {
  const value = setup({ bought: 100, singularityMultiplier: 2, thresholdMultiplier: Infinity });
  assert.equal(value.rawExtra, 100);
  assert.equal(value.freeSoftcapStart, Infinity);
  assert.equal(value.extra, 100);
  assert.equal(value.effectiveCount, 200); // here default multiplier=1: bought 100 + extra 100
});

test('overflowed raw count retains the softcap limit instead of producing NaN', () => {
  const value = setup({ bought: 10, singularityMultiplier: Infinity, thresholdMultiplier: 2 });
  assert.equal(value.rawExtra, Infinity);
  assert.equal(value.extra, 200);
  assert.equal(value.effectiveCount, 210);
});

test('two overflowed inputs saturate to a finite representable count', () => {
  const value = setup({ bought: 10, singularityMultiplier: Infinity, thresholdMultiplier: Infinity });
  assert.equal(value.extra, Number.MAX_VALUE);
  assert.ok(Number.isFinite(value.effectiveCount));
  assert.ok(Number.isFinite(1 + value.effectiveCount / 1000), 'Alpha IP buff stays representable');
});

test('zero bought Tesseracts times an overflowed singularity effect stays zero', () => {
  const value = setup({ bought: 0, singularityMultiplier: Infinity, mastery: 1 });
  assert.equal(value.rawExtra, 1);
  assert.equal(value.extra, 1);
});

test('destroyed Alpha is finite even for overflowing raw inputs', () => {
  const value = setup({ bought: 10, singularityMultiplier: Infinity, destroyed: true });
  assert.equal(value.extra, Number.MAX_VALUE);
  assert.ok(Number.isFinite(value.effectiveCount));
});

test('stable form keeps the softcap contribution when raw / threshold overflows', () => {
  const value = setup({ bought: 1, singularityMultiplier: 1e300, thresholdMultiplier: 2e-302 });
  assert.ok(Math.abs(value.extra / 2e-300 - 1) < 1e-12);
});

test('effective Tesseract count cannot overflow Number when multiplier is enormous', () => {
  const value = setup({ bought: Number.MAX_VALUE, singularityMultiplier: 1, totalMultiplier: 2 });
  assert.equal(value.effectiveCount, Number.MAX_VALUE);
});

test('Tesseract cap computation never passes an infinite count to Decimal.pow', () => {
  const value = setup({ bought: 10, singularityMultiplier: Infinity, destroyed: true });
  assert.doesNotThrow(() => value.capIncrease());
});

test('genuinely invalid upstream NaN inputs still raise a diagnostic error', () => {
  assert.throws(() => setup({ thresholdMultiplier: NaN }).extra, /Invalid Tesseract softcap input/);
  assert.throws(() => setup({ singularityMultiplier: NaN }).extra, /Invalid Tesseract softcap input/);
});
