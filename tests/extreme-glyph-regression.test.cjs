const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const read = p => fs.readFileSync(path.join(__dirname, '..', 'src/core', p), 'utf8').replace(/\r\n/g, '\n');

// Deliberately represent values exceeding native Number independently. This
// lightweight mock tests type flow and the Number-valued alchemy boundary; the
// real browser's Decimal implementation is still required for end-to-end QA.
class D {
  constructor(value = 0) { this.n = value instanceof D ? value.n : value === 'HUGE' ? Infinity : Number(value); }
  // This mock stores astronomical *finite Decimal* values as native Infinity;
  // expose finite Decimal components as the real library does. NaN stays invalid.
  get sign() { return Math.sign(this.n); }
  get layer() { return Number.isNaN(this.n) ? NaN : Number.isFinite(this.n) ? 0 : 1; }
  get mag() { return Number.isNaN(this.n) ? NaN : Number.isFinite(this.n) ? Math.abs(this.n) : Number.MAX_VALUE; }
  valueOf() { return this.n; }
  add(v) { return new D(this.n + Number(v)); }
  sub(v) { return new D(this.n - Number(v)); }
  times(v) { return new D(this.n * Number(v)); }
  mul(v) { return this.times(v); }
  div(v) { return new D(this.n / Number(v)); }
  pow(v) { return new D(Math.pow(this.n, Number(v))); }
  floor() { return new D(Math.floor(this.n)); }
  max(v) { return D.max(this, v); }
  min(v) { return D.min(this, v); }
  gt(v) { return this.n > Number(v); }
  gte(v) { return this.n >= Number(v); }
  lt(v) { return this.n < Number(v); }
  lte(v) { return this.n <= Number(v); }
  eq(v) { return this.n === Number(v); }
  toNumber() { return this.n; }
  static min(a, b) { return new D(Math.min(Number(a), Number(b))); }
  static max(a, b) { return new D(Math.max(Number(a), Number(b))); }
  static pow(a, b) { return new D(Math.pow(Number(a), Number(b))); }
  static floor(a) { return new D(Math.floor(Number(a))); }
  static isFinite(value) { return Number.isFinite(Number(value)); }
  static clampMin(a, b) { return D.max(a, b); }
  static sumReducer(a, b) { return new D(a).add(b); }
}
const DC = { D0: new D(0), D1: new D(1), D2: new D(2), BEMAX: new D('HUGE') };

function glyphWorld() {
  const source = read('secret-formula/reality/glyph-effects.js');
  const ctx = vm.createContext({ Decimal: D, DC, EffarigUnlock: { endgame: { canBeApplied: true } },
    ALTERATION_TYPE: { ADDITION: 1 } });
  const combo = source.slice(source.indexOf('export const GlyphCombiner'), source.indexOf('export const glyphEffects'));
  vm.runInContext(combo.replace('export const GlyphCombiner', 'const GlyphCombiner') + '\nthis.combo = GlyphCombiner;', ctx);
  for (const id of ['powerpow', 'powerbuy10']) {
    const start = source.indexOf(`  ${id}: {`);
    assert.ok(start >= 0);
    const end = source.indexOf('\n  },', start) + 5;
    vm.runInContext(`this.${id} = ({${source.slice(start, end)}\n}).${id};`, ctx);
  }
  return ctx;
}

test('P glyph effects and exponent combiner remain Decimal and preserve ordinary mathematics', () => {
  const g = glyphWorld();
  const level = new D(1200);
  assert.equal(g.powerbuy10.effect(level, 2).n, 1200 ** 2 + 1);
  assert.ok(g.powerbuy10.effect(level, 2) instanceof D);
  assert.equal(g.powerpow.effect(level, 2) instanceof D, true);
  assert.equal(g.combo.addDecimalExponents([new D(5), new D(8)]).n, 12);
  assert.equal(g.combo.addDecimalExponents([]).n, 1);
  assert.equal(g.powerpow.conversion(new D(4)).n, 0.25);
  g.EffarigUnlock.endgame.canBeApplied = false;
  assert.equal(g.powerbuy10.effect(level, 2).n, 201);
  assert.equal(g.powerpow.conversion(new D(4)).n, 0.4);
});

test('huge P glyph results never call toNumber in the effect/combine path', () => {
  const g = glyphWorld();
  const huge = new D('HUGE');
  assert.ok(g.powerbuy10.effect(huge, 2) instanceof D);
  assert.ok(g.combo.addDecimalExponents([huge, new D(2)]) instanceof D);
  assert.ok(g.powerpow.effect(huge, 2) instanceof D);
  assert.ok(g.powerpow.conversion(huge) instanceof D);
});

