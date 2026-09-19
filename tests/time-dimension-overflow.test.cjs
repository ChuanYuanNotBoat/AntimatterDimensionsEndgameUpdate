// Execute the real TD production methods with a strict finite Decimal model.
// The uploaded late-game save has near-ceiling IP/EP/Infinities and large TD amounts;
// tests use synthetic magnitudes instead of embedding a player's save in source control.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../src/core/dimensions/time-dimension.js'), 'utf8')
  .replace(/\r\n/g, '\n');
const start = source.indexOf('class TimeDimensionState extends DimensionState {');
const end = source.indexOf('\n/**\n * @function', start);
assert.ok(start >= 0 && end > start, 'TD gameplay class must be present');
const classSource = source.slice(start, end);
const MAX = 1000000;

class D {
  constructor(value) { this.n = Number(value instanceof D ? value.n : value); }
  valueOf() { return this.n; }
  plus(other) { return new D(this.n + Number(other)); }
  times(other) { return new D(this.n * Number(other)); }
  div(other) { return new D(this.n / Number(other)); }
  pow(other) { return new D(this.n ** Number(other)); }
  eq(other) { return this.n === Number(other); }
  max(other) { return new D(Math.max(this.n, Number(other))); }
  gt(other) { return this.n > Number(other); }
}

function bounded(kind, left, right) {
  const a = Number(left);
  const b = Number(right);
  if (Number.isNaN(a) || Number.isNaN(b)) throw new Error(`Invalid TD ${kind} operand`);
  const result = kind === 'sum' ? a + b : kind === 'power' ? a ** b : a * b;
  return new D(Math.min(result, MAX));
}

function setup({ amount = 10, multiplier = 3, tier = 7, ec7 = false, glyphPower = 1 } = {}) {
  const id8 = checkedDestination(MAX - 1);
  const context = {
    DimensionState: class DimensionState { get tier() { return this._tier; } },
    Decimal: D,
    DC: { D0: new D(0), D1: new D(1) },
    boundedPositiveProduct: (a, b) => bounded('product', a, b),
    boundedPositiveSum: (a, b) => bounded('sum', a, b),
    boundedPositivePower: (a, b) => bounded('power', a, b),
    EternityChallenge: id => ({ isRunning: ec7 && id === 7 }),
    Laitela: { isRunning: false, maxAllowedDimension: 8 },
    Alpha: { isRunning: false, currentStage: 0 },
    getAdjustedGlyphEffect: () => new D(glyphPower),
    Tickspeed: { perSecond: new D(2) },
    Math, Number,
  };
  vm.runInNewContext(`${classSource}\nthis.TD = TimeDimensionState;`, context);
  const td = Object.create(context.TD.prototype);
  td._tier = tier;
  Object.defineProperties(td, {
    totalAmount: { value: new D(amount) },
    multiplier: { value: new D(multiplier) },
    highestProducingDimension: { value: 8 },
  });
  return { td, id8, context };
}

function checkedDestination(initial) {
  let amount = new D(initial);
  return {
    get amount() { return amount; },
    set amount(value) {
      assert.ok(Number.isFinite(value.n) && value.n <= MAX, 'overflow entered the destination setter');
      amount = value;
    },
  };
}

test('ordinary TD7 -> TD6 production preserves gameplay arithmetic', () => {
  const { td } = setup();
  const target = checkedDestination(10);
  assert.equal(td.productionPerSecond.n, 30);
  td.produceDimensions(target, 100);
  assert.equal(target.amount.n, 13);
});

test('the first overflowing multiplier is bounded before producing TD6', () => {
  const { td } = setup({ amount: MAX, multiplier: MAX });
  const target = checkedDestination(10);
  td.produceDimensions(target, 1000);
  assert.equal(target.amount.n, MAX);
});

test('destination TD balance saturates even when production itself is finite', () => {
  const { td } = setup();
  const target = checkedDestination(MAX - 1);
  td.produceDimensions(target, 1000);
  assert.equal(target.amount.n, MAX);
});

test('TD1 timeshard glyph exponent and currency addition remain finite', () => {
  const { td } = setup({ tier: 1, amount: 100, multiplier: 100, glyphPower: 10 });
  const currency = checkedDestination(MAX - 1);
  // A currency uses the same value assignment contract as a dimension amount.
  const c = { get value() { return currency.amount; }, set value(v) { currency.amount = v; } };
  assert.equal(td.productionPerSecond.n, MAX);
  td.produceCurrency(c, 1000);
  assert.equal(c.value.n, MAX);
});

test('EC7 tickspeed production is bounded before the TD destination setter', () => {
  const { td } = setup({ amount: MAX, multiplier: MAX, ec7: true });
  const target = checkedDestination(MAX - 1);
  td.produceDimensions(target, 1000);
  assert.equal(target.amount.n, MAX);
});

test('real upstream NaN reports an error rather than being silently capped', () => {
  const { td } = setup({ multiplier: NaN });
  const target = checkedDestination(10);
  assert.throws(() => td.produceDimensions(target, 1000), /Invalid TD product operand/);
  assert.equal(target.amount.n, 10);
});

test('tick EC7 reward uses a bounded product and a bounded ID8 sum', () => {
  const tickStart = source.indexOf('  tick(diff) {', source.indexOf('export const TimeDimensions = {'));
  assert.ok(tickStart > 0, 'TD tick must be present');
  // Extract the complete method, including its callback's nested braces.
  let depth = 0;
  let tickEnd = -1;
  const open = source.indexOf('{', tickStart);
  for (let i = open; i < source.length; i++) {
    if (source[i] === '{') depth++;
    if (source[i] === '}') {
      depth--;
      if (depth === 0) { tickEnd = i + 1; break; }
    }
  }
  assert.ok(tickEnd > open);
  const method = source.slice(tickStart, tickEnd);
  const { td } = setup({ amount: 0, multiplier: 1 });
  const id8 = checkedDestination(MAX - 1);
  const ctx = {
    Decimal: D,
    TimeDimension: () => ({ ...td, amount: new D(0), continuumAmount: new D(0),
      produceDimensions() {}, produceCurrency() {} }),
    InfinityDimension: () => id8,
    EternityChallenge: () => ({ isRunning: false, reward: { applyEffect: fn => fn(new D(MAX)) } }),
    Currency: { timeShards: { add() {} } },
    TimeDimensions: { all: [{ amount: new D(0), continuumAmount: new D(0) }] },
    player: { requirementChecks: { endgame: { onlyLowDims: true } } },
    boundedPositiveProduct: (a, b) => bounded('product', a, b),
    boundedPositiveSum: (a, b) => bounded('sum', a, b),
  };
  vm.runInNewContext(`this.tick = ({ ${method} }).tick;`, ctx);
  ctx.tick(1000);
  assert.equal(id8.amount.n, MAX);
});
