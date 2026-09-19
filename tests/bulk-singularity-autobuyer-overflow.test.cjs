'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const CAP = 1e6;
const source = fs.readFileSync(path.join(__dirname,
  '../src/core/autobuyers/bulk-singularity-autobuyer.js'), 'utf8').replace(/\r\n/g, '\n');

class D {
  constructor(value) { this.n = value instanceof D ? value.n : Number(value); }
  valueOf() { throw new Error('Implicit conversion from Decimal to number'); }
  add(value) { return new D(this.n + new D(value).n); }
  sub(value) { return new D(this.n - new D(value).n); }
  div(value) { return new D(this.n / new D(value).n); }
  recip() { return new D(1 / this.n); }
  eq(value) { return this.n === new D(value).n; }
  gt(value) { return this.n > new D(value).n; }
  lt(value) { return this.n < new D(value).n; }
  lte(value) { return this.n <= new D(value).n; }
  static floor(value) { return new D(Math.floor(new D(value).n)); }
  static log10(value) { return new D(Math.log10(new D(value).n)); }
  static max(left, right) { return new D(Math.max(new D(left).n, new D(right).n)); }
  static isFinite(value) { return Number.isFinite(new D(value).n); }
}

function boundedPositiveSum(left, right) {
  const value = new D(left).n + new D(right).n;
  if (Number.isNaN(value)) throw new Error('Invalid Singularity cap increase');
  return new D(Math.min(value, CAP));
}

function world({ time = 0.01, current = 10 } = {}) {
  let capIncreases = new D(current);
  const laitela = { singularities: new D(100) };
  Object.defineProperty(laitela, 'singularityCapIncreases', {
    get: () => capIncreases,
    set: value => {
      const next = new D(value);
      assert.ok(Number.isFinite(next.n) && next.n <= CAP, 'nonfinite cap increase reached player storage');
      capIncreases = next;
    }
  });
  const context = {
    AutobuyerState: class {},
    Decimal: D,
    DC: { E1: new D(10), BEMAX: new D(CAP) },
    boundedPositiveSum,
    player: {
      auto: { bulkSingularity: { lowerBound: 0.1, upperBound: 10, hasLowerBound: true, hasUpperBound: false } },
      celestials: { laitela }
    },
    Singularity: { timePerCondense: new D(time) },
    Math, Number,
  };
  const code = source.replace(/^import .*;\n/gm, '').replace('export class', 'class');
  vm.runInNewContext(`${code}\nglobalThis.Buyer = BulkSingularityAutobuyerState;`, context);
  return { buyer: new context.Buyer(), get capIncreases() { return capIncreases; } };
}

test('ordinary lower-bound bulk adjustment retains the original count', () => {
  const game = world({ time: 0.01, current: 10 });
  game.buyer.tick();
  assert.equal(game.capIncreases.n, 12);
});

test('underflowed condense time never writes an infinite cap-increase count', () => {
  const game = world({ time: 0, current: CAP - 1 });
  game.buyer.tick();
  assert.equal(game.capIncreases.n, CAP);
});

test('bulk singularity calculation keeps the original finite ratio path and bounds only its storage result', () => {
  assert.match(source, /const ratio = time\.div\(this\.lowerBound\)\.recip\(\);/);
  assert.match(source, /time\.eq\(0\) \? DC\.BEMAX/);
  assert.match(source, /Decimal\.isFinite\(ratio\)/);
  assert.match(source, /boundedPositiveSum\(\s*player\.celestials\.laitela\.singularityCapIncreases, bulk\);/);
  assert.doesNotMatch(source, /singularityCapIncreases = player\.celestials\.laitela\.singularityCapIncreases\.add\(bulk\)/);
});
