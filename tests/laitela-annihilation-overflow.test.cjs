'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const CAP = 1e6;
const root = path.join(__dirname, '..', 'src', 'core');
const read = file => fs.readFileSync(path.join(root, file), 'utf8').replace(/\r\n/g, '\n');

// A strict, deliberately small Decimal representation ceiling. Operations
// which would exceed CAP become invalid *before* the player setter can run.
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
  add(x) { const n = this.n + new D(x).n; return new D(n > CAP ? Infinity : n); }
  plus(x) { return this.add(x); }
  sub(x) { return new D(this.n - new D(x).n); }
  div(x) { return new D(this.n / new D(x).n); }
  dividedBy(x) { return this.div(x); }
  times(x) { const n = this.n * new D(x).n; return new D(n > CAP ? Infinity : n); }
  pow(x) { const n = this.n ** new D(x).n; return new D(n > CAP ? Infinity : n); }
  log10() { return new D(Math.log10(this.n)); }
  static pow(x, y) { return new D(x).pow(y); }
  static log10(x) { return new D(x).log10(); }
  static min(x, y) { return new D(Math.min(new D(x).n, new D(y).n)); }
  static clamp(x, min, max) { return new D(Math.min(Math.max(new D(x).n, new D(min).n), new D(max).n)); }
}

function world({ dark = 100, current = 10, imaginary = 2, pack = false, milestone = false } = {}) {
  let stored = new D(current);
  let resets = 0;
  let quotes = 0;
  let achievements = 0;
  const celestial = {
    get darkMatterMult() { return stored; },
    set darkMatterMult(value) {
      assert.ok(value instanceof D, 'Decimal storage must retain its type');
      assert.ok([value.sign, value.layer, value.mag].every(Number.isFinite), 'nonfinite player Decimal write');
      stored = value;
    },
  };
  const ctx = {
    Decimal: D,
    DC: { D0: new D(0), D1: new D(1), BEMAX: new D(CAP) },
    Currency: { darkMatter: { value: new D(dark) } },
    ExpansionPack: { laitelaPack: { isBought: pack } },
    player: { disablePostReality: false },
    ImaginaryUpgrade: () => ({ effectOrDefault: () => new D(imaginary) }),
    DivinityMilestone: { hadronEmpowerment: { isReached: milestone } },
    DarkMatterDimensions: { reset() { resets++; } },
    Achievement: () => ({ unlock() { achievements++; } }),
    Math, Number, Error,
  };
  const helperCode = read('finite-decimal.js').replace(/^export /gm, '');
  vm.runInNewContext(`${helperCode}\nglobalThis.helpers = {
    boundedPositivePower, boundedPositiveProduct, boundedPositiveSum
  };`, ctx);
  Object.assign(ctx, ctx.helpers);
  const source = read('celestials/laitela/laitela.js');
  const begin = source.indexOf('  get darkMatterMultGain() {');
  const end = source.indexOf('  get darkMatterSoftcap1() {', begin);
  const annihilateBegin = source.indexOf('  annihilate(force) {');
  const annihilateEnd = source.indexOf('  // Greedily buys', annihilateBegin);
  assert.ok(begin >= 0 && end > begin && annihilateBegin >= 0 && annihilateEnd > annihilateBegin);
  const sandbox = { ...ctx, celestial, recordQuote() { quotes++; } };
  vm.runInNewContext(`const Laitela = {
    get celestial() { return celestial; },
    get annihilationDMRequirement() { return 10; },
    get canAnnihilate() { return true; },
    quotes: { annihilation: { show() { recordQuote(); } } },
    ${source.slice(begin, end)}
    ${source.slice(annihilateBegin, annihilateEnd)}
  }; globalThis.laitela = Laitela;`, sandbox);
  return { Laitela: sandbox.laitela, ctx: sandbox,
    get stored() { return stored; },
    get resets() { return resets; },
    get quotes() { return quotes; },
    get achievements() { return achievements; } };
}

test('ordinary annihilation gain, total and ratio preserve the gameplay formula', () => {
  const w = world();
  const originalGain = (Math.log10(100 / 10 + 1) ** 1.5) * 2;
  assert.ok(Math.abs(w.Laitela.darkMatterMultGain.n - originalGain) < 1e-12);
  assert.ok(Math.abs(w.Laitela.darkMatterMultRatio.n - (10 + originalGain) / 10) < 1e-12);
  assert.equal(w.Laitela.annihilate(false), true);
  assert.ok(Math.abs(w.stored.n - (10 + originalGain)) < 1e-12);
  assert.equal(w.resets, 1);
  assert.equal(w.quotes, 1);
  assert.equal(w.achievements, 1);
});

test('expansion-pack exponent retains the original formula for ordinary values', () => {
  const w = world({ pack: true });
  const extraPow = ((Math.log10(Math.log10(101) + 1) + 1) / 2) ** 2 + 1;
  const gain = ((Math.log10(11) ** 1.5) * 2) ** extraPow;
  assert.ok(Math.abs(w.Laitela.darkMatterMultGain.n / gain - 1) < 1e-12);
});

test('expansion-pack power overflow is intercepted before producing an infinite gain', () => {
  const w = world({ dark: 1e5, imaginary: 1e5, pack: true });
  assert.equal(w.Laitela.darkMatterMultGain.n, CAP);
  assert.equal(w.Laitela.annihilate(false), true);
  assert.equal(w.stored.n, CAP);
});

