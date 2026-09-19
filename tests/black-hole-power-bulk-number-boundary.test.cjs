'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../src/core/black-hole.js'), 'utf8');
const begin = source.indexOf('class BlackHoleUpgradeState {');
const end = source.indexOf('\nclass BlackHoleState {', begin);
assert.ok(begin >= 0 && end > begin, 'Black Hole upgrade implementation exists');
const code = source.slice(begin, end);

class D {
  constructor(value) {
    this.n = value instanceof D ? value.n : value;
    this.sign = Math.sign(this.n);
    this.layer = Number.isFinite(this.n) ? 0 : Infinity;
    this.mag = Math.abs(this.n);
  }
  valueOf() { throw new Error('Decimal must not be implicitly converted to Number'); }
  toNumber() { return this.n; }
  gte(value) { return this.n >= new D(value).n; }
  gt(value) { return this.n > new D(value).n; }
  lt(value) { return this.n < new D(value).n; }
  static isFinite(value) {
    return [value.sign, value.layer, value.mag].every(Number.isFinite);
  }
}

function setup({ amount = 2, money = 1000, inverse = 6, doomed = false, id = 1, cost = n => n + 10 } = {}) {
  const writes = [];
  const purchases = [];
  const warnings = [];
  const events = [];
  const phases = [];
  let current = amount;
  let inverseCalls = 0;
  class Lazy {
    constructor(fn) { this.fn = fn; this.cached = undefined; }
    get value() {
      if (this.cached === undefined) this.cached = this.fn();
      return this.cached;
    }
    invalidate() { this.cached = undefined; }
  }
  function currency(start) {
    return {
      value: new D(start),
      gte(price) { return this.value.gte(price); },
      purchase(price) {
        assert.ok(D.isFinite(price), 'attempted to charge nonfinite cost');
        if (!this.gte(price)) return false;
        purchases.push({ cost: price.n, before: current });
        this.value = new D(this.value.n - price.n);
        return true;
      }
    };
  }
  const realityMachines = currency(money);
  const realityShards = currency(money);
  const blackHole = {
    isCharged: false, stateProgress: 0.25, interval: 20, phase: 5,
    isPermanent: false,
    updatePhase(delta) { phases.push(delta); }
  };
  const sandbox = {
    Decimal: D, Number, Math, Error, Lazy,
    Pelle: { isDoomed: doomed },
    Currency: { realityMachines, realityShards },
    DC: { E310: new D(1e310) },
    BlackHole: () => blackHole,
    EventHub: { dispatch(event) { events.push(event); } },
    GAME_EVENT: { BLACK_HOLE_UPGRADE_BOUGHT: 'bought' },
    console: { warn(...args) { warnings.push(args); } },
    getHybridCostScaling: count => new D(cost(count)),
    getInverseHybridCostScaling: () => {
      inverseCalls++;
      return inverse === 'invalid' ? new D(Infinity) : new D(inverse);
    },
  };
  vm.runInNewContext(`${code}\nglobalThis.Upgrade = BlackHoleUpgradeState;`, sandbox);
  const upgrade = new sandbox.Upgrade({
    id, hasAutobuyer: true, initialCost: 20, costMult: 2,
    getAmount: () => current,
    setAmount(next) {
      assert.ok(Number.isSafeInteger(next) && next >= 0, `unsafe save write: ${next}`);
      writes.push(next);
      current = next;
    },
    calculateValue: () => new D(4),
  });
  return { upgrade, realityMachines, realityShards, purchases, writes, warnings, events, phases,
    get amount() { return current; }, get inverseCalls() { return inverseCalls; } };
}

test('ordinary bulk buys inverse count and pays last purchase price, not old cached price', () => {
  const w = setup();
  assert.equal(w.upgrade.bulkPurchase(), true);
  assert.equal(w.amount, 6);
  assert.deepEqual(w.writes, [6]);
  assert.deepEqual(w.purchases, [{ cost: 15, before: 2 }]);
  assert.equal(w.realityMachines.value.n, 985);
  assert.deepEqual(w.events, ['bought']);
  assert.deepEqual(w.phases, [0]);
  assert.equal(w.upgrade.cost.n, 16, 'cost cache invalidated');
});

