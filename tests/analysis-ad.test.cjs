// AD source audit: compare against the actual AD multiplier implementation, not against
// a handwritten expected total. Mocked Decimal values are finite and cannot validate
// huge-number or real-save behavior; this is a branch/formula regression test.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, 'src', file), 'utf8');

class D {
  constructor(x = 0) { this.n = Number(x instanceof D ? x.n : x); }
  valueOf() { return this.n; }
  times(x) { return new D(this.n * Number(x)); }
  div(x) { return new D(this.n / Number(x)); }
  dividedBy(x) { return this.div(x); }
  add(x) { return new D(this.n + Number(x)); }
  plus(x) { return this.add(x); }
  sub(x) { return new D(this.n - Number(x)); }
  pow(x) { return new D(Math.pow(this.n, Number(x))); }
  log10() { return new D(Math.log10(this.n)); }
  abs() { return new D(Math.abs(this.n)); }
  max(x) { return new D(Math.max(this.n, Number(x))); }
  clampMin(x) { return this.max(x); }
  gte(x) { return this.n >= Number(x); }
  gt(x) { return this.n > Number(x); }
  lte(x) { return this.n <= Number(x); }
  lt(x) { return this.n < Number(x); }
  eq(x) { return this.n === Number(x); }
  neq(x) { return !this.eq(x); }
  timesEffectOf(x) { return this.times(x?.effectOrDefault?.(1) ?? 1); }
  timesEffectsOf(...xs) { return xs.reduce((v, x) => v.timesEffectOf(x), this); }
  dividedByEffectOf(x) { return this.div(x?.effectOrDefault?.(1) ?? 1); }
  powEffectOf(x) { return this.pow(x?.effectOrDefault?.(1) ?? 1); }
  powEffectsOf(...xs) { return xs.reduce((v, x) => v.powEffectOf(x), this); }
  static floor(x) { return new D(Math.floor(Number(x))); }
  static pow(x, y) { return new D(Math.pow(Number(x), Number(y))); }
  static pow10(x) { return D.pow(10, x); }
  static log10(x) { return new D(Math.log10(Number(x))); }
  static abs(x) { return new D(Math.abs(Number(x))); }
  static sign(x) { return Math.sign(Number(x)); }
}
const e = (n = 1.01) => ({ effectValue: new D(n), effectOrDefault: () => new D(n),
  chargedEffect: { effectValue: new D(1.02), effectOrDefault: () => new D(1.02),
    applyEffect(apply) { return apply(this.effectValue); } },
  isUnlocked: true, isBought: true, isCompleted: true,
  // Real gameplay effects expose applyEffect; the finite-guarded formulas rely on it.
  applyEffect(apply) { return apply(this.effectValue); } });