function refinementWorld(cap = 1e6) {
  const source = read('glyphs/glyph-purge-handler.js');
  const ctx = vm.createContext({
    Decimal: D, DC, Math: Object.assign(Object.create(Math), { clamp: (x, a, b) => Math.max(a, Math.min(x, b)),
      clampMin: Math.max, clampMax: Math.min }),
    ExpansionPack: { effarigPack: { isBought: true } }, player: { disablePostReality: false },
    Ra: { unlocks: { unlockGlyphAlchemy: { canBeApplied: true }, alchemyCapIncrease: { effectOrDefault: () => 1 } },
      alchemyResourceCap: cap },
    strengthToRarity: () => 100,
    generatedTypes: ['power', 'time'],
    Pelle: { isDoomed: false },
    AlchemyResource: { decoherence: { effectValue: 2 } },
    ALCHEMY_BASIC_GLYPH_TYPES: ['power', 'time'],
    GlyphTypes: { power: { alchemyResource: 0 }, time: { alchemyResource: 1 } },
    Glyphs: { removeFromInventory: () => { ctx.removed = true; } },
  });
  const code = source.slice(source.indexOf('export const GlyphSacrificeHandler ='), source.lastIndexOf('};') + 2);
  vm.runInContext(code.replace('export const GlyphSacrificeHandler', 'this.handler'), ctx);
  const makeResource = name => ({
    type: name, amount: 0, cap, isUnlocked: true, isBaseResource: true,
    highestRefinementValue: 0,
  });
  ctx.AlchemyResources = { all: [makeResource('power'), makeResource('time')] };
  ctx.handler.glyphAlchemyResource = glyph => ctx.AlchemyResources.all[ctx.GlyphTypes[glyph.type].alchemyResource];
  return ctx;
}

test('huge glyph refinement respects the existing Ra cap without Infinity writes', () => {
  const ctx = refinementWorld(1e6);
  const glyph = { type: 'power', level: new D('HUGE'), strength: 2 };
  assert.ok(ctx.handler.levelRefinementValue(glyph.level) instanceof D);
  assert.equal(ctx.handler.glyphRawRefinementGain(glyph), 1e6);
  assert.equal(ctx.handler.highestRefinementValue(glyph), 1e6);
  ctx.AlchemyResources.all[0].amount = 999999;
  ctx.AlchemyResources.all[1].amount = 999999;
  ctx.handler.refineGlyph(glyph);
  assert.equal(ctx.AlchemyResources.all[0].amount, 1e6);
  assert.equal(ctx.AlchemyResources.all[1].amount, 1e6);
  assert.equal(ctx.AlchemyResources.all[0].highestRefinementValue, 1e6);
  assert.equal(ctx.removed, true);
});

test('decoherence does not overflow before capping at Number.MAX_VALUE', () => {
  const ctx = refinementWorld(Number.MAX_VALUE);
  const glyph = { type: 'power', level: new D('HUGE'), strength: 2 };
  ctx.AlchemyResources.all[0].amount = Number.MAX_VALUE / 2;
  ctx.AlchemyResources.all[1].amount = Number.MAX_VALUE / 2;
  ctx.handler.refineGlyph(glyph);
  assert.ok(Number.isFinite(ctx.AlchemyResources.all[0].amount));
  assert.ok(Number.isFinite(ctx.AlchemyResources.all[1].amount));
});

function galaxyWorld({ altered = false, secondary = 1, remoteReduction = 1 } = {}) {
  const source = read('galaxy.js');
  const ctx = vm.createContext({
    Decimal: D, DC,
    RealityUpgrade: () => ({ effectOrDefault: () => 800 }),
    GalacticPowers: {
      remoteGalaxyScale: { isUnlocked: false },
      remoteGalaxyPower: { isUnlocked: true, reward: remoteReduction },
      galaxyScaling: { isUnlocked: false },
    },
    Effects: { sum: () => 0, min: (initial) => initial },
    BreakEternityUpgrade: { galaxyScaleDelay: { effectOrDefault: () => 0 } },
    Alpha: { isRunning: false },
    AlphaUnlocks: { powerGalaxies: { effects: { buff: { effectOrDefault: () => 1 } } } },
    player: { galaxies: new D(0), disablePostReality: false },
    InfinityUpgrade: { resetBoost: {} },
    InfinityChallenge: () => ({ isCompleted: false }),
    NormalChallenge: () => ({ isRunning: false }),
    TimeStudy: () => ({ effectOrDefault: () => 0 }),
    GlyphSacrifice: { power: { effectValue: new D(0) } },
    GlyphAlteration: { isAdded: () => altered },
    getSecondaryGlyphEffect: () => new D(secondary),
    EternityChallenge: () => ({ isRunning: false, reward: {} }),
    decimalQuadraticSolution: (a, b, c) => new D((-Number(b) + Math.sqrt(Number(b) ** 2 - 4 * Number(a) * Number(c))) / (2 * Number(a))),
  });
  const code = source.slice(0, source.indexOf('\nfunction galaxyReset()')).replace(/^export /gm, '');
  vm.runInContext(code + '\nthis.Galaxy = Galaxy;', ctx);
  return ctx;
}

