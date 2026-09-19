const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..', 'src');
const load = relative => fs.readFileSync(path.join(root, relative), 'utf8');

// A tiny strict numeric test double is used for structural arithmetic regression.
// It is NOT break_eternity.js and does not establish browser/save compatibility.
class StrictDecimal {
  constructor(value) { this.n = value instanceof StrictDecimal ? value.n : value; }
  valueOf() { throw new Error('Implicit conversion from Decimal to number'); }
  add(value) { return new StrictDecimal(this.n + new StrictDecimal(value).n); }
  sub(value) { return new StrictDecimal(this.n - new StrictDecimal(value).n); }
  times(value) { return new StrictDecimal(this.n * new StrictDecimal(value).n); }
  div(value) { return new StrictDecimal(this.n / new StrictDecimal(value).n); }
  ln() { return new StrictDecimal(Math.log(this.n)); }
  clampMin(value) { return new StrictDecimal(Math.max(this.n, new StrictDecimal(value).n)); }
}

const replicantiSource = load('core/replicanti.js');
const replicantiMatch = replicantiSource.match(/const gain = remainingGain\.div\(LOG10_E\);[\s\S]*?Replicanti\.amount = boundedPositivePower\(10, totalLog\.div\(Math\.LN10\)\);/);
function runAboveCap({ amount, remainingGain, postScale }) {
  assert.ok(replicantiMatch, 'Must find actual modified over-cap formula in the source');
  const state = { amount: new StrictDecimal(amount) };
  const checkedPow = (base, exponent) => {
    assert.equal(base, 10);
    assert.ok(exponent instanceof StrictDecimal);
    return new StrictDecimal(Math.pow(base, exponent.n));
  };
  new Function('Replicanti', 'remainingGain', 'postScale', 'LOG10_E', 'Decimal', 'boundedPositivePower',
    replicantiMatch[0])(state, new StrictDecimal(remainingGain), postScale, Math.LOG10E, StrictDecimal, checkedPow);
  return state.amount.n;
}

test('Cardinality number rounds to exactly one at huge but finite amounts', () => {
  const cardinality = 1 + 0.2 / (1 + Number.MAX_VALUE / 12500);
  assert.equal(cardinality, 1);
  assert.equal(Math.log10(cardinality), 0);
  assert.ok(Number.isNaN(Math.log(1 + 0 * 2) / 0), 'old formula was 0/0');
});

test('zero slowdown exponent uses exact continuous limit, not 0/0', () => {
  // remainingGain is log10 gain: at scale p=0, amount should gain a factor 10^2.
  assert.ok(Math.abs(runAboveCap({ amount: 20, remainingGain: 2, postScale: 0 }) - 2000) < 1e-8);
});

test('ordinary nonzero slowdown retains old over-cap formula', () => {
  const base = 20; const remainingGain = 2; const p = 0.04;
  const prior = Math.exp(Math.log(1 + (remainingGain / Math.LOG10E) * p) / p + Math.log(base));
  const updated = runAboveCap({ amount: base, remainingGain, postScale: p });
  assert.ok(Math.abs(updated / prior - 1) < 1e-12);
});

test('Replicanti amount assignment uses safe Decimal power without implicit casts', () => {
  assert.match(replicantiSource, /const scaledGain = postScale === 0\s*\? gain/);
  assert.doesNotMatch(replicantiMatch[0], /\.toNumber\(\)/);
  assert.match(load('core/finite-decimal.js'), /throw new Error\(`Invalid Decimal operand in \$\{label\}`\)/);
});

test('Replicanti fast path checks an unrepresentable gain before evaluating its power', () => {
  const start = replicantiSource.indexOf('function fastReplicantiBelow308');
  const end = replicantiSource.indexOf('\n// When the amount is exactly the cap', start);
  assert.ok(start >= 0 && end > start, 'Must find the actual fast Replicanti path');
  const getFastPath = new Function('Replicanti', 'DC', 'RealityUpgrade', 'replicantiCap', 'Decimal',
    'addReplicantiGalaxies', `${replicantiSource.slice(start, end)}\nreturn fastReplicantiBelow308;`);
  const cap = { cap: true };
  let assigned;
  const fastPath = getFastPath({
    galaxies: {},
    set amount(value) { assigned = value; }
  }, {
    E1: { pow: () => assert.fail('unrepresentable gain must not reach Decimal.pow') }
  }, () => assert.fail('disabled autobuyer must not read its Reality Upgrade'), () => cap,
  { isFinite: () => true }, () => assert.fail('disabled autobuyer must not add galaxies'));
  const hugeGain = { gt: maximum => maximum === Number.MAX_VALUE };
  assert.equal(fastPath(hugeGain, false), hugeGain);
  assert.equal(assigned, cap);
});

