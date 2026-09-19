'use strict';
// Test the actual gameplay methods with a strict, deliberately small Decimal ceiling.
// This is a mock of arithmetic over the representation boundary, not a browser test.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const root = path.join(__dirname, '..', 'src', 'core');
const read = file => fs.readFileSync(path.join(root, file), 'utf8').replace(/\r\n/g, '\n');
const CAP = 1e6;

class D {
  constructor(value) {
    if (value instanceof D) this.n = value.n;
    else if (typeof value === 'number') this.n = value;
    else throw new Error('unexpected decimal input');
    this.sign = Math.sign(this.n);
    this.layer = Number.isFinite(this.n) ? 0 : Infinity;
    this.mag = Number.isFinite(this.n) ? Math.abs(this.n) : Infinity;
  }
  valueOf() { throw new Error('Implicit conversion from Decimal to number'); }
  eq(value) { return this.n === new D(value).n; }
  gt(value) { return this.n > new D(value).n; }
  gte(value) { return this.n >= new D(value).n; }
  lt(value) { return this.n < new D(value).n; }
  sub(value) { return new D(this.n - new D(value).n); }
  div(value) { return new D(this.n / new D(value).n); }
  add(value) { return new D(this.n + new D(value).n > CAP ? Infinity : this.n + new D(value).n); }
  times(value) { const result = this.n * new D(value).n; return new D(result > CAP ? Infinity : result); }
  log10() { return new D(Math.log10(this.n)); }
  floor() { return new D(Math.floor(this.n)); }
  toNumber() { if (this.n >= Number.MAX_SAFE_INTEGER) throw new Error('unsafe Decimal -> Number'); return this.n; }
  static clamp(value, min, max) {
    const n = new D(value).n;
    return new D(Math.min(Math.max(n, new D(min).n), new D(max).n));
  }
  static floor(value) { return new D(Math.floor(new D(value).n)); }
  static min(a,b) { return new D(Math.min(new D(a).n, new D(b).n)); }
}

function idWorld({ amount, multiplier, diff = 1000, dest = 0, ec7 = false }) {
  const context = { Decimal: D, DC: { D0: new D(0), D1: new D(1), BEMAX: new D(CAP) }, Number, Math, Error };
  const boundedSource = read('finite-decimal.js').replace(/^export /gm, '');
  vm.runInNewContext(boundedSource +
    '\nglobalThis.bounds = { boundedPositiveProduct, boundedPositiveSum };', context);
  const checkSource = read('dimensions/dimension.js');
  const helper = checkSource.slice(0, checkSource.indexOf('export class DimensionState'))
    .replace('export function assertDimensionFinite', 'function assertDimensionFinite');
  vm.runInNewContext(helper + '\nglobalThis.check = assertDimensionFinite;', context);
  Object.assign(context, {
    boundedPositiveProduct: context.bounds.boundedPositiveProduct,
    boundedPositiveSum: context.bounds.boundedPositiveSum,
    assertDimensionFinite: context.check,
    EternityChallenge: id => ({ isRunning: id === 7 && ec7 }),
    Laitela: { isRunning: false },
    player: { disablePostReality: false },
    Tickspeed: { perSecond: new D(10) },
    getGameSpeedupForDisplay: () => 2,
  });
  const source = read('dimensions/infinity-dimension.js');
  const start = source.indexOf('  get productionPerSecond() {');
  const end = source.indexOf('  get multiplier() {', start);
  assert.ok(start > 0 && end > start, 'actual ID production methods found');
  const methods = source.slice(start, end);
  vm.runInNewContext(`class TestID { ${methods} }; globalThis.id = new TestID();`, context);
  const id = context.id;
  id.tier = 8;
  id.amount = new D(0);
  id.totalAmount = new D(amount);
  id.multiplier = new D(multiplier);
  const target = { tier: 7, amount: new D(dest) };
  const currency = { value: new D(dest) };
  return { id, target, currency, diff };
}

test('ordinary ID rate, 1/10-second tier transfer, and currency results remain unchanged', () => {
  const { id, target, currency, diff } = idWorld({ amount: 10, multiplier: 20, diff: 1000, dest: 30 });
  assert.equal(id.productionPerSecond.n, 200);
  assert.equal(id.productionForDiff(diff).n, 200);
  id.produceDimensions(target, diff / 10);
  assert.equal(target.amount.n, 50);
  id.produceCurrency(currency, diff);
  assert.equal(currency.value.n, 230);
  assert.equal(id.productionPerRealSecond.n, 400);
});

