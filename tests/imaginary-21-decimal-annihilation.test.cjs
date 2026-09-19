'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const srcRoot = path.join(__dirname, '..', 'src', 'core');
const read = name => fs.readFileSync(path.join(srcRoot, name), 'utf8').replace(/\r\n/g, '\n');
const CAP = Number.MAX_VALUE;

// Arithmetic test double: Decimal is not implicitly convertible to Number.
// It exposes a deliberately simulated very high logarithm for the overflow case.
class D {
  constructor(x) {
    this.n = x instanceof D ? x.n : x;
    this.sign = Math.sign(this.n);
    this.layer = Number.isFinite(this.n) ? 0 : Infinity;
    this.mag = Math.abs(this.n);
  }
  valueOf() { throw new Error('Implicit Decimal-to-Number conversion'); }
  toNumber() { throw new Error('Unsafe Decimal.toNumber() in upgrade effect'); }
  eq(x) { return this.n === new D(x).n; }
  gt(x) { return this.n > new D(x).n; }
  gte(x) { return this.n >= new D(x).n; }
  lt(x) { return this.n < new D(x).n; }
  lte(x) { return this.n <= new D(x).n; }
  add(x) { return new D(this.n + new D(x).n); }
  sub(x) { return new D(this.n - new D(x).n); }
  times(x) { return new D(this.n * new D(x).n); }
  div(x) { return new D(this.n / new D(x).n); }
  dividedBy(x) { return this.div(x); }
  pow(x) { return new D(this.n ** new D(x).n); }
  log10() { return new D(Math.log10(this.n)); }
  static min(x, y) { return new D(Math.min(new D(x).n, new D(y).n)); }
  static max(x, y) { return new D(Math.max(new D(x).n, new D(y).n)); }
  static clamp(x, lo, hi) {
    return new D(Math.min(Math.max(new D(x).n, new D(lo).n), new D(hi).n));
  }
}

function world({ machines = 1e15, logOverride, disabled = false } = {}) {
  class Decimal extends D {
    static log10(value) {
      return new D(logOverride === undefined ? Math.log10(new D(value).n) : logOverride);
    }
  }
  const ctx = {
    Decimal, DC: { D0: new D(0), D1: new D(1), BEMAX: new D(CAP) },
    Currency: { imaginaryMachines: { value: new D(machines) } },
    player: { disablePostReality: disabled },
    GAME_EVENT: { GAME_TICK_AFTER: 1 }, Math, Number, Error,
  };
  const helper = read('finite-decimal.js').replace(/^export /gm, '');
  vm.runInNewContext(`${helper}\nglobalThis.helpers = { boundedPositivePower, boundedPositiveSum, boundedPositiveProduct };`, ctx);
  Object.assign(ctx, ctx.helpers);
  const source = read('secret-formula/reality/imaginary-upgrades.js');
  const begin = source.indexOf('  {\n    name: "Existential Elimination",');
  const end = source.indexOf('\n  },', begin);
  assert.ok(begin >= 0 && end > begin, 'Upgrade 21 config not found');
  const config = vm.runInNewContext(`(${source.slice(begin + 2, end + 4)})`, ctx);
  return { config, ctx };
}

test('normal Imaginary Machine values retain the cubic formula and Decimal effect type', () => {
  for (const [machines, expected] of [[0, 1], [1e8, 1], [1e15, 125], [1e30, 8000]]) {
    const { config } = world({ machines });
    const result = config.effect();
    assert.ok(result instanceof D);
    assert.ok(Math.abs(result.n - expected) <= expected * 1e-12, `${machines}: ${result.n}`);
  }
});

test('disabled post-Reality keeps a Decimal multiplier of one', () => {
  const { config } = world({ machines: 1e30, disabled: true });
  assert.equal(config.effect().n, 1);
  assert.ok(config.effect() instanceof D);
});

test('a high-layer IM logarithm saturates before cubing and never uses toNumber', () => {
  const { config } = world({ logOverride: 1e160 });
  const effect = config.effect();
  assert.ok(effect instanceof D);
  assert.equal(effect.n, CAP);
  assert.ok([effect.sign, effect.layer, effect.mag].every(Number.isFinite));
});

test('invalid IM is diagnosed before it enters annihilation arithmetic', () => {
  for (const machines of [NaN, Infinity, -1]) {
    const { config } = world({ machines });
    assert.throws(() => config.effect(), /Invalid Imaginary Machines/);
  }
});

test('the actual Laitela consumer accepts the capped upgrade effect and stores finite Decimal', () => {
  const { config, ctx } = world({ logOverride: 1e160 });
  const celestial = { darkMatterMult: new D(10) };
  ctx.celestial = celestial;
  ctx.Currency.darkMatter = { value: new D(100) };
  ctx.ImaginaryUpgrade = () => ({ effectOrDefault: () => config.effect() });
  ctx.ExpansionPack = { laitelaPack: { isBought: false } };
  const source = read('celestials/laitela/laitela.js');
  const start = source.indexOf('  get darkMatterMultGain() {');
  const end = source.indexOf('  get darkMatterSoftcap1() {', start);
  assert.ok(start >= 0 && end > start);
  const code = `const Lai = {
    get celestial() { return celestial; },
    get annihilationDMRequirement() { return 10; },
    ${source.slice(start, end)}
  }; globalThis.lai = Lai;`;
  vm.runInNewContext(code, ctx);
  const gain = ctx.lai.darkMatterMultGain;
  assert.ok(gain.n > 0 && gain.n <= CAP);
  const stored = ctx.lai.darkMatterMultAfterAnnihilation;
  assert.ok([stored.sign, stored.layer, stored.mag].every(Number.isFinite));
  assert.equal(stored.n, CAP);
});