test('Reality Upgrade 6 keeps its Replicanti Galaxy multiplier as a Decimal', () => {
  const upgrades = load('core/secret-formula/reality/reality-upgrades.js');
  const match = upgrades.match(/effect: \(\) => \(player\.disablePostReality \? DC\.D1 : (Replicanti\.galaxies\.total\.div\(25\)\.add\(1\))\),/);
  assert.ok(match, 'Must find Reality Upgrade 6 Decimal multiplier formula');
  const effect = new Function('player', 'DC', 'Replicanti', `return ${match[1]};`);
  const value = effect({ disablePostReality: false }, { D1: new StrictDecimal(1) }, {
    galaxies: { total: new StrictDecimal(100) }
  });
  assert.ok(value instanceof StrictDecimal);
  assert.equal(value.n, 5);
  assert.doesNotMatch(upgrades, /Replicanti\.galaxies\.total\.div\(25\)\.add\(1\)\.toNumber\(\)/);
});

test('Effarig bonus RG preserves Decimal and UI does not use native addition', () => {
  const effarig = load('core/celestials/effarig.js');
  assert.match(effarig, /return Decimal\.floor\(replicantiCap\(\)\.pLog10\(\)\.div\(LOG10_MAX_VALUE\)\.sub\(1\)\);/);
  assert.match(effarig, /maxRGIncrease\.canBeApplied\) return DC\.D0;/);
  const ui = load('components/tabs/replicanti/ReplicantiTab.vue');
  assert.match(ui, /new Decimal\(Effarig\.bonusRG\)\.add\(2\)/);
  assert.doesNotMatch(ui, /Effarig\.bonusRG \+ 2/);
});

test('glyph level reward, source effects and instability thresholds preserve Decimal', () => {
  const perk = load('core/secret-formula/celestials/perk-shop.js');
  assert.match(perk, /chargedEffect: \(\) => Decimal\.pow\(player\.records\.bestEndgame\.glyphLevel, 0\.2\),/);
  assert.match(perk, /effect: \(\) => new Decimal\(player\.disablePostReality/);
  const ra = load('core/secret-formula/celestials/ra.js');
  assert.match(ra, /relicShardGlyphLevelBoost:[\s\S]*?\.times\(100\)/);
  assert.match(ra, /instabilityDelay:[\s\S]*?\.times\(10\)/);
  const effects = load('core/secret-formula/reality/glyph-effects.js');
  const replicationLevel = effects.split('replicationglyphlevel: {')[1].split('infinitypow: {')[0];
  assert.doesNotMatch(replicationLevel, /\.toNumber\(\)/);
  assert.match(replicationLevel, /total\.add\(effect\)/);
  const effarigGlyph = effects.split('effarigglyph: {')[1].split('effarigblackhole: {')[0];
  assert.doesNotMatch(effarigGlyph, /\.toNumber\(\)/);
  assert.match(effarigGlyph, /combine: GlyphCombiner\.addDecimal/);
  const level = load('core/glyphs/auto-glyph-processor.js');
  assert.match(level, /new Decimal\(0\.4\)\.add\(getAdjustedGlyphEffect\("replicationglyphlevel"\)\)/);
  assert.match(level, /Decimal\.max\(1, PerkShopUpgrade\.glyphLevel\.effectOrDefault\(1\)\)/);
  const glyphs = load('core/glyphs/glyph-core.js');
  assert.match(glyphs, /new Decimal\(1000\)\.add\(getAdjustedGlyphEffect\("effarigglyph"\)\)/);
});

test('instability rewrite is equivalent and avoids premature x4 overflow', () => {
  const oldFormula = (excess, rate, begin) => (Math.sqrt(excess * 4 + 1) - 1) * rate * 0.5 + begin;
  const newFormula = (excess, rate, begin) => (Math.sqrt(excess + 0.25) - 0.5) * rate + begin;
  for (const excess of [0, 1, 10, 20000, 1e100]) {
    const old = oldFormula(excess, 500, 1000);
    const value = newFormula(excess, 500, 1000);
    assert.ok(Math.abs(value / old - 1) < 1e-12, `excess=${excess}`);
  }
  assert.equal(oldFormula(1e308, 1, 0), Infinity);
  assert.ok(Number.isFinite(newFormula(1e308, 1, 0)));
  assert.match(load('core/glyphs/auto-glyph-processor.js'), /Decimal\.sqrt\(excess\.add\(0\.25\)\)\.sub\(0\.5\)\.times\(rate\)\.add\(begin\)/);
});

test('glyph display uses Decimal percentage, not native numeric coercion', () => {
  const ui = load('components/tabs/glyphs/GlyphLevelsAndWeights.vue');
  assert.match(ui, /formatDecimalPercents\(new Decimal\(this\.factors\.perkShop\)\.sub\(1\), 1\)/);
  assert.match(ui, /!Decimal\.eq\(glyphFactors\.perkShop, 1\)/);
});
