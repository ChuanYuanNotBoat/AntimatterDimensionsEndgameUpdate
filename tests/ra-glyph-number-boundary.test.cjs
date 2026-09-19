'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const src = path.join(__dirname, '..', 'src');
const read = file => fs.readFileSync(path.join(src, file), 'utf8').replace(/\r\n/g, '\n');

// Reproduce a Decimal whose conversion rounds UP to Infinity at Number.MAX_VALUE.
class D {
  constructor(input) {
    this.n = input instanceof D ? input.n : input;
    this.sign = Math.sign(this.n);
    this.layer = Number.isFinite(this.n) ? 0 : Infinity;
    this.mag = Math.abs(this.n);
  }
  valueOf() { throw new Error('Implicit conversion from Decimal to number'); }
  gte(other) { return this.n >= new D(other).n; }
  lt(other) { return this.n < new D(other).n; }
  div(other) { return new D(this.n / new D(other).n); }
  times(other) { return new D(this.n * new D(other).n); }
  toNumber() { return this.n > Number.MAX_VALUE * 0.9 ? Infinity : this.n; }
}

function fixture() {
  const source = read('core/glyphs/glyph-purge-handler.js');
  const begin = source.indexOf('export const GlyphSacrificeHandler = {');
  assert.ok(begin >= 0);
  const context = {
    Decimal: D, Number, Math, Error,
    Pelle: { isDoomed: false },
    Ra: { alchemyResourceCap: Number.MAX_VALUE, unlocks: {
      unlockGlyphAlchemy: { canBeApplied: true },
      alchemyCapIncrease: { effectOrDefault: () => 1 },
    } },
    strengthToRarity: () => 100,
    AlchemyResource: { decoherence: { effectValue: 1 } },
    ALCHEMY_BASIC_GLYPH_TYPES: ['power', 'time'],
    GlyphTypes: { power: { alchemyResource: 0 }, time: { alchemyResource: 1 } },
    Glyphs: { removeFromInventory: () => {} },
  };
  vm.runInNewContext(source.slice(begin).replace('export const GlyphSacrificeHandler', 'const GlyphSacrificeHandler') +
    '\nglobalThis.handler = GlyphSacrificeHandler;', context);
  return { handler: context.handler, context };
}

test('Ra template compares Decimal memory multiplier explicitly', () => {
  const vue = read('components/tabs/celestial-ra/RaPet.vue');
  assert.match(vue, /Decimal\.gt\(this\.memoryMultiplier, 1\)/);
  assert.match(vue, /v-if="hasMemoryMultiplier && !isRaCapped"/);
  assert.doesNotMatch(vue, /memoryMultiplier\s*>\s*1/);
});

test('ordinary alchemy values convert without changing numeric results', () => {
  const { handler } = fixture();
  assert.equal(handler.finiteRefinementNumber(new D(120), 25000, 'test'), 120);
  assert.equal(handler.addRefinementToCap(100, 15, 25000), 115);
  assert.equal(handler.addRefinementToCap(24990, 15, 25000), 25000);
});

test('exact Number.MAX_VALUE never round-trips through Decimal.toNumber', () => {
  const { handler } = fixture();
  assert.equal(handler.finiteRefinementNumber(new D(Number.MAX_VALUE), Number.MAX_VALUE, 'test'),
    Number.MAX_VALUE);
});

test('near-boundary Decimal conversion uses a finite fractional fallback', () => {
  const { handler } = fixture();
  const near = Number.MAX_VALUE * 0.95;
  assert.equal(handler.finiteRefinementNumber(new D(near), Number.MAX_VALUE, 'test'), near);
});

test('finite sums saturate before addition; existing above-cap balance remains unchanged', () => {
  const { handler } = fixture();
  assert.equal(handler.addRefinementToCap(1e308, 1e308, Number.MAX_VALUE), Number.MAX_VALUE);
  assert.equal(handler.addRefinementToCap(5000, 0, 25000), 5000);
  assert.equal(handler.addRefinementToCap(5000, 10, 1000), 5000);
});

test('invalid values raise diagnostics rather than becoming free alchemy', () => {
  const { handler } = fixture();
  assert.throws(() => handler.finiteRefinementNumber(new D(NaN), 25000, 'test'), /Invalid alchemy Decimal/);
  assert.throws(() => handler.finiteRefinementNumber(new D(12), NaN, 'test'), /Invalid alchemy cap/);
  assert.throws(() => handler.addRefinementToCap(100, Infinity, 25000), /Invalid alchemy refinement/);
});

test('actual raw and highest-refinement methods remain Number-safe at the boundary', () => {
  const { handler } = fixture();
  handler.levelRefinementValue = () => new D(Number.MAX_VALUE);
  handler.glyphRefinementEfficiency = 1;
  const glyph = { strength: 1 };
  assert.equal(handler.glyphRawRefinementGain(glyph), Number.MAX_VALUE);
  assert.equal(handler.highestRefinementValue(glyph), Number.MAX_VALUE);
});

test('actual refineGlyph keeps main and decoherence resource writes finite', () => {
  const { handler, context } = fixture();
  const main = { isUnlocked: true, isBaseResource: false, amount: 1e308, cap: Number.MAX_VALUE };
  const other = { isUnlocked: true, amount: 1e308, cap: Number.MAX_VALUE };
  context.AlchemyResources = { all: [main, other] };
  handler.glyphAlchemyResource = () => main;
  handler.glyphRawRefinementGain = () => Number.MAX_VALUE;
  handler.glyphRefinementGain = () => Number.MAX_VALUE;
  handler.glyphEffectiveCap = () => Number.MAX_VALUE;
  handler.refineGlyph({ type: 'power' });
  assert.equal(main.amount, Number.MAX_VALUE);
  assert.equal(other.amount, Number.MAX_VALUE);
});
