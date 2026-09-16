// Direct differential checks: execute the actual gameplay formulas and the
// diagnostic shadow traces against identical mocked game state.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, 'src', file), 'utf8');

class D {
  constructor(value = 0) { this.n = Number(value instanceof D ? value.n : value); }
  valueOf() { return this.n; }
  toDecimal() { return this; }
  times(value) { return new D(this.n * Number(value)); }
  div(value) { return new D(this.n / Number(value)); }
  add(value) { return new D(this.n + Number(value)); }
  plus(value) { return this.add(value); }
  sub(value) { return new D(this.n - Number(value)); }
  pow(value) { return new D(Math.pow(this.n, Number(value))); }
  log10() { return new D(Math.log10(this.n)); }
  max(value) { return new D(Math.max(this.n, Number(value))); }
  gte(value) { return this.n >= Number(value); }
  gt(value) { return this.n > Number(value); }
  lte(value) { return this.n <= Number(value); }
  lt(value) { return this.n < Number(value); }
  eq(value) { return Math.abs(this.n - Number(value)) <= Math.max(1, this.n, Number(value)) * 1e-12; }
  neq(value) { return !this.eq(value); }
  abs() { return new D(Math.abs(this.n)); }
  timesEffectOf(effect) { return this.times(effect?.effectOrDefault?.(1) ?? 1); }
  timesEffectsOf(...effects) { return effects.reduce((value, effect) => value.timesEffectOf(effect), this); }
  powEffectOf(effect) { return this.pow(effect?.effectOrDefault?.(1) ?? 1); }
  static clampMin(value, min) { return new D(Math.max(Number(value), Number(min))); }
  static pow(a, b) { return new D(Math.pow(Number(a), Number(b))); }
  static pow10(value) { return D.pow(10, value); }
  static log10(value) { return new D(Math.log10(Number(value))); }
}
const e = (value = 1.12) => ({ effectValue: new D(value), effectOrDefault: () => new D(value),
  canBeApplied: true, isBought: true, isUnlocked: true });