const eMap = new Proxy({}, { get: (_obj, key) => e(String(key).length % 2 ? 1.02 : 1.03) });
function world(options = {}) {
  const dimensions = Array.from({ length: 8 }, (_, i) => ({ tier: i + 1, bought: new D(30),
    continuumValue: new D(3), isProducing: true, totalAmount: new D(10), infinityUpgrade: e(1.04) }));
  const any = id => ({ ...e(1.01 + (id % 3) / 100), isRunning: options.ic === id,
    isCompleted: options.icCompleted === id, reward: e(1.04), effectValue: new D(1.03) });
  const challenge = id => ({ ...any(id), isRunning: options.ec === id, reward: e(1.05) });
  const scenarios = {
    D, Decimal: D, DC: { D0: new D(0), D1: new D(1) },
    // The gameplay formula and the AD shadow trace share the finite-guard helpers; in this
    // fully finite mocked world the plain arithmetic forms are exactly equivalent to them.
    boundedPositivePower: (base, exponent) => new D(Math.pow(Number(base), Number(exponent))),
    boundedPositiveProduct: (left, right) => new D(Number(left) * Number(right)),
    AntimatterDimension: tier => dimensions[tier - 1],
    AntimatterDimensions: { all: dimensions, buyTenMultiplier: new D(1.2), buyOoMPower: new D(0.03) },
    Achievements: { power: new D(1.14), powerConv: v => new D(1.02 + Number(v) / 100) },
    Achievement: id => ({ ...e(1.01 + id % 4 / 100), isUnlocked: true }),
    TimeStudy: id => e(id === 31 ? 1.13 : 1.03),
    InfinityChallenge: any, EternityChallenge: challenge, NormalChallenge: id => ({ isRunning: options.nc === id }),
    ShopPurchase: { dimPurchases: { currentMult: new D(1.1) }, allDimPurchases: { currentMult: new D(1.12) } },
    InfinityUpgrade: eMap, BreakInfinityUpgrade: eMap, BreakEternityUpgrade: eMap,
    Currency: { infinityPower: { value: new D(10) }, realityMachines: { value: new D(12) },
      antimatter: { value: new D(10) }, nullParticles: { value: new D(2) } },
    InfinityDimensions: { powerConversionRate: 1.02 },
    AlchemyResource: { dimensionality: e(1.08), force: e(1.02), power: e(1.03),
      inflation: { ...e(1.05), effectValue: new D(1.2), isUnlocked: !!options.inflation } },
    PelleUpgrade: { antimatterDimensionMult: e(1.12) },
    Pelle: { isDoomed: !!options.doomed },
    PelleDestructionUpgrade: { disableADNerf: { canBeApplied: !!options.restoration } },
    PelleCelestialUpgrade: { vMilestones1: { canBeApplied: !!options.restoration } },
    PelleRifts: { paradox: e(1.04) },
    PelleStrikes: { infinity: { hasStrike: !!options.strikes, isDestroyed: () => !!options.restoration },
      dilation: { hasStrike: !!options.strikes, isDestroyed: () => !!options.restoration } },
    Laitela: { continuumActive: !!options.continuum },
    Alpha: { isRunning: !!options.alpha },
    AlphaUnlocks: { timestudy181: { effects: { nerf: e(0.98), buff: e(1.01) } },
      unlockDilation: { effects: { nerf: e(0.76), buff: e(0.79) } },
      dilatedEternity: { effects: { nerf: e(0.79) } } },
    LHC: { voidRunning: !!options.void }, NullUpgrade: { antimatterDimensionMult: e(1.32) },
    DimBoost: { multiplierToNDTier: () => new D(1.16), powerToND: new D(1.08) },
    Ascensions: { b10mA: { isUnlocked: !!options.ascension }, dbA: { isUnlocked: !!options.ascension },
      sacA: { isUnlocked: !!options.ascension } },
    Sacrifice: { totalBoost: new D(1.36), totalPower: new D(1.08) },
    Ra: { momentumValue: 1.03, unlocks: { allDimPowTT: e(1.02) } },
    SingularityMilestone: { dimensionPow: e(1.02) },
    VUnlocks: { adPow: e(1.04) }, V: { isRunning: !!options.v },
    Effarig: { isRunning: !!options.effarig, multiplier: value => value.pow(0.86) },
    Enslaved: { isRunning: !!options.enslaved },
    DilationUpgrade: { ndMultDT: e(1.02), dilationPenalty: e(0.98) },
    getAdjustedGlyphEffect: key => ({ dilationpow: 1.04, powerpow: 1.03, effarigdimensions: 1.02,
      curseddimensions: 0.98, powermult: 1.08 })[key] ?? 1,
    ExpansionPack: { pellePack: { isBought: !!options.pack } },
    ResurgenceUpgrade: { achSurge: { isBought: !!options.surge } },
    Accelerators: { potency: { _milestones: [e(1.03)] }, emptiness: {
      effectValue1: new D(1.04), _milestones: [e(1.05)] } },
    DivinityMilestone: { celestialSurge: { isReached: !!options.divinity }, finalRebirth: { isReached: !!options.divinity } },
    Time: { thisEndgameRealTime: { totalSeconds: new D(10) } },
    EtherealStars: { red: { reward: new D(0.94) } },
    player: { postC4Tier: 8, disablePostReality: !!options.disablePostReality,
      dilation: { active: !!options.dilation }, records: { bestEndgame: { galaxies: new D(1e4) } },
      endgame: { overcharge: { isRunning: !!options.overcharge, level: 2 } } },
    Effects: { product: (...items) => items.reduce((v, x) => v * Number(x?.effectOrDefault?.(1) ?? 1), 1),
      min: (base, ...items) => Math.min(base, ...items.map(x => Number(x?.effectOrDefault?.(1) ?? 1))) },
    format: x => String(Number(x)), formatX: x => String(Number(x)), Date,
  };
  scenarios.GameCache = { antimatterDimensionCommonMultiplier: { get value() { return scenarios.antimatterDimensionCommonMultiplier(); } } };
  return vm.createContext(scenarios);
}
function load(options) {
  const c = world(options);
  const game = read('core/dimensions/antimatter-dimension.js');
  vm.runInContext(game.slice(game.indexOf('export function antimatterDimensionCommonMultiplier()'),
    game.indexOf('function onBuyDimension(')).replace(/^export /gm, ''), c);
  const dilation = read('core/dilation.js');
  vm.runInContext(dilation.slice(dilation.indexOf('export function dilatedValueOf('),
    dilation.indexOf('export function secondOrderDilateMultiplier(')).replace(/^export /gm, ''), c);
  for (let tier = 1; tier <= 8; tier++) {
    Object.defineProperty(c.AntimatterDimension(tier), 'multiplier', { get() { return c.getDimensionFinalMultiplierUncached(tier); } });
  }
  vm.runInContext(read('core/secret-formula/multiplier-tab/ordered-breakdown.js').replace(/^export /gm, ''), c);
  const source = read('core/secret-formula/multiplier-tab/antimatter-dimension-breakdown.js')
    .replace(/^import\s*\{[\s\S]*?\}\s*from\s*"[^"]+";\s*/gm, '').replace(/^export /gm, '');
  vm.runInContext(source + '\nglobalThis.__audit = { trace, build, AD_ORDERED_LABELS, AD_ORDERED_KEYS, AD_ORDERED_GROUPS, tierTransform };', c);
  return c;
}
const scenarios = [
  {}, { dilation: true }, { enslaved: true }, { effarig: true }, { v: true },
  { ic: 4 }, { icCompleted: 4 }, { ec: 11 }, { ec: 9 }, { nc: 10 },
  { doomed: true, strikes: true }, { doomed: true, strikes: true, restoration: true },
  { void: true, divinity: true }, { ascension: true, continuum: true },
  { alpha: true, dilation: true }, { surge: true, pack: true, inflation: true },
  { disablePostReality: true, overcharge: true },
  { void: true, ascension: true, surge: true, overcharge: true, inflation: true },
];
for (const options of scenarios) {
  test(`AD shadow formula equals gameplay: ${JSON.stringify(options)}`, () => {
    const c = load(options);
    for (let tier = 1; tier <= 8; tier++) {
      const actual = Number(c.getDimensionFinalMultiplierUncached(tier));
      const predicted = Number(c.__audit.trace(tier));
      const error = Math.abs(actual - predicted) / Math.max(1, Math.abs(actual));
      assert.ok(Number.isFinite(error) && error < 1e-9,
        `AD${tier} ${JSON.stringify(options)} actual ${actual} trace ${predicted} relative error ${error}`);
    }
    const steps = c.__audit.build(1);
    assert.ok(!steps.traceMismatch, 'Mismatch row unexpectedly present');
    for (const [key, step] of Object.entries(steps)) {
      if (key === 'base') continue;
      assert.ok(Object.hasOwn(c.__audit.AD_ORDERED_LABELS, key), `Source ${key} has no UI entry`);
      if (step.finalWithout !== undefined) {
        const expected = Number(c.__audit.trace(1, key));
        assert.ok(Math.abs(expected - Number(step.finalWithout)) <= Math.max(1, expected) * 1e-12,
          `${key}: removal is not calculated by replay`);
      }
    }
  });
}
test('AD tree only uses ordered sources, with each source represented exactly once', () => {
  const c = load();
  const roots = c.__audit.AD_ORDERED_KEYS;
  assert.equal(new Set(roots).size, roots.length);
  const all = c.__audit.AD_ORDERED_GROUPS.flatMap(group => [group[0], ...group[2].map(item => item[0])]);
  assert.equal(new Set(all).size, all.length, 'Duplicated effect key');
  for (const key of all) assert.ok(c.__audit.AD_ORDERED_LABELS[key], `Missing label ${key}`);
  const tree = read('core/secret-formula/multiplier-tab/tree.js');
  assert.match(tree, /multiplierTabTree\.AD_total = \[AD_ORDERED_KEYS\.map/);
  assert.match(tree, /multiplierTabTree\[`AD_total_\$\{tier\}`\] = \[AD_ORDERED_KEYS\.map/);
});

test('AD counterfactual replay is lazy: collapsed sources do not trigger all source replays', () => {
  const c = load({ surge: true, dilation: true });
  const initial = c.__audit.build(1);
  const source = initial.commonEffects;
  assert.ok(source && !Object.hasOwn(source, 'finalWithout'));
  const children = c.__audit.AD_ORDERED_GROUPS.find(group => group[0] === 'commonEffects')[2];
  for (const [key] of children) {
    if (initial[key]) assert.ok(!Object.hasOwn(initial[key], 'finalWithout'), key);
  }
  // A single requested step is evaluated only when it is inspected. Verify the
  // actual replayed result equals deleting that effect from the game formula.
  const queried = c.__audit.tierTransform(1, 'commonEffects');
  assert.ok(queried.finalWithout, 'Group source should be replayed on demand');
  assert.equal(Number(queried.finalWithout), Number(c.__audit.trace(1, 'commonEffects')));
  const cached = c.__audit.tierTransform(1, 'commonEffects');
  assert.strictEqual(queried, cached, 'Repeated requests within one snapshot should use the same trace');
});

test('AD grouped children all have unique source IDs and no uncategorized active source', () => {
  const c = load({ void: true, ascension: true, surge: true, inflation: true });
  const ids = c.__audit.AD_ORDERED_GROUPS.flatMap(([id, , children]) => [id, ...children.map(([child]) => child)]);
  assert.equal(ids.length, new Set(ids).size);
  for (const tier of [1, 3, 8]) {
    for (const key of Object.keys(c.__audit.build(tier))) {
      assert.ok(ids.includes(key) || key === 'base', `AD ${tier} ${key} is unlisted`);
    }
  }
});
