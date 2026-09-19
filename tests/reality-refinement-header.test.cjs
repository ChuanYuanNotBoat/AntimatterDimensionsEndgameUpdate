'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const sourceRoot = path.join(__dirname, '..', 'src');
const read = p => fs.readFileSync(path.join(sourceRoot, p), 'utf8');

// Strict test double: additions are represented in log-space so two finite
// native Numbers may exceed Number.MAX_VALUE while remaining a finite Decimal.
// This is not the browser's break_eternity implementation.
class D {
  constructor(input) {
    if (input instanceof D) {
      this.log = input.log; this.native = input.native; return;
    }
    if (typeof input !== 'number' || Number.isNaN(input) || input < 0) throw new Error('invalid test input');
    this.log = input === 0 ? -Infinity : Math.log10(input);
    this.native = input;
  }
  static fromLog(log) {
    const out = Object.create(D.prototype);
    out.log = log; out.native = undefined;
    return out;
  }
  valueOf() { throw new Error('Implicit conversion from Decimal to number'); }
  // Keep the mock's log-space values distinguishable from native overflow.
  get sign() { return this.log === -Infinity ? 0 : 1; }
  get layer() { return this.log >= 308 ? 1 : 0; }
  get mag() { return this.sign === 0 ? 0 : this.layer ? this.log : this.toNumber(); }
  toNumber() { return this.native === undefined ? 10 ** this.log : this.native; }
  add(input) {
    const b = new D(input);
    if (this.log === -Infinity) return b;
    if (b.log === -Infinity) return this;
    const hi = Math.max(this.log, b.log), lo = Math.min(this.log, b.log);
    return D.fromLog(hi + Math.log10(1 + 10 ** (lo - hi)));
  }
  times(input) { return D.fromLog(this.log + new D(input).log); }
  timesEffectsOf() { return this; }
  lte(input) { return this.log <= new D(input).log; }
  lt(input) { return this.log < new D(input).log; }
  gte(input) { return this.log >= new D(input).log; }
  div(input) { return D.fromLog(this.log - new D(input).log); }
  log10() {
    if (this.log === -Infinity) throw new Error('log10(0) is not finite');
    return new D(this.log);
  }
  static min(left, right) {
    const a = new D(left), b = new D(right);
    return a.log <= b.log ? a : b;
  }
}

function guardedAlchemyResource(amount, cap) {
  let stored = amount;
  return {
    isUnlocked: true, isBaseResource: false, cap,
    get amount() { return stored; },
    set amount(value) {
      if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error('nonfinite saved resource amount');
      stored = value;
    }
  };
}

function runRefinement({ initial, otherInitial, gain, cap }) {
  const resource = guardedAlchemyResource(initial, cap);
  const other = guardedAlchemyResource(otherInitial, cap);
  let removed = 0;
  const context = {
    Decimal: D, Pelle: { isDoomed: false }, Ra: { alchemyResourceCap: cap },
    GlyphTypes: { power: { alchemyResource: 0 }, time: { alchemyResource: 1 } },
    AlchemyResources: { all: [resource, other] },
    AlchemyResource: { decoherence: { effectValue: 1 } },
    ALCHEMY_BASIC_GLYPH_TYPES: ['power', 'time'],
    Glyphs: { removeFromInventory: () => { removed++; } },
  };
  vm.runInNewContext(read('core/glyphs/glyph-purge-handler.js')
    .replace('export const GlyphSacrificeHandler =', 'globalThis.GlyphSacrificeHandler ='), context);
  const handler = context.GlyphSacrificeHandler;
  handler.glyphRawRefinementGain = () => gain;
  handler.glyphRefinementGain = () => gain;
  handler.glyphEffectiveCap = () => cap;
  handler.refineGlyph({ type: 'power', strength: 1, level: 1 });
  return { amount: resource.amount, other: other.amount, removed };
}

test('Reality glyph refinement caps the Decimal sum before native Number assignment', () => {
  assert.equal(Number.MAX_VALUE / 2 + Number.MAX_VALUE, Infinity,
    'reproduces old finite+finite overflow');
  const state = runRefinement({
    initial: Number.MAX_VALUE / 2, otherInitial: Number.MAX_VALUE / 2,
    gain: Number.MAX_VALUE, cap: Number.MAX_VALUE
  });
  assert.equal(state.amount, Number.MAX_VALUE);
  assert.equal(state.other, Number.MAX_VALUE);
  assert.equal(state.removed, 1);
});

test('ordinary alchemy refinement is unchanged (main and decoherence recipients)', () => {
  const state = runRefinement({ initial: 100, otherInitial: 200, gain: 40, cap: 500 });
  assert.ok(Math.abs(state.amount - 140) < 1e-10);
  assert.ok(Math.abs(state.other - 240) < 1e-10);
});

test('a balance above its current cap is not retroactively lowered by a zero-gain refinement', () => {
  const state = runRefinement({ initial: 600, otherInitial: 700, gain: 0, cap: 500 });
  assert.equal(state.amount, 600);
  assert.equal(state.other, 700);
});

test('header follows actual gameplay threshold and never takes log10 of zero on reset', () => {
  assert.match(read('core/dimensions/antimatter-dimension.js'), /if \(production\.gt\(10\)\) \{/);
  const ui = read('components/ui-modes/HeaderPrestigeGroup.vue');
  const start = ui.indexOf('    locallyDilate(multiplier) {');
  const end = ui.indexOf('    classObject() {', start);
  assert.ok(start >= 0 && end > start);
  const method = ui.slice(start, end).trim().replace(/,\s*$/, '');
  const context = {
    Decimal: D,
    Currency: { endgames: { value: 0 } },
    Pelle: { isDoomed: false },
    EndgameMilestone: { endgameAntimatter: { isReached: false } },
    player: { disablePostReality: false },
    getAdjustedGlyphEffect: () => 1,
    EndgameMastery: () => ({}), EndgameUpgrade: () => ({}),
    SingularityMilestone: { antimatterExponentPower: {} }, Achievement: () => ({}),
    EtherealStars: { black: { reward: 1 } },
    boundedPositivePower: (base, exponent) => {
      const b = new D(base), e = new D(exponent);
      assert.ok(b.log > -Infinity, 'never call a positive power with zero base here');
      return D.fromLog(b.log * e.toNumber());
    }
  };
  const component = vm.runInNewContext(`({ ${method} })`, context);
  for (const n of [0, 1, 10]) {
    const input = new D(n);
    assert.equal(component.locallyDilate(input), input,
      `at ${n}, no logarithmic transformation should run`);
  }
  const high = component.locallyDilate(new D(100));
  assert.ok(Math.abs(high.toNumber() - 100) < 1e-10,
    'ordinary positive branch retains same formula');
});

test('the previously uncapped native refinement additions are absent', () => {
  const source = read('core/glyphs/glyph-purge-handler.js');
  assert.doesNotMatch(source, /resource\.amount \+= refinementGain/);
  assert.doesNotMatch(source, /otherResource\.amount \+=/);
  assert.match(source, /resource\.amount = this\.addRefinementToCap\(resource\.amount, refinementGain, maxResource\)/);
  assert.match(source, /otherResource\.amount = this\.addRefinementToCap\(otherResource\.amount, decoherenceGain, maxResource\)/);
});