const restoration = keys => Object.fromEntries(keys.split(' ').map(key => [key, { canBeApplied: true }]));
function world(options = {}) {
  const doomed = !!options.doomed;
  const disabled = !!options.disablePostReality;
  const allow = restoration;
  const scenarios = {
    Decimal: D, DC: { D0: new D(0), D1: new D(1) },
    Pelle: { isDoomed: doomed, isDisabled: () => doomed, specialGlyphEffect: { replication: new D(1.24), dilation: new D(1.16) } },
    PelleRifts: { decay: { effectValue: new D(1.18) }, paradox: { milestones: [null, e(1.1)] } },
    ShopPurchase: { replicantiPurchases: { currentMult: 1.2 }, dilatedTimePurchases: { currentMult: 1.25 } },
    PelleAchievementUpgrade: allow('achievement81 achievement87 achievement102 achievement113 achievement131 achievement132 achievement134 achievement137 achievement164'),
    PelleDestructionUpgrade: allow('timestudy32 timestudy62 timestudy132 timestudy191 timestudy213 destroyedGlyphEffects singularityMilestones disableDTNerf'),
    PelleRealityUpgrade: allow('replicativeAmplifier cosmicallyDuplicate replicativeRapidity boundlessAmplifier innumerablyConstruct temporalAmplifier eternalAmplifier'),
    PelleCelestialUpgrade: allow('raTeresa3 raV3 raNameless4'),
    PelleAlchemyUpgrade: allow('alchemyReplication alchemyDilation alchemyEternity'),
    Replicanti: { amount: new D(options.overCap ? 10000 : 100) }, replicantiCap: () => new D(1000),
    Achievement: id => ({ ...e(1.11 + (id % 3) / 100), effects: { infinitiesGain: e(1.13) } }),
    TimeStudy: id => ({ ...e(1.1 + (id % 4) / 100), effects: { infinitiesGain: e(1.17) } }),
    RealityUpgrade: id => e(1.12 + id / 1000),
    Effects: { product: (...effects) => effects.reduce((v, effect) => v.timesEffectOf(effect), new D(1)),
      max: (v, effect) => new D(Math.max(Number(v), Number(effect.effectOrDefault(1)))) },
    Ra: { unlocks: { continuousTTBoost: { effects: {
      replicanti: e(1.17), dilatedTime: e(1.15), infinity: e(1.18) } }, peakGamespeedDT: e(1.2) } },
    AlchemyResource: { replication: e(1.2), dilation: e(1.1), eternity: e(1.13) },
    GlyphAlteration: { isAdded: () => true },
    ReplicantiMultipliers: { dtMult: new D(1.14), dtPow: new D(1.1) },
    getAdjustedGlyphEffect: key => new D(key === 'replicationdtgain' ? 0.4 : 1.17),
    getSecondaryGlyphEffect: () => new D(0.5),
    Perk: { studyPassive: { isBought: true } },
    player: { disablePostReality: disabled,
      dilation: { dilatedTime: new D(1e20) }, infinities: new D(1e20), eternities: new D(1e20) },
    LHC: { voidRunning: true },
    NullUpgrade: { replicantiSpeedMult: e(1.28), dilatedTimeMult: e(1.29), infinityMult: e(1.24), eternityMult: e(1.26) },
    Currency: { tachyonParticles: { value: new D(100) } },
    DilationUpgrade: { dtGain: e(1.2), dtGainPelle: e(1.3), flatDilationMult: e(1.25) },
    Alpha: { isRunning: false }, getGameSpeedupForDisplay: () => new D(2),
    Enslaved: { isRunning: !!options.enslaved }, V: { isRunning: !!options.v },
    ResurgenceUpgrade: { repSurge: { isBought: true }, curr1Surge: { isBought: true }, curr2Surge: { isBought: true } },
    EndgameMastery: () => e(1.23), DilationSoftcapStart: { PRIMARY_THRESHOLD: () => new D(75) },
    EternityChallenge: () => ({ isRunning: !!options.ec4 }),
    SingularityMilestone: { infinitiedPow: e(1.1) },
    AlphaUnlocks: { eternityChallenge10: { effects: { buff: e(1.08) } } },
    BreakInfinityUpgrade: { infinitiedGen: { chargedEffect: e(1.12) } },
    Date,
  };
  if (options.noRestoration) {
    for (const map of [scenarios.PelleAchievementUpgrade, scenarios.PelleDestructionUpgrade,
      scenarios.PelleRealityUpgrade, scenarios.PelleCelestialUpgrade, scenarios.PelleAlchemyUpgrade]) {
      for (const upgrade of Object.values(map)) upgrade.canBeApplied = false;
    }
  }
  return vm.createContext(scenarios);
}
const resources = [
  { name: 'Replicanti', source: 'core/replicanti.js', begin: 'export function totalReplicantiSpeedMult(', end: 'export function replicantiCap(',
    fn: 'totalReplicantiSpeedMult', trace: 'core/secret-formula/multiplier-tab/replicanti-breakdown.js',
    actual: c => c.totalReplicantiSpeedMult(c.Replicanti.amount.gt(c.replicantiCap())), missing: 'nullUpgrade' },
  { name: 'DT', source: 'core/dilation.js', begin: 'export function getDilationGainPerSecond(', end: 'export function tachyonGainMultiplier(',
    fn: 'getDilationGainPerSecond', trace: 'core/secret-formula/multiplier-tab/dilated-time-breakdown.js',
    actual: c => c.getDilationGainPerSecond(), missing: 'nullUpgrade' },
  { name: 'Infinities', source: 'game.js', begin: 'export function gainedInfinities(', end: 'export function gainedCelestialInfinities(',
    fn: 'gainedInfinities', trace: 'core/secret-formula/multiplier-tab/infinities-breakdown.js',
    actual: c => c.gainedInfinities(), missing: 'nullUpgrade' },
  { name: 'Eternities', source: 'core/eternity.js', begin: 'export function gainedEternities(', end: 'export class EternityMilestoneState',
    fn: 'gainedEternities', trace: 'core/secret-formula/multiplier-tab/eternities-breakdown.js',
    actual: c => c.gainedEternities(), missing: 'nullUpgrade' },
];
function execute(resource, options) {
  const context = world(options);
  const source = read(resource.source);
  const start = source.indexOf(resource.begin);
  const end = source.indexOf(resource.end, start + resource.begin.length);
  assert.ok(start >= 0 && end > start, `Could not extract ${resource.fn}`);
  vm.runInContext(source.slice(start, end).replace(/^export /gm, ''), context, { filename: resource.source });
  const helper = read('core/secret-formula/multiplier-tab/ordered-breakdown.js').replace(/^export /gm, '');
  vm.runInContext(helper, context);
  const trace = read(resource.trace).replace(/^import\s*\{[\s\S]*?\}\s*from\s*"[^"]+";\s*/gm, '')
    .replace(/^export /gm, '') + '\nglobalThis.__audit = { trace, build };';
  vm.runInContext(trace, context, { filename: resource.trace });
  const actual = resource.actual(context);
  const predicted = context.__audit.trace();
  const diff = Math.abs(Number(actual) - Number(predicted));
  assert.ok(Number.isFinite(diff) && diff <= Math.max(1, Number(actual)) * 1e-9,
    `${resource.name} mismatch for ${JSON.stringify(options)}: gameplay=${Number(actual)}, traced=${Number(predicted)}`);
  const steps = context.__audit.build();
  assert.ok(!steps.traceMismatch, `${resource.name}: unexpected diagnostic mismatch`);
  return steps;
}
for (const resource of resources) {
  for (const options of [ {}, { doomed: true }, { doomed: true, noRestoration: true },
    { overCap: true, enslaved: true, v: true }, { disablePostReality: true }, { ec4: true }, { doomed: true, overCap: true, disablePostReality: true },
    { doomed: true, noRestoration: true, enslaved: true, v: true } ]) {
    test(`${resource.name} gameplay formula matches ordered trace ${JSON.stringify(options)}`, () => {
      const steps = execute(resource, options);
      assert.ok(steps.base, 'Missing base row');
      if (!options.doomed && !options.ec4) assert.ok(steps[resource.missing], 'Missing Null upgrade source');
    });
  }
}