test('huge balance clamps count at safe integer ceiling before calling inverse or toNumber', () => {
  const w = setup({ money: 1e30, inverse: 'invalid' });
  assert.equal(w.upgrade.bulkPurchase(), true);
  assert.equal(w.amount, Number.MAX_SAFE_INTEGER);
  assert.equal(w.inverseCalls, 0, 'large inverse must never be calculated');
  assert.equal(w.purchases[0].cost, Number.MAX_SAFE_INTEGER - 1 + 10);
  assert.equal(w.purchases[0].before, 2);
  assert.equal(w.upgrade.bulkPurchase(), false, 'ceiling cannot be crossed');
  assert.equal(w.purchases.length, 1);
});

test('a count one below ceiling buys precisely one and then stops', () => {
  const w = setup({ amount: Number.MAX_SAFE_INTEGER - 1, money: 1e30 });
  assert.equal(w.upgrade.bulkPurchase(), true);
  assert.equal(w.amount, Number.MAX_SAFE_INTEGER);
  assert.equal(w.upgrade.bulkPurchase(), false);
  assert.equal(w.purchases.length, 1);
});

test('invalid bulk inverse raises a diagnostic without changing currency or count', () => {
  const w = setup({ inverse: 'invalid' });
  assert.throws(() => w.upgrade.bulkPurchase(), /Invalid Black Hole bulk inverse/);
  assert.equal(w.amount, 2);
  assert.equal(w.realityMachines.value.n, 1000);
  assert.equal(w.purchases.length, 0);
});

test('inverse beyond storage while balance is below ceiling price falls back to one paid purchase', () => {
  const w = setup({ inverse: 1e30 });
  assert.equal(w.upgrade.bulkPurchase(), true);
  assert.equal(w.amount, 3);
  assert.deepEqual(w.purchases, [{ cost: 12, before: 2 }]);
});

test('inverse cannot silently write a fractional purchase count', () => {
  const w = setup({ inverse: 4.5 });
  assert.equal(w.upgrade.bulkPurchase(), true);
  assert.equal(w.amount, 3);
  assert.equal(w.purchases[0].cost, 12);
});

test('overestimated inverse never gets an unaffordable bulk purchase', () => {
  const w = setup({ inverse: 1000, money: 100 });
  assert.equal(w.upgrade.bulkPurchase(), true);
  assert.equal(w.amount, 3);
  assert.equal(w.purchases[0].cost, 12);
});

test('unaffordable next upgrade does not change save, deduct currency or dispatch purchase', () => {
  const w = setup({ money: 11 });
  assert.equal(w.upgrade.bulkPurchase(), false);
  assert.equal(w.amount, 2);
  assert.equal(w.purchases.length, 0);
  assert.equal(w.events.length, 0);
});

test('preexisting unsafe native count is never silently rewritten or reduced', () => {
  const w = setup({ amount: Number.MAX_VALUE, money: 1e30 });
  assert.equal(w.upgrade.bulkPurchase(), false);
  assert.equal(w.amount, Number.MAX_VALUE);
  assert.equal(w.writes.length, 0);
  assert.equal(w.purchases.length, 0);
  assert.equal(w.warnings.length, 1);
  assert.equal(w.upgrade.bulkPurchase(), false);
  assert.equal(w.warnings.length, 1);
});

test('manual upgrade does not deduct at the integer boundary, ordinary purchase still works', () => {
  const atCap = setup({ amount: Number.MAX_SAFE_INTEGER, money: 1e30 });
  assert.equal(atCap.upgrade.purchase(), false);
  assert.equal(atCap.purchases.length, 0);
  const ordinary = setup();
  assert.equal(ordinary.upgrade.purchase(), true);
  assert.equal(ordinary.amount, 3);
  assert.equal(ordinary.purchases[0].cost, 12);
});

test('doomed currency path charges Reality Shards instead of Reality Machines', () => {
  const w = setup({ doomed: true, money: 1000 });
  assert.equal(w.upgrade.bulkPurchase(), true);
  assert.equal(w.realityShards.value.n, 985);
  assert.equal(w.realityMachines.value.n, 1000);
});

test('malformed monetary input throws before mutating anything', () => {
  const w = setup({ money: NaN });
  assert.throws(() => w.upgrade.bulkPurchase(), /Invalid Black Hole purchase currency/);
  assert.equal(w.purchases.length, 0);
  assert.equal(w.writes.length, 0);
});
