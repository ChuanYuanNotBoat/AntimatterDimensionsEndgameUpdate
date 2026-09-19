'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const CAP = 1e6;
const source = fs.readFileSync(path.join(__dirname,
  '../src/core/celestials/laitela/dark-matter-dimension.js'), 'utf8').replace(/\r\n/g, '\n');
const helperStart = source.indexOf('function addDarkEnergy(amount) {');
const objectStart = source.indexOf('export const DarkMatterDimensions = {');
assert.ok(helperStart >= 0 && objectStart > helperStart, 'Dark Energy accumulation helpers must precede the tick');

function matchingBraceEnd(text, start) {
  const open = text.indexOf('{', start);
  let depth = 0;
  for (let index = open; index < text.length; index++) {
    if (text[index] === '{') depth++;
    if (text[index] === '}') {
      depth--;
      if (depth === 0) return index + 1;
    }
  }
  throw new Error('Unclosed DarkMatterDimensions object');
}

const objectEnd = matchingBraceEnd(source, objectStart);
const tickSource = source.slice(helperStart, objectEnd)
  .replace('export const DarkMatterDimensions', 'const DarkMatterDimensions');

class D {
  constructor(value) { this.n = value instanceof D ? value.n : Number(value); }
  valueOf() { throw new Error('Implicit conversion from Decimal to number'); }
  plus(value) { return new D(this.n + new D(value).n); }
  times(value) { return new D(this.n * new D(value).n); }
  mul(value) { return this.times(value); }
  div(value) { return new D(this.n / new D(value).n); }
  lt(value) { return this.n < new D(value).n; }
  toNumber() { return this.n; }
  static floor(value) { return new D(Math.floor(new D(value).n)); }
}

function boundedProduct(left, right) {
  const value = new D(left).n * new D(right).n;
  if (Number.isNaN(value)) throw new Error('Invalid DMD product operand');
  return new D(Math.min(value, CAP));
}

function boundedSum(left, right) {
  const value = new D(left).n + new D(right).n;
  if (Number.isNaN(value)) throw new Error('Invalid DMD sum operand');
  return new D(Math.min(value, CAP));
}

function checkedCurrency(initial) {
  let value = new D(initial);
  return {
    get value() { return value; },
    set value(next) {
      assert.ok(next instanceof D, 'currency writes must retain Decimal values');
      assert.ok(Number.isFinite(next.n) && next.n <= CAP, 'nonfinite Dark Energy reached its player setter');
      value = next;
    },
    add() { assert.fail('unsafe DecimalCurrency.add must not be used for Dark Energy ticks'); }
  };
}

function world({ booster = false, powerDE = 2, current = 10 } = {}) {
  const darkEnergy = checkedCurrency(current);
  const unnerfedDarkMatter = checkedCurrency(0);
  const dimensions = Array.from({ length: 9 }, (_, tier) => ({
    isUnlocked: tier === 1 && !booster,
    timeSinceLastUpdate: 0,
    interval: new D(100),
    amount: new D(0),
    powerDM: new D(0),
    powerDE: new D(powerDE)
  }));
  const dimensionAccessor = tier => dimensions[tier];
  dimensionAccessor.index = { compact: () => [] };
  const context = {
    Decimal: D,
    DC: { D1: new D(1) },
    Currency: { darkEnergy, unnerfedDarkMatter },
    DarkMatterDimension: dimensionAccessor,
    Laitela: { isUnlocked: true, annihilationUnlocked: false },
    SingularityMilestone: {
      dmdMultBooster: { isUnlocked: booster },
      dim4Generation: { canBeApplied: false }
    },
    boundedPositiveProduct: boundedProduct,
    boundedPositiveSum: boundedSum,
    Math, Number,
  };
  vm.runInNewContext(`${tickSource}\nglobalThis.dimensions = DarkMatterDimensions;`, context);
  return { darkEnergy, dimensions: context.dimensions };
}

test('ordinary Dark Energy ticks preserve the original amount', () => {
  const game = world({ powerDE: 2, current: 10 });
  game.dimensions.tick(1000);
  assert.equal(game.darkEnergy.value.n, 30);
});

test('an overflowing per-dimension Dark Energy tick is bounded before the player setter', () => {
  const game = world({ powerDE: CAP, current: CAP - 1 });
  game.dimensions.tick(1000);
  assert.equal(game.darkEnergy.value.n, CAP);
});

test('the total Dark Energy multiplier path also keeps its product finite', () => {
  const game = world({ booster: true, powerDE: CAP, current: CAP - 1 });
  game.dimensions.tick(1000);
  assert.equal(game.darkEnergy.value.n, CAP);
});

test('a genuine invalid Dark Energy source remains a diagnostic error', () => {
  const game = world({ powerDE: NaN, current: 10 });
  assert.throws(() => game.dimensions.tick(1000), /Invalid DMD product operand/);
  assert.equal(game.darkEnergy.value.n, 10);
});

test('Dark Energy never reaches DecimalCurrency.add after tick arithmetic', () => {
  assert.match(source, /Currency\.darkEnergy\.value = boundedPositiveSum\(Currency\.darkEnergy\.value, amount\);/);
  assert.match(source, /addDarkEnergy\(boundedPositiveProduct\(ticks, dim\.powerDE\)\);/);
  assert.match(source, /total = boundedPositiveProduct\(total, DarkMatterDimension\(de\)\.powerDE\);/);
  assert.doesNotMatch(source, /Currency\.darkEnergy\.add\(/);
});
