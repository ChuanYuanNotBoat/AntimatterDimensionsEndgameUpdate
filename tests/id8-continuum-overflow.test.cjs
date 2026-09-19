'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const root = path.join(__dirname, '..', 'src', 'core');
const read = file => fs.readFileSync(path.join(root, file), 'utf8').replace(/\r\n/g, '\n');
const CAP = 1e6;

// Deliberately small Decimal boundary: overflowing native-like math becomes
// nonfinite, whereas the actual bounded helpers must intercept the operation.
class D {
  constructor(value) {
    this.n = value instanceof D ? value.n : value;
    this.sign = Math.sign(this.n);
    this.layer = Number.isFinite(this.n) ? 0 : Infinity;
    this.mag = Math.abs(this.n);
  }
  valueOf() { throw new Error('Implicit conversion from Decimal to number'); }
  eq(x) { return this.n === new D(x).n; }
  gt(x) { return this.n > new D(x).n; }
  gte(x) { return this.n >= new D(x).n; }
  lt(x) { return this.n < new D(x).n; }
  lte(x) { return this.n <= new D(x).n; }
  add(x) { return new D(this.n + new D(x).n > CAP ? Infinity : this.n + new D(x).n); }
  sub(x) { return new D(this.n - new D(x).n); }
  div(x) { return new D(this.n / new D(x).n); }
  times(x) { const v = this.n * new D(x).n; return new D(v > CAP ? Infinity : v); }
  pow(x) { const v = this.n ** new D(x).n; return new D(v > CAP ? Infinity : v); }
  log10() { return new D(Math.log10(this.n)); }
  max(x) { return new D(Math.max(this.n, new D(x).n)); }
  static log10(x) { return new D(x).log10(); }
  static floor(x) { return new D(Math.floor(new D(x).n)); }
  static clamp(x, min, max) {
    return new D(Math.min(Math.max(new D(x).n, new D(min).n), new D(max).n));
  }
  static min(a, b) { return new D(Math.min(new D(a).n, new D(b).n)); }
}

function world() {
  const context = { Decimal: D, DC: { D0: new D(0), D1: new D(1), BEMAX: new D(CAP) }, Math, Number, Error };
  const bounded = read('finite-decimal.js').replace(/^export /gm, '');
  vm.runInNewContext(bounded + '\nglobalThis.bounds = { boundedPositivePower, boundedPositiveProduct, boundedPositiveSum };', context);
  Object.assign(context, context.bounds);
  const checks = read('dimensions/dimension.js');
  const prefix = checks.slice(0, checks.indexOf('export class DimensionState')).replace(/^export /gm, '');
  vm.runInNewContext(prefix + '\nglobalThis.assertDimensionFinite = assertDimensionFinite;', context);
  const idSource = read('dimensions/infinity-dimension.js');
  const purchaseStart = idSource.indexOf('  get purchaseCap() {');
  const purchaseEnd = idSource.indexOf('  get isCapped() {', purchaseStart);
  const start = idSource.indexOf('  get continuumValue() {');
  const end = idSource.indexOf('  resetAmount() {', start);
  assert.ok(purchaseStart > 0 && purchaseEnd > purchaseStart && start > 0 && end > start);
  context.Enslaved = { isRunning: false };
  context.InfinityDimensions = { capIncrease: new D(3e5), HARDCAP_PURCHASES: 50000 };
  context.EternityChallenge = () => ({ isRunning: false });
  context.Alpha = { currentStage: 12 };
  context.player = { disablePostReality: false };
  context.Laitela = { continuumActive: true, matterExtraPurchaseFactor: new D(2000) };
  vm.runInNewContext(`class TestID { ${idSource.slice(purchaseStart, purchaseEnd)} ${idSource.slice(start, end)} }; globalThis.id = new TestID();`, context);
  const id = context.id;
  id.tier = 8;
  id.amount = new D(0);
  id.isAvailableForPurchase = true;
  Object.defineProperty(id, 'getContinuumValue', { configurable: true, value: new D(2000) });
  return { id, context };
}

test('ID8 Tesseract purchase cap does not overflow BEMAX + a positive increment', () => {
  const { id } = world();
  assert.equal(id.purchaseCap.n, CAP);
  id.tier = 7;
  assert.equal(id.purchaseCap.n, 350000);
});

test('ID8 finite Continuum factors never overflow amount or totalAmount before rate evaluation', () => {
  const { id } = world();
  assert.equal(id.continuumValue.n, CAP);
  assert.equal(id.continuumAmount.n, CAP);
  assert.equal(id.totalAmount.n, CAP);
});

test('invalid saved ID8 amount is diagnosed rather than disguised as a capped gain', () => {
  const { id } = world();
  id.amount = new D(Infinity);
  assert.throws(() => id.totalAmount, /Dimension non-finite.*step=stored amount/);
});

test('an independently nonfinite Continuum multiplier reports its source', () => {
  const { id, context } = world();
  context.Laitela.matterExtraPurchaseFactor = new D(Infinity);
  assert.throws(() => id.continuumValue, /Dimension non-finite.*step=continuum multiplier/);
});

function factorWorld({ dark = 100, exponent = 2, sing = 1, charge = 2, active = true } = {}) {
  const { context } = world();
  context.Pelle = { isDoomed: false };
  context.PelleDestructionUpgrade = { continuumBuff: { canBeApplied: false } };
  context.Currency = { darkMatter: { max: new D(dark) } };
  context.SingularityMilestone = {
    continuumMult: { effectOrDefault: () => new D(sing) },
    singContinuumBoost: { applyEffect(callback) { if (active) callback(new D(3)); } },
  };
  context.DualityUpgrade = id => ({ effectOrDefault: () => id === 14 ? new D(exponent) : new D(2) });
  context.Hadrons = { continuumMultiplier: new D(4) };
  context.BreakInfinityUpgrade = { autobuyerSpeed: { chargedEffect: { effectOrDefault: () => new D(charge) } } };
  const source = read('celestials/laitela/laitela.js');
  const start = source.indexOf('  get matterExtraPurchaseFactor() {');
  const end = source.indexOf('  get hadronizes() {', start);
  assert.ok(start > 0 && end > start);
  vm.runInNewContext(`const Laitela = {${source.slice(start, end)}}; globalThis.factor = Laitela;`, context);
  return context.factor;
}

test('ordinary Lai tela Continuum multiplier preserves the original factor order', () => {
  const value = factorWorld().matterExtraPurchaseFactor;
  const originalBase = ((Math.log10(101) / 50) ** 0.4 * 0.5 + 1) * (1 + 1) * 2 * 4 * 3;
  assert.ok(Math.abs(value.n / (originalBase ** 2 * 2) - 1) < 1e-12);
});

test('large finite Lai tela exponent and chained factor saturate without Infinity', () => {
  const value = factorWorld({ exponent: 10, sing: 100 }).matterExtraPurchaseFactor;
  assert.equal(value.n, CAP);
  const dark = factorWorld({ dark: 1e5, exponent: 4 }).matterExtraPurchaseFactor;
  assert.equal(dark.n, CAP);
});

test('invalid dark matter and NaN exponent remain diagnostic errors', () => {
  assert.throws(() => factorWorld({ dark: Infinity }).matterExtraPurchaseFactor,
    /Non-finite dark matter/);
  assert.throws(() => factorWorld({ exponent: NaN }).matterExtraPurchaseFactor,
    /Invalid Decimal operand/);
});