test('two valid finite operands cannot overflow the stored annihilation multiplier', () => {
  const w = world({ dark: 100, imaginary: 470000, current: 600000 });
  assert.ok(w.Laitela.darkMatterMultGain.n > 0 && w.Laitela.darkMatterMultGain.n < CAP);
  assert.equal(w.Laitela.darkMatterMultRatio.n, CAP / 600000);
  w.Laitela.annihilate(false);
  assert.equal(w.stored.n, CAP);
});

test('zero Dark Matter remains zero gain, including with the expansion pack', () => {
  for (const pack of [false, true]) {
    const w = world({ dark: 0, current: 10, pack });
    assert.equal(w.Laitela.darkMatterMultGain.n, 0);
    assert.equal(w.Laitela.darkMatterMultRatio.n, 1);
    w.Laitela.annihilate(true);
    assert.equal(w.stored.n, 10);
  }
});

test('already saturated multiplier stays stable even if annihilation is manually forced', () => {
  const w = world({ current: CAP, dark: 1e5, imaginary: 1e5, pack: true });
  assert.equal(w.Laitela.darkMatterMultRatio.n, 1);
  w.Laitela.annihilate(true);
  assert.equal(w.stored.n, CAP);
});

test('finite above-cap legacy multiplier is never retroactively lowered', () => {
  const w = world({ current: CAP + 10 });
  assert.equal(w.Laitela.darkMatterMultRatio.n, 1);
  w.Laitela.annihilate(true);
  assert.equal(w.stored.n, CAP + 10);
});

test('invalid Dark Matter, gain effect and saved multiplier retain diagnostics', () => {
  assert.throws(() => world({ dark: Infinity }).Laitela.darkMatterMultGain, /Invalid Dark Matter/);
  assert.throws(() => world({ dark: NaN }).Laitela.darkMatterMultGain, /Invalid Dark Matter/);
  assert.throws(() => world({ imaginary: Infinity }).Laitela.darkMatterMultGain, /Invalid Imaginary/);
  assert.throws(() => world({ imaginary: NaN }).Laitela.darkMatterMultGain, /Invalid Imaginary/);
  const w = world({ current: Infinity });
  assert.throws(() => w.Laitela.annihilate(false), /Invalid saved annihilation multiplier/);
  assert.equal(w.resets, 0);
});

test('autobuyer does not repeatedly reset at ceiling or overflow the mode-1 threshold', () => {
  const w = world({ current: CAP, dark: 1e5, imaginary: 1e5, pack: true });
  const source = read('autobuyers/annihilation-autobuyer.js')
    .replace(/^import .*;\s*$/gm, '').replace(/^export /gm, '');
  const sandbox = { Laitela: w.Laitela, DC: w.ctx.DC, AutobuyerState: class {}, Math, Number };
  vm.runInNewContext(`${source}\nglobalThis.Buyer = AnnihilationAutobuyerState;`, sandbox);
  const buyer = new sandbox.Buyer();
  buyer.tick();
  assert.equal(w.resets, 0);
  const w2 = world({ current: 600000, dark: 100, imaginary: 470000 });
  const sandbox2 = { ...sandbox, Laitela: w2.Laitela };
  vm.runInNewContext(`${source}\nglobalThis.Buyer = AnnihilationAutobuyerState;`, sandbox2);
  const buyer2 = new sandbox2.Buyer();
  Object.defineProperty(buyer2, 'mode', { value: 1 });
  Object.defineProperty(buyer2, 'multiplier', { value: 0.5 });
  buyer2.tick();
  assert.equal(w2.resets, 1);
  assert.equal(w2.stored.n, CAP);
});

test('annihilation UI previews the capped effective gain rather than an impossible reward', () => {
  const vue = fs.readFileSync(path.join(__dirname, '..', 'src', 'components', 'tabs',
    'celestial-laitela', 'AnnihilationButton.vue'), 'utf8');
  assert.match(vue, /darkMatterMultGain\.copyFrom\(Laitela\.darkMatterMultAfterAnnihilation\.sub\(Laitela\.darkMatterMult\)\)/);
  const w = world({ current: CAP, dark: 1e5, imaginary: 1e5, pack: true });
  assert.equal(w.Laitela.darkMatterMultAfterAnnihilation.sub(w.Laitela.darkMatterMult).n, 0);
});

test('autobuyer multiplier mode refuses a target larger than the achievable gain', () => {
  const w = world({ current: 600000, dark: 100, imaginary: 470000 });
  const source = read('autobuyers/annihilation-autobuyer.js')
    .replace(/^import .*;\s*$/gm, '').replace(/^export /gm, '');
  const sandbox = { Laitela: w.Laitela, DC: w.ctx.DC, AutobuyerState: class {}, Number, Math };
  vm.runInNewContext(`${source}\nglobalThis.Buyer = AnnihilationAutobuyerState;`, sandbox);
  const buyer = new sandbox.Buyer();
  Object.defineProperty(buyer, 'mode', { value: 1 });
  Object.defineProperty(buyer, 'multiplier', { value: 2 });
  buyer.tick();
  assert.equal(w.resets, 0);
  assert.equal(w.stored.n, 600000);
});
