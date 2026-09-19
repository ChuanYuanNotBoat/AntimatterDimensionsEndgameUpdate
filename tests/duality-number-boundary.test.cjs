'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

class D {
  constructor(value) {
    this.n = value instanceof D ? value.n : value;
    this.sign = Math.sign(this.n);
    this.layer = Number.isFinite(this.n) ? 0 : Infinity;
    this.mag = Math.abs(this.n);
  }
  valueOf() { throw new Error('Implicit conversion from Decimal to number'); }
  toNumber() { return this.n; }
  lt(value) { return this.n < new D(value).n; }
  gt(value) { return this.n > new D(value).n; }
  gte(value) { return this.n >= new D(value).n; }
  static floor(value) { return new D(Math.floor(new D(value).n)); }
  static isFinite(value) { return [value.sign, value.layer, value.mag].every(Number.isFinite); }
}
const root = path.join(__dirname, '../src/core');
const source = fs.readFileSync(path.join(root, 'duality-upgrades.js'), 'utf8');
const helper = fs.readFileSync(path.join(root, 'hybrid-rebuyable-bulk.js'), 'utf8').replace(/^export /gm, '');
const start = source.indexOf('class RebuyableDualityUpgradeState extends RebuyableMechanicState {');
const end = source.indexOf('\nDualityUpgradeState.index = ', start);
assert.ok(start >= 0 && end > start);
const classCode = source.slice(start, end);

// Load the real shared function with the class under test: leaving the imported
// function out of a VM fixture is a ReferenceError, not a gameplay regression.
function setup(targetValue, priceValue = 50) {
  const player = { reality: { dualityRebuyables: { 1: 5 } } };
  const priceAt = count => typeof priceValue === 'function'
    ? priceValue(count) : count >= 100 ? 2000 : priceValue;
  const currency = {
    value: new D(1000),
    gte(price) { return this.value.gte(price); },
    purchase(price) {
      if (!D.isFinite(price) || !this.gte(price)) return false;
      this.value = new D(this.value.n - price.n);
      return true;
    }
  };
  const context = {
    Decimal: D, Number, Math, Error,
    Currency: { dualMachines: currency }, player,
    GameEnd: { creditsEverClosed: false },
    DC: { E309: new D(Infinity) },
    getInverseHybridCostScaling: () => new D(targetValue),
    getHybridCostScaling: count => new D(priceAt(count)),
    GameCache: { staticGlyphWeights: { invalidate() {} } },
    RebuyableMechanicState: class {
      constructor() { this.id = 1; this.config = { initialCost: 1, costMult: 10 }; }
      get isAffordable() { return currency.gte(new D(priceAt(this.boughtAmount))); }
      get canBeBought() { return !this.isCapped && this.isAffordable; }
    }
  };
  vm.runInNewContext(`${helper}\n${classCode}\nthis.Upg = RebuyableDualityUpgradeState;`, context);
  return { upg: new context.Upg(), currency, player };
}

test('ordinary bulk purchase retains count and charge', () => {
  const { upg, currency, player } = setup(10);
  assert.equal(upg.bulkPurchase(), true);
  assert.equal(player.reality.dualityRebuyables[1], 10);
  assert.equal(currency.value.n, 950);
});

test('invalid Decimal inverse cannot assign Infinity or charge currency', () => {
  const { upg, currency, player } = setup(Infinity);
  assert.throws(() => upg.bulkPurchase(), /Invalid hybrid rebuyable inverse/);
  assert.equal(player.reality.dualityRebuyables[1], 5);
  assert.equal(currency.value.n, 1000);
});

test('unsafe bulk inverse falls back to one verified affordable purchase', () => {
  const { upg, currency, player } = setup(Number.MAX_SAFE_INTEGER + 1);
  assert.equal(upg.bulkPurchase(), true);
  assert.equal(player.reality.dualityRebuyables[1], 6);
  assert.equal(currency.value.n, 950);
});

test('invalid or unaffordable costs never create free upgrades', () => {
  const infinite = setup(10, count => count >= 100 ? Infinity : 50);
  assert.throws(() => infinite.upg.bulkPurchase(), /Invalid hybrid rebuyable ceiling price/);
  assert.equal(infinite.player.reality.dualityRebuyables[1], 5);
  assert.equal(infinite.currency.value.n, 1000);
  const expensive = setup(10, 2000);
  assert.equal(expensive.upg.bulkPurchase(), false);
  assert.equal(expensive.player.reality.dualityRebuyables[1], 5);
  assert.equal(expensive.currency.value.n, 1000);
});
