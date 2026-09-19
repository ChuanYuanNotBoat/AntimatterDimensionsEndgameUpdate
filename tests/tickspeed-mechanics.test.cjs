const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, 'src', file), 'utf8');

// Real ADE's Decimal.valueOf throws; the toy Decimal follows that contract to
// catch accidental native numeric operators on a Decimal value.
class Decimal {
  constructor(value = 0) { this.n = value instanceof Decimal ? value.n : Number(value); }
  valueOf() { throw new Error('Implicit conversion from Decimal to number'); }
  add(value) { return new Decimal(this.n + new Decimal(value).n); }
  times(value) { return new Decimal(this.n * new Decimal(value).n); }
  div(value) { return new Decimal(this.n / new Decimal(value).n); }
  log10() { return new Decimal(Math.log10(this.n)); }
  max(value) { return new Decimal(Math.max(this.n, new Decimal(value).n)); }
  gt(value) { return this.n > new Decimal(value).n; }
  static max(a, b) { return new Decimal(a).max(b); }
  static min(a, b) { return new Decimal(Math.min(new Decimal(a).n, new Decimal(b).n)); }
}

function setup({ ascension = false, alpha = false, galacticUnlocked = true } = {}) {
  const player = { disablePostReality: false,
    galaxies: new Decimal(2), dilation: { totalTachyonGalaxies: new Decimal(7) } };
  const ctx = vm.createContext({
    Decimal,
    DC: { D0: new Decimal(0) },
    player,
    Replicanti: { amount: new Decimal(1e6), galaxies: {
      bought: new Decimal(4), extra: new Decimal(1) } },
    AlchemyResource: { alternation: { effectValue: new Decimal(1) } },
    Alpha: { currentStage: alpha ? 3 : 0 },
    GalaxyGenerator: { galaxies: new Decimal(3) },
    GalacticPower: { freeGalaxies: new Decimal(galacticUnlocked ? 5 : 0) },
    GalacticPowers: { freeGalaxies: { isUnlocked: galacticUnlocked },
      galacticAscension: { isUnlocked: ascension } },
    ReplicantiUpgrade: { galaxies: { value: new Decimal(2) } },
    TimeStudy: id => ({ value: id === 132 ? 0.5 : 0.25 }),
    EternityChallenge: () => ({ reward: { value: 0.25 } }),
    Effects: { sum: (...sources) => sources.reduce((sum, source) => sum + source.value, 0) }
  });
  const source = read('core/tickspeed.js');
  const start = source.indexOf('export function effectiveBaseGalaxies(');
  const end = source.indexOf('export function getTickSpeedMultiplier(', start);
  assert.ok(start >= 0 && end > start);
  vm.runInContext(source.slice(start, end).replace('export function', 'function') +
    '\nthis.audit = effectiveBaseGalaxies;', ctx);
  return ctx;
}

for (const ascension of [false, true]) {
  for (const alpha of [false, true]) {
    test(`source diagnostics recompose exact gameplay count: ascension=${ascension}, alpha=${alpha}`, () => {
      const ctx = setup({ ascension, alpha });
      const before = ctx.player.galaxies.n;
      const details = {};
      const actual = ctx.audit(null, details);
      const factors = details.sources.map(source => ascension ? source.effective.max(1) : source.effective);
      const derived = factors.reduce((result, factor) => ascension
        ? result.times(factor) : result.add(factor), new Decimal(ascension ? 1 : 0));
      assert.ok(Math.abs(actual.n - derived.n) < 1e-9, 'reported inputs must recombine to gameplay result');
      assert.equal(details.sources.length, 5);
      assert.equal(details.sources.find(s => s.key === 'replicanti').raw.n, 4);
      assert.equal(details.replicantiExtra.n, 1);
      assert.equal(details.sources.find(s => s.key === 'replicanti').effective.n > 4, true);
      assert.equal(ctx.player.galaxies.n, before, 'diagnostic must not mutate player state');
      assert.equal(ctx.audit().n, actual.n, 'collecting diagnostics must not change gameplay value');
      for (const source of details.sources) {
        const without = ctx.audit(source.key);
        assert.ok(Number.isFinite(without.n), `exclusion ${source.key} must remain finite in test case`);
      }
    });
  }
}

test('unlocked GP reward #12 is the only reason its source is shown', () => {
  const ctx = setup({ galacticUnlocked: false });
  const details = {};
  ctx.audit(null, details);
  const gp = details.sources.find(source => source.key === 'galactic');
  assert.equal(gp.unlocked, false);
  assert.equal(gp.raw.n, 0);
});

test('Tickspeed uses original-style expandable analysis rows, not a separate algorithm panel', () => {
  const trace = read('core/secret-formula/multiplier-tab/tickspeed-breakdown.js');
  const values = read('core/secret-formula/multiplier-tab/tickspeed.js');
  const tree = read('core/secret-formula/multiplier-tab/tree.js');
  const tab = read('components/tabs/statistics/MultiplierBreakdownTab.vue');
  assert.match(trace, /effectiveBaseGalaxies\(null, galaxyDetails\)/);
  assert.match(trace, /addOrderedTransform\(steps, "upgrades"/);
  assert.match(values, /upgrades:\s*\{[\s\S]*?transformValue: \(\) => TickspeedBreakdown\.transform\("upgrades"\)/);
  assert.match(values, /tickspeedUpgrades = \{[\s\S]*?transformValue: \(\) => TickspeedBreakdown\.transform\("purchased"\)/);
  assert.match(tree, /tickspeed_total: \[\s*\["tickspeed_base", "tickspeed_upgrades", "tickspeed_galaxies"/);
  assert.match(tree, /tickspeed_upgrades: \[\s*\["tickspeedUpgrades_purchased", "tickspeedUpgrades_free"\]/);
  assert.doesNotMatch(tab, /TickspeedMechanicsSummary/);
  assert.match(tab, /<MultiplierBreakdownEntry/);
});
