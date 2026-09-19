const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

class D {
  constructor(n) {
    this.n = n instanceof D ? n.n : Number(n);
    this.sign = Math.sign(this.n);
    this.layer = Number.isFinite(this.n) ? 0 : this.n;
    this.mag = Math.abs(this.n);
  }
  times(x) { return new D(this.n * new D(x).n); }
  div(x) { return new D(this.n / new D(x).n); }
  plus(x) {
    const sum = this.n + new D(x).n;
    // Deliberately lower the mock Decimal layer ceiling to exercise overflow at addition.
    return new D(sum > 1e300 ? Infinity : sum);
  }
}
const source = fs.readFileSync(path.join(__dirname, '../src/core/dimensions/dimension.js'), 'utf8')
  .replace(/^export /gm, '');
const context = { Decimal: D, Number, Math, NotImplementedError: Error };
vm.runInNewContext(`${source}\nthis.DimensionState = DimensionState;`, context);
class SampleDimension extends context.DimensionState {
  constructor(amount, multiplier, tier) {
    let state = { amount: new D(amount) };
    super(() => [state], tier);
    this._state = state;
    this._multiplier = new D(multiplier);
  }
  get multiplier() { return this._multiplier; }
  get amount() { return this._state.amount; }
  set amount(v) {
    assert.ok(Number.isFinite(v.n), 'generic save setter must not receive Infinity or NaN');
    this._state.amount = v;
  }
  get productionPerSecond() { return this.amount.times(this.multiplier); }
}

test('ordinary production remains unchanged', () => {
  const sourceDim = new SampleDimension(10, 3, 8);
  const dest = new SampleDimension(5, 1, 7);
  sourceDim.produceDimensions(dest, 100);
  assert.equal(dest.amount.n, 8);
});

test('detects overflow inside the rate getter, reports producer and its factors', () => {
  const sourceDim = new SampleDimension(1e300, 1e300, 8);
  const dest = new SampleDimension(5, 1, 7);
  assert.throws(() => sourceDim.produceDimensions(dest, 100), e =>
    /SampleDimension\(8\).*step=productionPerSecond.*sourceMultiplier=Decimal/.test(e.message));
  assert.equal(dest.amount.n, 5);
});

test('distinguishes multiplication by diff from the original rate', () => {
  const sourceDim = new SampleDimension(1e200, 1, 8);
  const dest = new SampleDimension(5, 1, 7);
  assert.throws(() => sourceDim.produceDimensions(dest, 1e200), /step=rate \* diff/);
  assert.equal(dest.amount.n, 5);
});

test('distinguishes destination overflow from production overflow', () => {
  const sourceDim = new SampleDimension(8e299, 1, 8);
  const dest = new SampleDimension(8e299, 1, 7);
  assert.throws(() => sourceDim.produceDimensions(dest, 1000), /step=destination amount \+ gain/);
  assert.equal(dest.amount.n, 8e299);
});

test('rejects bad diff before corrupting the destination', () => {
  const sourceDim = new SampleDimension(10, 1, 8);
  const dest = new SampleDimension(10, 1, 7);
  assert.throws(() => sourceDim.produceDimensions(dest, Infinity), /step=diff/);
  assert.equal(dest.amount.n, 10);
});

test('ordinary currency production is unchanged', () => {
  const sourceDim = new SampleDimension(10, 2, 1);
  const currency = { n: 0, add(x) { this.n += x.n; } };
  sourceDim.produceCurrency(currency, 100);
  assert.equal(currency.n, 2);
});