test('AD achievement category does not double-count Time Studies or IC8', () => {
  const source = read('core/secret-formula/multiplier-tab/antimatter-dimensions.js');
  const ach = source.slice(source.indexOf('  achievement: {'), source.indexOf('  infinityUpgrade: {'));
  assert.doesNotMatch(ach, /TimeStudy\(71\)|TimeStudy\(214\)|InfinityChallenge\(8\)/);
});
test('AD per-tier total is its own multiplier, not another tier amount', () => {
  const source = read('core/secret-formula/multiplier-tab/antimatter-dimensions.js');
  assert.match(source, /AntimatterDimension\(dim\)\.multiplier/);
  assert.doesNotMatch(source.slice(source.indexOf('  total: {'), source.indexOf('  purchase: {')), /highestDim|actualNC12Production/);
});

test('AD exposes independently labeled Null, Break Eternity, Resurgence and Alpha effects', () => {
  const sources = read('core/secret-formula/multiplier-tab/antimatter-dimension-breakdown.js');
  const values = read('core/secret-formula/multiplier-tab/antimatter-dimensions.js');
  for (const key of ['nullUpgrade', 'breakEternityPower', 'achievementSurgePower', 'alphaPower']) {
    assert.match(sources, new RegExp(`"${key}"`));
  }
  assert.match(values, /AD_ORDERED_LABELS/);
});

test('all traced source keys have actual UI entries (no silently dropped calculation sources)', () => {
  const valueFiles = {
    Replicanti: 'replicanti.js', DT: 'dilated-time.js',
    Infinities: 'infinities.js', Eternities: 'eternities.js',
  };
  for (const resource of resources) {
    const values = read(`core/secret-formula/multiplier-tab/${valueFiles[resource.name]}`);
    const declared = new Set([...values.matchAll(/^  ([a-zA-Z]\w*):\s*\{/gm)].map(match => match[1]));
    for (const options of [{}, { doomed: true }, { doomed: true, noRestoration: true }]) {
      for (const key of Object.keys(execute(resource, options))) {
        assert.ok(declared.has(key), `${resource.name}: traced source '${key}' has no visible row`);
      }
    }
    assert.match(values, /isOrdered:\s*true/, `${resource.name} must use ordered GUI`);
  }
});

test('AM production does not conflate eight AD multipliers with AD1 output or tickspeed^8', () => {
  const tree = read('core/secret-formula/multiplier-tab/tree.js');
  const children = tree.slice(tree.indexOf('  AM_total: ['), tree.indexOf('  AD_total: ['));
  for (const key of ['AM_ad1Amount', 'AD_total_1', 'AM_tickRate', 'AM_gameSpeed', 'AM_unattributed']) {
    assert.match(children, new RegExp(`"${key}"`));
  }
  assert.doesNotMatch(children, /"AD_total"|"tickspeed_total"|"AM_effarigAM"/);
});

for (const [label, actual, expectedResidual] of [
  ['baseline only', 600, 1], ['NC12 additive AD2 production', 1100, 1100 / 600],
  ['downstream production nerf', 60, 0.1]
]) {
  test(`AM accounting remainder reconciles actual total: ${label}`, () => {
    const source = read('core/secret-formula/multiplier-tab/antimatter.js')
      .replace(/^import[^\n]*\n/gm, '').replace(/^export /gm, '') + '\nglobalThis.__am = AM;';
    const c = vm.createContext({ Decimal: D, Currency: { antimatter: { productionPerSecond: new D(actual) } },
      AntimatterDimension: () => ({ totalAmount: new D(10), multiplier: new D(20), isProducing: true }),
      Tickspeed: { perSecond: new D(2) }, getGameSpeedupForDisplay: () => 1.5,
      MultiplierTabIcons: { DIMENSION: () => ({}), TICKSPEED: {}, GENERIC_GLYPH: {} },
      format: () => '', Date });
    vm.runInContext(source, c);
    const am = c.__am;
    const baseline = Number(am.ad1Amount.multValue()) * Number(am.tickRate.multValue()) *
      Number(am.gameSpeed.multValue()) * 20;
    assert.equal(baseline, 600);
    assert.ok(Math.abs(Number(am.unattributed.multValue()) - expectedResidual) < 1e-12);
    assert.ok(Math.abs(baseline * Number(am.unattributed.multValue()) - actual) < 1e-8);
  });
}
