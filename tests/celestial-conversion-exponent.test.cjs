// The game-speed conversion exponent must never convert a huge Decimal Star reward to JS Number.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../src/core/dimensions/celestial-dimension.js'), 'utf8')
  .replace(/\r\n/g, '\n');
const start = source.indexOf('  get conversionExponent() {');
const end = source.indexOf('\n  }\n};', start);
assert.ok(start >= 0 && end > start, 'conversionExponent getter must be present');
const getter = source.slice(start, end + 4);

class D {
  constructor(value, huge = false) {
    this.n = value instanceof D ? value.n : Number(value);
    this.huge = huge || (value instanceof D && value.huge);
  }
  gt(value) { return this.huge || this.n > Number(value instanceof D ? value.n : value); }
  times(value) {
    const v = value instanceof D ? value : new D(value);
    return new D(this.n * v.n, this.huge || v.huge);
  }
  div(value) { return new D(this.n / Number(value), this.huge); }
  pow(value) {
    const v = value instanceof D ? value : new D(value);
    return new D(this.huge ? 1 : Math.pow(this.n, v.n), this.huge || v.huge);
  }
  timesEffectsOf(...effects) {
    return effects.reduce((acc, effect) => acc.times(effect.effectOrDefault(1)), this);
  }
  toNumber() {
    if (this.huge) throw Error('Precision-losing conversion of huge Yellow Star reward');
    return this.n;
  }
  valueOf() { return this.n; }
}
const effect = n => ({ effectOrDefault: () => n });
function evaluate({ reward = new D(3), doomed = false, alpha = false, disabled = false } = {}) {
  const context = {
    Decimal: D, DC: { D0: new D(0), D1: new D(1) },
    player: { disablePostReality: disabled },
    Alpha: { isRunning: alpha, celestialMatterConversionNerf: 0.8 },
    Pelle: { isDoomed: doomed },
    CelestialInfinityUpgrade: { celestialMatterConversionBuff: effect(2.5) },
    EndgameMastery: id => effect(id === 104 ? 1.2 : 1.1),
    Ra: { unlocks: { celestialDimensionConversionPower: effect(1.3) } },
    Achievement: id => effect(id === 208 ? 1.4 : 1.5),
    CelestialEternityUpgrade: { conversionFormulaImprovement: effect(1.6) },
    EtherealStars: { yellow: { reward } },
  };
  const obj = vm.runInNewContext(`({${getter}})`, context);
  return obj.conversionExponent;
}
test('ordinary formula preserves source multipliers and power ordering', () => {
  const expected = Math.pow(2.5 * 1.4 * 1.5 * 1.6 * 3, 1.2 * 1.3 * 1.1);
  assert.ok(Math.abs(evaluate().n / expected - 1) < 1e-12);
  assert.ok(Math.abs(evaluate({ alpha: true }).n / (expected * 0.8) - 1) < 1e-12);
});
test('Pelle checks base before applying multipliers and does not apply the exponent effects', () => {
  assert.ok(Math.abs(evaluate({ doomed: true }).n - (0.25 * 1.4 * 1.5 * 1.6 * 3)) < 1e-12);
});
test('very large Yellow Star reward remains Decimal; never converts to Infinity via Number', () => {
  const result = evaluate({ reward: new D(1, true) });
  assert.ok(result instanceof D);
  assert.equal(result.huge, true);
});
test('disabled post-Reality path remains zero', () => {
  assert.equal(evaluate({ disabled: true }).n, 0);
});