test('finite near-ceiling ID multiplier times continuum amount no longer creates Infinity', () => {
  const { id, target, currency, diff } = idWorld({ amount: 2000, multiplier: 1000, diff: 100000, dest: 800000 });
  assert.equal(id.productionPerSecond.n, CAP, 'bounded only at the existing representable boundary');
  assert.equal(id.productionForDiff(diff).n, CAP);
  id.produceDimensions(target, diff);
  assert.equal(target.amount.n, CAP, 'destination add is also bounded');
  id.produceCurrency(currency, diff);
  assert.equal(currency.value.n, CAP);
  assert.equal(id.productionPerRealSecond.n, CAP);
});

test('EC7 tickspeed multiplication, and zero-source multiplication, respect the original order', () => {
  const { id } = idWorld({ amount: 2, multiplier: 3, ec7: true });
  assert.equal(id.productionPerSecond.n, 60);
  const zero = idWorld({ amount: 0, multiplier: 900000 });
  assert.equal(zero.id.productionPerSecond.n, 0);
});

test('a genuinely nonfinite ID multiplier remains diagnostic instead of becoming a legitimate capped gain', () => {
  const { id } = idWorld({ amount: 200, multiplier: Infinity });
  assert.throws(() => id.productionPerSecond, /Dimension non-finite.*step=multiplier/);
});

function tesseractWorld() {
  const source = read('celestials/enslaved.js');
  const start = source.indexOf('export const Tesseracts = {');
  const end = source.indexOf('\nEventHub.logic.on(', start);
  assert.ok(start > 0 && end > start);
  const context = {
    Decimal: D, DC: { BEMAX: new D(CAP), D0: new D(0) },
    player: { celestials: { enslaved: { tesseracts: 703 } }, disablePostReality: false },
    Currency: { infinityPoints: { gte: () => true } },
    Enslaved: { isCompleted: true }, GameEnd: { creditsEverClosed: false }, Number, Math, Error,
    console: { warn: () => {} },
  };
  vm.runInNewContext(source.slice(start, end).replace('export const ', 'const ') +
    '\nglobalThis.Tesseracts = Tesseracts;', context);
  const t = context.Tesseracts;
  Object.defineProperty(t, 'nextCost', { configurable: true, value: new D(1) });
  return { t, context };
}

test('normal bulk purchase still buys the calculated amount exactly', () => {
  const { t, context } = tesseractWorld();
  Object.defineProperty(t, 'canBeBoughtRaw', { configurable: true, value: new D(705) });
  t.buyMaxTesseract();
  assert.equal(context.player.celestials.enslaved.tesseracts, 705);
});

test('oversized affordable count never enters unsafe toNumber or a nonfinite save setter', () => {
  const { t, context } = tesseractWorld();
  Object.defineProperty(t, 'canBeBoughtRaw', { configurable: true, value: new D(1e30) });
  t.buyMaxTesseract();
  assert.equal(context.player.celestials.enslaved.tesseracts, 704,
    'invalid bulk estimates can only buy the verified next Tesseract');
  context.player.celestials.enslaved.tesseracts = Number.MAX_SAFE_INTEGER;
  assert.equal(t.canBuyTesseract, false);
  assert.doesNotThrow(() => t.buyMaxTesseract());
});

test('single purchases stop when Number storage can no longer represent the next integer', () => {
  const { t, context } = tesseractWorld();
  context.player.celestials.enslaved.tesseracts = Number.MAX_SAFE_INTEGER - 1;
  t.buyTesseract();
  assert.equal(t.bought, Number.MAX_SAFE_INTEGER);
  t.buyTesseract();
  assert.equal(t.bought, Number.MAX_SAFE_INTEGER);
});

test('invalid bulk inverse remains diagnostic; no purchase is written', () => {
  const { t, context } = tesseractWorld();
  Object.defineProperty(t, 'canBeBoughtRaw', { configurable: true, value: new D(NaN) });
  assert.throws(() => t.buyMaxTesseract(), /Invalid affordable Tesseract count/);
  assert.equal(context.player.celestials.enslaved.tesseracts, 703);
});

test('fractional inverse floors safely; the nextCost gate still controls fallback', () => {
  const { t, context } = tesseractWorld();
  Object.defineProperty(t, 'canBeBoughtRaw', { configurable: true, value: new D(705.75) });
  t.buyMaxTesseract();
  assert.equal(context.player.celestials.enslaved.tesseracts, 705);
  Object.defineProperty(t, 'canBeBoughtRaw', { configurable: true, value: new D(1e30) });
  context.Currency.infinityPoints.gte = () => false;
  t.buyMaxTesseract();
  assert.equal(context.player.celestials.enslaved.tesseracts, 705);
});
