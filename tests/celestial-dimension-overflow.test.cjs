'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.join(__dirname, '..', 'src', 'core');
const read = file => fs.readFileSync(path.join(root, file), 'utf8').replace(/\r\n/g, '\n');
const CAP = 1e6;

// A strict Decimal surrogate with a small representation ceiling. Raw powers
// and products crossing it become invalid, so the real bounded helpers must
// intercept them before a dimension setter receives a nonfinite value.
class D {
  constructor(value) {
    this.n = value instanceof D ? value.n : value;
    this.sign = Math.sign(this.n);
    this.layer = Number.isFinite(this.n) ? 0 : Infinity;
    this.mag = Math.abs(this.n);
  }
  valueOf() { throw new Error('Implicit conversion from Decimal to number'); }
  toNumber() { return this.n; }
  eq(x) { return this.n === new D(x).n; }
  gt(x) { return this.n > new D(x).n; }
  gte(x) { return this.n >= new D(x).n; }
  lt(x) { return this.n < new D(x).n; }
  lte(x) { return this.n <= new D(x).n; }
  add(x) { return new D(this.n + new D(x).n); }
  sub(x) { return new D(this.n - new D(x).n); }
  div(x) { return new D(this.n / new D(x).n); }
  times(x) { const n = this.n * new D(x).n; return new D(n > CAP ? Infinity : n); }
  pow(x) { const n = this.n ** new D(x).n; return new D(n > CAP ? Infinity : n); }
  log10() { return new D(Math.log10(this.n)); }
  floor() { return new D(Math.floor(this.n)); }
  clampMin(x) { return new D(Math.max(this.n, new D(x).n)); }
  max(x) { return new D(Math.max(this.n, new D(x).n)); }
  static fromDecimal(x) { return new D(x); }
  static floor(x) { return new D(x).floor(); }
  static min(a, b) { return new D(Math.min(new D(a).n, new D(b).n)); }
  static clamp(x, lo, hi) { return new D(Math.min(Math.max(new D(x).n, new D(lo).n), new D(hi).n)); }
}
function effect(value, active = true) {
  return {
    applyEffect(callback) { if (active) callback(value); },
    effectOrDefault(fallback) { return active ? value : fallback; }
  };
}
function setup({ boosts = 1, tierBase = 2, sector = 2, tick = 2,
  common = 1, perPurchase = 3, purchaseExponent = 1,
  mastery = 1, amount = 5, synergyExponent = 1, softcapEffect = 1 } = {}) {
  const ctx = {
    D, Decimal: D, Math, Number, Error,
    DC: { D0: new D(0), D1: new D(1), BEMAX: new D(CAP), NUMMAX: new D(1e3), E100: new D(100) },
    player: { endgame: { celDimExpansion: { dimBoosts: new D(boosts) } } },
    EndgameUpgrade: id => effect(id === 11 ? new D(common) : new D(softcapEffect)),
    EndgameMastery: id => effect(id === 191 ? new D(mastery) : new D(softcapEffect)),
    CelestialEternityUpgrade: { largeCDMult: effect(1) },
    Ethereal: { sectorBoost: new D(sector) },
    CelestialInfinityUpgrade: {
      celDimPurchaseBoost: effect(new D(perPurchase)),
      celDimBoostBuff: effect(10),
      antimatterCelestialDimBuff: effect(1)
    },
    CelestialBreakInfinityUpgrade: { celDimPurchaseBuff: effect(1), celDimboostBuff: effect(1) },
    SingularityMilestone: { dimensionPow: effect(1), perPurchaseDimMult: effect(new D(purchaseExponent)) },
    Ra: { unlocks: { celestialDimensionPower: effect(1) } },
    ResurgenceUpgrade: { synergy2: effect(new D(synergyExponent)) },
    CelestialDimensions: { alphaDecayRemnant: new D(1) },
    CelestialTickspeed: { baseValue: new D(tick) },
    DimensionState: class {
      constructor(_accessor, tier) { this.tier = tier; }
      get amount() { return this.data.amount; }
      set amount(value) { this.data.amount = value; }
    }
  };
  const helper = read('finite-decimal.js').replace(/^export /gm, '');
  vm.runInNewContext(`${helper}\nglobalThis.helpers = { boundedPositivePower, boundedPositiveProduct };`, ctx);
  Object.assign(ctx, ctx.helpers);
  const source = read('dimensions/celestial-dimension.js');
  const commonStart = source.indexOf('// CD multipliers are strictly nonnegative.');
  const commonEnd = source.indexOf('\nexport function toggleCelestialMatter()', commonStart);
  const stateStart = source.indexOf('class CelestialDimensionState extends DimensionState {');
  const stateEnd = source.indexOf('\n/**', stateStart);
  const boostStart = source.indexOf('export class CelestialDimBoost {');
  const boostEnd = source.indexOf('\n// eslint-disable-next-line max-params', boostStart);
  assert.ok(commonStart >= 0 && commonEnd > commonStart && stateEnd > stateStart && boostEnd > boostStart);
  const script = `${source.slice(commonStart, commonEnd).replace(/^export /gm, '')}
    ${source.slice(stateStart, stateEnd)}
    ${source.slice(boostStart, boostEnd).replace(/^export /gm, '')}
    globalThis.common = celestialDimensionCommonMultiplier;
    globalThis.Boost = CelestialDimBoost;
    globalThis.CD = CelestialDimensionState;`;
  vm.runInNewContext(script, ctx);
  ctx.GameCache = { celestialDimensionCommonMultiplier: { get value() { return ctx.common(); } } };
  ctx.CelestialDimBoost = ctx.Boost;
  const dimension = new ctx.CD(8);
  dimension.data = { amount: new D(amount), baseAmount: new D(tierBase) };
  // Use the actual class getters without initializing unrelated cost machinery.
  Object.defineProperty(dimension, 'data', { value: dimension.data });
  return { dimension, ctx, source };
}