test('Galaxy ordinary bulk math, Decimal scaling, and exact remote-boundary equality', () => {
  const { Galaxy } = galaxyWorld();
  assert.ok(Galaxy.costScalingStart instanceof D);
  assert.ok(Galaxy.remoteStart instanceof D);
  assert.ok(Galaxy.costMult instanceof D);
  assert.equal(Galaxy.buyableGalaxies(new D(200)).n, 3);
  const remoteCost = Galaxy.requirementAt(Galaxy.remoteStart).amount;
  assert.equal(Galaxy.buyableGalaxies(remoteCost).n, 801);
});

test('Galaxy zero-floor cost and near-unity remote scaling do not produce NaN bulk amounts', () => {
  const { Galaxy } = galaxyWorld({ altered: true, secondary: 1e-20, remoteReduction: 0 });
  assert.equal(Galaxy.requirementAt(new D(0)).amount.n, 1);
  const result = Galaxy.buyableGalaxies(new D(1e100));
  assert.equal(result.n, 1);
  assert.ok(Number.isFinite(result.n));
});

test('Galaxy scaling start does not explicitly coerce an extreme Glyph Sacrifice into Number', () => {
  const source = read('galaxy.js');
  const getter = source.slice(source.indexOf('  static get costScalingStart()'), source.indexOf('  static get type()', source.indexOf('  static get costScalingStart()')));
  assert.doesNotMatch(getter, /GlyphSacrifice\.power\.effectValue\.toNumber\(\)/);
  assert.match(getter, /\.add\(GlyphSacrifice\.power\.effectValue\)/);
});

test('ordinary glyph refinement keeps the original uncapped formula', () => {
  const ctx = refinementWorld(25000);
  ctx.ExpansionPack.effarigPack.isBought = false;
  const glyph = { type: 'power', level: new D(8000), strength: 2 };
  assert.equal(ctx.handler.levelRefinementValue(glyph.level).n, 5120);
  assert.equal(ctx.handler.glyphRawRefinementGain(glyph), 256);
  assert.equal(ctx.handler.highestRefinementValue(glyph), 5120);
});

test('alchemy highest-refinement setter bounds huge values to existing Ra cap and rejects NaN', () => {
  const source = read('celestials/ra/alchemy.js');
  const start = source.indexOf('class BasicAlchemyResourceState extends AlchemyResourceState {');
  const end = source.indexOf('class AdvancedAlchemyResourceState', start);
  const ctx = vm.createContext({
    AlchemyResourceState: class { constructor(config) { this.config = config; } },
    player: { celestials: { ra: { highestRefinementValue: { power: 0 } } } },
    Ra: { alchemyResourceCap: 1e6 },
    Math,
  });
  vm.runInContext(source.slice(start, end) + '\nthis.Resource = BasicAlchemyResourceState;', ctx);
  const resource = new ctx.Resource({ name: 'Power' });
  resource.highestRefinementValue = Infinity;
  assert.equal(resource.highestRefinementValue, 1e6);
  resource.highestRefinementValue = 15;
  assert.equal(resource.highestRefinementValue, 1e6);
  assert.throws(() => { resource.highestRefinementValue = NaN; }, /Invalid glyph refinement value/);
});

test('Galactic Power factors used by Galaxy scaling remain Decimal at their source', () => {
  const source = read('secret-formula/endgame/galactic-power.js');
  for (const [name, nextName] of [['remoteGalaxyScale', 'remoteGalaxyPower'], ['galaxyScaling', 'galaxyGenerationEmpowerment']]) {
    const block = source.slice(source.indexOf(`  ${name}: {`), source.indexOf(`  ${nextName}: {`));
    assert.doesNotMatch(block, /\.toNumber\(\)/);
  }
});
