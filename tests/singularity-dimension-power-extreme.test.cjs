'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname,
  '../src/core/secret-formula/celestials/singularity-milestones.js'), 'utf8');
const milestone = source.match(/  dimensionPow: \{([\s\S]*?)\n  \},/);
assert.ok(milestone, 'dimensionPow milestone must exist');
const formula = milestone[1].match(/effect: \(\) => (.*),/);
assert.ok(formula, 'dimensionPow effect must be a single expression');
const glyphLevelMilestone = source.match(/  glyphLevelFromSingularities: \{([\s\S]*?)\n  \},/);
assert.ok(glyphLevelMilestone, 'glyph-level milestone must exist');
const glyphLevelFormula = glyphLevelMilestone[1].match(/effect: \(\) => (.*),/);
assert.ok(glyphLevelFormula, 'glyph-level effect must be a single expression');
const theoremPowerMilestone = source.match(/  theoremPowerFromSingularities: \{([\s\S]*?)\n  \},/);
assert.ok(theoremPowerMilestone, 'Time Theorem power milestone must exist');
const theoremPowerFormula = theoremPowerMilestone[1].match(/effect: \(\) => (.*),/);
assert.ok(theoremPowerFormula, 'Time Theorem power effect must be a single expression');

class D {
  constructor(x) { this.n = x instanceof D ? x.n : x; }
  add(x) { return new D(this.n + new D(x).n); }
  sub(x) { return new D(this.n - new D(x).n); }
  div(x) { return new D(this.n / new D(x).n); }
  // Strict: implicit numeric conversion is never valid in this mock.
  valueOf() { throw new Error('Implicit conversion from Decimal'); }
  static log10(x) { return new D(Math.log10(new D(x).n)); }
  static pow(x, y) { return new D(new D(x).n ** new D(y).n); }
}
function ordinaryEffect(balance) {
  return vm.runInNewContext(formula[1], {
    Currency: { singularities: { value: new D(balance) } }, Decimal: D, Math
  }).n;
}

test('dimension power matches the pre-fix formula at normal balances', () => {
  for (const balance of [0, 1, 5, 1e10, 1e100]) {
    const expected = Math.sqrt(1 + Math.log10(balance + 1) / 125);
    assert.ok(Math.abs(ordinaryEffect(balance) - expected) < 1e-12, String(balance));
  }
});

test('dimension power keeps an unrepresentable Number exponent as Decimal', () => {
  // A faithful API-level double: log10(singularities + 1) is a *finite*
  // layered Decimal that cannot fit a native Number. An old .toNumber()
  // call throws, whereas Decimal pow accepts this operand without coercion.
  class HugeDecimal {
    constructor() { this.sign = 1; this.layer = 1; this.mag = 400; }
    div() { return this; }
    add() { return this; }
    toNumber() { throw new Error('unsafe Decimal.toNumber'); }
    valueOf() { throw new Error('implicit Decimal coercion'); }
  }
  const exponent = new HugeDecimal();
  let powCalled = false;
  const result = vm.runInNewContext(formula[1], {
    Currency: { singularities: { value: { add: () => ({}) } } },
    Decimal: {
      log10: () => exponent,
      pow(base, power) {
        assert.equal(base, exponent);
        assert.equal(power, 0.5);
        powCalled = true;
        return { sign: 1, layer: 1, mag: 200 };
      }
    }, Math
  });
  assert.equal(powCalled, true);
  assert.ok([result.sign, result.layer, result.mag].every(Number.isFinite));
  assert.doesNotMatch(formula[1], /\.toNumber\(\)|Math\.pow\(/);
});

test('dimension power preserves milestone unlock and formatting metadata', () => {
  assert.match(milestone[1], /start: new Decimal\(1e100\)/);
  assert.match(milestone[1], /repeat: new Decimal\(0\)/);
  assert.match(milestone[1], /limit: 1/);
});

test('glyph-level singularity multiplier preserves the ordinary formula as Decimal', () => {
  class GlyphDecimal extends D {
    static clampMin(value, minimum) {
      return new GlyphDecimal(Math.max(new GlyphDecimal(value).n, new GlyphDecimal(minimum).n));
    }
  }
  for (const balance of [1, 1e20, 1e50]) {
    const actual = vm.runInNewContext(glyphLevelFormula[1], {
      Currency: { singularities: { value: new GlyphDecimal(balance) } }, Decimal: GlyphDecimal
    }).n;
    const expected = 1 + Math.max((Math.log10(balance) - 20) / 30, 0);
    assert.ok(Math.abs(actual - expected) < 1e-12, String(balance));
  }
});

test('glyph-level singularity multiplier never coerces a finite huge Decimal to Number', () => {
  const huge = {
    sign: 1,
    layer: 1,
    mag: 400,
    sub: () => huge,
    div: () => huge,
    toNumber: () => { throw new Error('unsafe Decimal.toNumber'); },
  };
  let added;
  const result = vm.runInNewContext(glyphLevelFormula[1], {
    Currency: { singularities: { value: {} } },
    Decimal: class {
      constructor(value) { this.value = value; }
      add(value) { added = value; return value; }
      static log10() { return huge; }
      static clampMin(value) { return value; }
    }
  });
  assert.equal(added, huge);
  assert.equal(result, huge);
  assert.ok([result.sign, result.layer, result.mag].every(Number.isFinite));
  assert.doesNotMatch(glyphLevelFormula[1], /\.toNumber\(\)|\b1\s*\+/);
});

test('Time Theorem singularity power preserves the ordinary formula as Decimal', () => {
  for (const balance of [0, 1, 1e20, 1e100]) {
    const actual = vm.runInNewContext(theoremPowerFormula[1], {
      Currency: { singularities: { value: new D(balance) } }, Decimal: D, DC: { D1: new D(1) }
    }).n;
    const expected = 1 + Math.log10(balance + 1) / 70;
    assert.ok(Math.abs(actual - expected) < 1e-12, String(balance));
  }
});

test('Time Theorem singularity power never coerces a finite huge Decimal to Number', () => {
  const huge = {
    sign: 1,
    layer: 1,
    mag: 400,
    div: () => huge,
    toNumber: () => { throw new Error('unsafe Decimal.toNumber'); },
  };
  let added;
  const result = vm.runInNewContext(theoremPowerFormula[1], {
    Currency: { singularities: { value: { add: () => ({}) } } },
    Decimal: { log10: () => huge },
    DC: { D1: { add: value => { added = value; return value; } } }
  });
  assert.equal(added, huge);
  assert.equal(result, huge);
  assert.ok([result.sign, result.layer, result.mag].every(Number.isFinite));
  assert.doesNotMatch(theoremPowerFormula[1], /\.toNumber\(\)|\b1\s*\+/);
});