test('ordinary CD8 multiplier and production retain the original factor order', () => {
  const { dimension, ctx } = setup();
  assert.equal(ctx.common().n, 2);
  assert.equal(ctx.Boost.multiplierToCDTier().n, 10);
  assert.equal(dimension.powerMultiplier.n, 3);
  assert.equal(dimension.multiplier.n, 2 * 3 ** 2 * 10);
  assert.equal(dimension.productionPerSecond.n, 5 * 2 * 3 ** 2 * 10 * 2);
});

test('large but finite Celestial Dimension Boost count does not overflow multiplier', () => {
  const { dimension, ctx } = setup({ boosts: 100000 });
  assert.equal(ctx.Boost.multiplierToCDTier().n, CAP);
  assert.equal(dimension.multiplier.n, CAP);
  assert.equal(dimension.productionPerSecond.n, CAP);
});

test('per-purchase power, common effect, and synergy each bound before overflow', () => {
  for (const options of [
    { purchaseExponent: 1000 },
    { common: 900000 },
    { synergyExponent: 1000 },
    { tierBase: 10000 }
  ]) {
    const { dimension } = setup(options);
    assert.equal(dimension.multiplier.n, CAP);
    assert.equal(dimension.productionPerSecond.n, CAP);
  }
});

test('large finite tickspeed cannot overflow production after multiplier is calculated', () => {
  const { dimension } = setup({ tick: 100000 });
  assert.equal(dimension.multiplier.n, 180);
  assert.equal(dimension.productionPerSecond.n, CAP);
});

test('invalid original effect and saved boost count report their own source', () => {
  const badCommon = setup({ common: Infinity });
  assert.throws(() => badCommon.dimension.multiplier, /Invalid Celestial Dimension factor: Endgame Upgrade 11/);
  const badCount = setup({ boosts: Infinity });
  assert.throws(() => badCount.dimension.multiplier, /Invalid Celestial Dimension factor: Celestial Dimension Boost count exponent/);
  const badAmount = setup({ amount: Infinity });
  assert.throws(() => badAmount.dimension.productionPerSecond, /Invalid Celestial Dimension factor: CD8 amount \* multiplier left/);
});

test('mastery achievement exponent stays Decimal, and is never converted to a native Number', () => {
  const { dimension, source } = setup({ mastery: 100000 });
  assert.ok(Number.isFinite(dimension.multiplier.n));
  assert.doesNotMatch(source.slice(source.indexOf('  get multiplier() {'), source.indexOf('  get isProducing() {')),
    /mult = mult\.pow\(Achievements\.powerConv\(/);
});

test('CD softcap multiplication avoids overflow in independent extreme multipliers', () => {
  const { ctx, source } = setup({ sector: 500000, softcapEffect: 10 });
  const start = source.indexOf('  get SOFTCAP() {');
  const end = source.indexOf('\n  get OVERFLOW() {', start);
  assert.ok(start > 0 && end > start);
  ctx.CelestialDimensions = vm.runInNewContext(`({${source.slice(start, end)}\n
    get alphaDecayRemnant() { return new D(1); }, get OVERFLOW_MAG() { return 2; }})`, ctx);
  const result = ctx.CelestialDimensions.SOFTCAP;
  assert.ok(Number.isFinite(result.n) && result.n > 1000 && result.n <= CAP);
});
