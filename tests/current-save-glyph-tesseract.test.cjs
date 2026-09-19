'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const src = path.resolve(__dirname, '..', 'src');
const read = p => fs.readFileSync(path.join(src, p), 'utf8');

// A strict LOG10 test double represents finite 10^1774 without JS Number overflow.
// It is NOT the game's break_eternity implementation; the browser must still be tested.
class StrictLogDecimal {
  constructor(value) {
    if (value instanceof StrictLogDecimal) { this.sign = value.sign; this.log = value.log; this.native = value.native; }
    else if (typeof value === 'string' && /^\d+(?:\.\d+)?e\d+$/i.test(value)) {
      const [mantissa, exponent] = value.split(/e/i);
      this.sign = 1; this.log = Math.log10(Number(mantissa)) + Number(exponent);
    } else {
      if (typeof value !== 'number' || Number.isNaN(value)) throw new Error('invalid test operand');
      this.sign = Math.sign(value); this.native = value;
      this.log = value === 0 ? -Infinity : Math.log10(Math.abs(value));
    }
    this.layer = this.sign === 0 || this.log <= 308 ? 0 : 1;
    this.mag = this.sign === 0 ? 0 : this.layer ? this.log : 10 ** this.log;
  }
  static from(sign, log) {
    const value = Object.create(StrictLogDecimal.prototype);
    value.sign = sign;
    value.log = sign === 0 ? -Infinity : log;
    value.layer = sign !== 0 && log > 308 ? 1 : 0;
    value.mag = sign === 0 ? 0 : value.layer ? log : 10 ** log;
    return value;
  }
  valueOf() { throw new Error('Implicit conversion from Decimal to number'); }
  toNumber() { return this.native !== undefined ? this.native : this.sign === 0 ? 0 : this.sign * 10 ** this.log; }
  add(x) {
    const b = new StrictLogDecimal(x);
    if (!this.sign) return b;
    if (!b.sign) return this;
    const max = Math.max(this.log, b.log);
    if (this.sign === b.sign) return StrictLogDecimal.from(this.sign,
      max + Math.log10(10 ** (this.log - max) + 10 ** (b.log - max)));
    if (this.log === b.log) return new StrictLogDecimal(0);
    const larger = this.log > b.log ? this : b;
    const smaller = larger === this ? b : this;
    return StrictLogDecimal.from(larger.sign,
      larger.log + Math.log10(1 - 10 ** (smaller.log - larger.log)));
  }
  sub(x) { const b = new StrictLogDecimal(x); return this.add(StrictLogDecimal.from(-b.sign, b.log)); }
  times(x) { const b = new StrictLogDecimal(x); return this.sign && b.sign
    ? StrictLogDecimal.from(this.sign * b.sign, this.log + b.log) : new StrictLogDecimal(0); }
  div(x) { const b = new StrictLogDecimal(x); if (!b.sign) throw new Error('test divide by zero');
    return this.sign ? StrictLogDecimal.from(this.sign * b.sign, this.log - b.log) : new StrictLogDecimal(0); }
  eq(x) { const b = new StrictLogDecimal(x); return this.sign === b.sign && Math.abs(this.log - b.log) < 1e-10; }
  lt(x) { const b = new StrictLogDecimal(x); return this.sign < b.sign ||
    this.sign === b.sign && (this.sign >= 0 ? this.log < b.log : this.log > b.log); }
  gt(x) { return !this.lt(x) && !this.eq(x); }
  gte(x) { return this.gt(x) || this.eq(x); }
  static pow(base, exponent) { const a = new StrictLogDecimal(base); const b = new StrictLogDecimal(exponent);
    const n = b.toNumber(); if (!Number.isFinite(n) || a.sign < 0) throw new Error('mock power outside tested domain');
    return a.sign ? StrictLogDecimal.from(1, a.log * n) : new StrictLogDecimal(0); }
  static min(a,b) { const x = new StrictLogDecimal(a), y = new StrictLogDecimal(b); return x.lt(y) ? x : y; }
  static max(a,b) { const x = new StrictLogDecimal(a), y = new StrictLogDecimal(b); return x.gte(y) ? x : y; }
  static floor(x) { return new StrictLogDecimal(Math.floor(new StrictLogDecimal(x).toNumber())); }
  static sumReducer(a,b) { return new StrictLogDecimal(a).add(b); }
  static prodReducer(a,b) { return new StrictLogDecimal(a).times(b); }
}
// The uploaded save has 300% rarity glyphs (strength 8.5) at this level.
const level = new StrictLogDecimal('9.26010770924818e1774');
function glyphWorld() {
  const code = read('core/secret-formula/reality/glyph-effects.js')
    .replace(/^import .*;\s*$/gm, '')
    .replace(/^export const /gm, 'const ')
    + '\nglobalThis.glyphEffectsForTest = glyphEffects; globalThis.combinerForTest = GlyphCombiner;';
  const ctx = {
    Decimal: StrictLogDecimal, DC: { D0: new StrictLogDecimal(0), D1: new StrictLogDecimal(1) },
    EffarigUnlock: { endgame: { canBeApplied: true } },
    GlyphAlteration: { sacrificeBoost: () => 1, isAdded: () => false, isEmpowered: () => false },
    format: value => value instanceof StrictLogDecimal ? `10^${value.log.toFixed(3)}` : String(value),
    formatInt: value => String(value),
    ALTERATION_TYPE: { BOOST: 1, ADDITION: 2, EMPOWER: 3 },
  };
  vm.runInNewContext(code, ctx, { filename: 'core/secret-formula/reality/glyph-effects.js' });
  return ctx;
}
test('current save level is finite and original Number coercion would overflow', () => {
  assert.ok(Number.isFinite(level.sign) && Number.isFinite(level.layer) && Number.isFinite(level.mag));
  assert.equal(level.toNumber(), Infinity);
  assert.equal(level.log > 1774, true);
});
test('all ten previously overflowing glyph effects remain finite Decimal and combine without implicit casts', () => {
  const { glyphEffectsForTest: effects } = glyphWorld();
  const ids = ['timepow', 'replicationpow', 'infinitypow', 'infinityrate', 'effarigblackhole',
    'effarigachievement', 'effarigforgotten', 'effarigdimensions', 'effarigantimatter', 'timeshardpow'];
  for (const id of ids) {
    const effect = effects[id];
    const once = effect.effect(level, 8.5);
    assert.ok(once instanceof StrictLogDecimal, `${id} must be Decimal`);
    assert.ok([once.sign, once.layer, once.mag].every(Number.isFinite), `${id} must stay finite`);
    assert.equal(once.toNumber(), Infinity, `${id} should reproduce the old Number overflow`);
    const combined = effect.combine([once, once]);
    assert.ok(combined instanceof StrictLogDecimal, `${id} combiner must stay Decimal`);
    assert.ok([combined.sign, combined.layer, combined.mag].every(Number.isFinite), `${id} combined finite`);
    assert.ok(typeof effect.formatEffect(combined) === 'string');
    if (effect.formatSingleEffect) assert.ok(typeof effect.formatSingleEffect(once) === 'string');
    if (effect.conversion) assert.ok(effect.conversion(combined) instanceof StrictLogDecimal);
  }
});
test('normal-scale glyph exponent and combination retain sum(effects) - n + 1 mechanic', () => {
  const { glyphEffectsForTest: effects } = glyphWorld();
  const ordinary = effects.timepow.effect(new StrictLogDecimal(100), 8.5);
  const expected = Math.pow(100, 0.4) * Math.pow(8.5, 1.2) / 50 + 1;
  assert.ok(Math.abs(ordinary.toNumber() - expected) < 1e-12);
  assert.ok(Math.abs(effects.timepow.combine([ordinary, ordinary]).toNumber() - (2 * expected - 1)) < 1e-11);
});
test('cursed dimension conflict no longer feeds Decimal into Number reducer', () => {
  const content = read('core/glyphs/glyph-effects.js');
  assert.match(content, /const combineFunction = \[GlyphCombiner\.multiply, GlyphCombiner\.multiplyDecimal, GlyphCombiner\.multiplyDecimal\]/);
  const { combinerForTest: combiner } = glyphWorld();
  const combined = combiner.multiplyDecimal([0.8, level]);
  assert.ok(combined instanceof StrictLogDecimal && Number.isFinite(combined.mag));
});
test('all introduced Decimal consumers use explicit arithmetic and keep the original save schema', () => {
  const checks = [
    ['core/dimensions/infinity-dimension.js', /return Decimal\.pow\(new Decimal\(7\)\.add\(getAdjustedGlyphEffect\("infinityrate"\)\)/],
    ['core/dimensions/antimatter-dimension.js', /new Decimal\(getAdjustedGlyphEffect\("effarigantimatter"\)\)[\s\S]*?\.timesEffectsOf\(EndgameMastery\(101\)/],
    ['core/achievements/normal-achievement.js', /new Decimal\(getAdjustedGlyphEffect\("effarigachievement"\)\)/],
    ['core/secret-formula/multiplier-tab/infinity-dimensions.js', /new Decimal\(getAdjustedGlyphEffect\("infinitypow"\)\)\.times/],
    ['core/secret-formula/multiplier-tab/time-dimensions.js', /new Decimal\(getAdjustedGlyphEffect\("timepow"\)\)\.times/],
    ['core/dimboost.js', /new Decimal\(ImaginaryUpgrade\(12\)\.effectOrDefault\(0\)\)\.times/],
  ];
  for (const [file, pattern] of checks) assert.match(read(file), pattern, file);
  assert.match(read('core/celestials/enslaved.js'), /affordable\.gt\(Number\.MAX_SAFE_INTEGER\)/);
  assert.match(read('core/celestials/enslaved.js'), /this\.bought < Number\.MAX_SAFE_INTEGER/);
  assert.doesNotMatch(read('core/celestials/enslaved.js'), /tesseracts \+= this\.amountNeeded\.toNumber\(\)/);
});

test('bulk Tesseract purchase writes finite Number at storage boundary instead of Infinity', () => {
  const file = read('core/celestials/enslaved.js');
  const begin = file.indexOf('export const Tesseracts = {');
  const end = file.indexOf('\nEventHub.logic.on(', begin);
  assert.ok(begin >= 0 && end > begin);
  const sandbox = {
    Decimal: StrictLogDecimal,
    DC: { BEMAX: new StrictLogDecimal('1e2000'), D0: new StrictLogDecimal(0) },
    player: { celestials: { enslaved: { tesseracts: 703 } }, disablePostReality: false },
    Currency: { infinityPoints: { gte: () => true } },
    Enslaved: { isCompleted: true },
    GameEnd: { creditsEverClosed: false },
  };
  vm.runInNewContext(file.slice(begin, end).replace('export const ', 'const ') + '\nglobalThis.Tesseracts = Tesseracts;', sandbox);
  const t = sandbox.Tesseracts;
  Object.defineProperty(t, 'nextCost', { configurable: true, value: new StrictLogDecimal(1) });
  Object.defineProperty(t, 'canBeBoughtRaw', { configurable: true, value: new StrictLogDecimal(705) });
  t.buyMaxTesseract();
  assert.equal(sandbox.player.celestials.enslaved.tesseracts, 705, 'normal bulk buying retains exact target');
  Object.defineProperty(t, 'canBeBoughtRaw', { configurable: true, value: new StrictLogDecimal('1e1000') });
  t.buyMaxTesseract();
  assert.equal(sandbox.player.celestials.enslaved.tesseracts, 706,
    'an unrepresentable inverse permits only one verified purchase');
  assert.equal(Number.isFinite(sandbox.player.celestials.enslaved.tesseracts), true);
  sandbox.player.celestials.enslaved.tesseracts = Number.MAX_SAFE_INTEGER;
  assert.equal(t.canBuyTesseract, false, 'stop at the Number exact-integer boundary');
  t.buyMaxTesseract();
  assert.equal(sandbox.player.celestials.enslaved.tesseracts, Number.MAX_SAFE_INTEGER);
});

// The previous hotfix tested Decimal.min(MAX).toNumber() with a mock that returned
// MAX_VALUE directly. The real library can normalize MAX_VALUE as 10^308.254...;
// converting that back to native Number can round up to Infinity. Model exactly
// that edge instead of assuming Decimal.toNumber() preserves the storage ceiling.
test('bulk Tesseract purchase never converts MAX_VALUE back from Decimal', () => {
  const file = read('core/celestials/enslaved.js');
  const begin = file.indexOf('export const Tesseracts = {');
  const end = file.indexOf('\nEventHub.logic.on(', begin);
  assert.ok(begin >= 0 && end > begin);
  const sandbox = {
    Decimal: StrictLogDecimal,
    DC: { BEMAX: new StrictLogDecimal('1e2000'), D0: new StrictLogDecimal(0) },
    player: { celestials: { enslaved: { tesseracts: 703 } }, disablePostReality: false },
    Currency: { infinityPoints: { gte: () => true } },
    Enslaved: { isCompleted: true },
    GameEnd: { creditsEverClosed: false },
  };
  vm.runInNewContext(file.slice(begin, end).replace('export const ', 'const ') +
    '\nglobalThis.Tesseracts = Tesseracts;', sandbox);
  const t = sandbox.Tesseracts;
  Object.defineProperty(t, 'nextCost', { configurable: true, value: new StrictLogDecimal(1) });
  const enormous = new StrictLogDecimal('1e1000');
  enormous.toNumber = () => { throw new Error('Never convert an enormous affordable count'); };
  Object.defineProperty(t, 'canBeBoughtRaw', { configurable: true, value: enormous });
  t.buyMaxTesseract();
  assert.equal(sandbox.player.celestials.enslaved.tesseracts, 704);
  assert.equal(Number.isFinite(sandbox.player.celestials.enslaved.tesseracts), true);
  assert.equal(t.canBuyTesseract, true);
});

test('bulk Tesseract near an unsafe Number boundary buys one verified unit', () => {
  const file = read('core/celestials/enslaved.js');
  const begin = file.indexOf('export const Tesseracts = {');
  const end = file.indexOf('\nEventHub.logic.on(', begin);
  const sandbox = {
    Decimal: StrictLogDecimal,
    DC: { BEMAX: new StrictLogDecimal('1e2000'), D0: new StrictLogDecimal(0) },
    player: { celestials: { enslaved: { tesseracts: 703 } }, disablePostReality: false },
    Currency: { infinityPoints: { gte: () => true } },
    Enslaved: { isCompleted: true },
    GameEnd: { creditsEverClosed: false },
  };
  vm.runInNewContext(file.slice(begin, end).replace('export const ', 'const ') +
    '\nglobalThis.Tesseracts = Tesseracts;', sandbox);
  const t = sandbox.Tesseracts;
  Object.defineProperty(t, 'nextCost', { configurable: true, value: new StrictLogDecimal(1) });
  const justBelow = {
    sign: 1, layer: 1, mag: 308.1,
    gte: () => false,
    gt: () => true,
    lt: () => false,
    toNumber: () => { throw new Error("No unsafe toNumber conversion"); },
    div: () => ({ toNumber: () => 0.75 }),
  };
  Object.defineProperty(t, 'canBeBoughtRaw', { configurable: true, value: justBelow });
  t.buyMaxTesseract();
  assert.equal(sandbox.player.celestials.enslaved.tesseracts, 704);
  assert.equal(Number.isFinite(sandbox.player.celestials.enslaved.tesseracts), true);
});
