'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.join(__dirname, '../src/core');
const helper = fs.readFileSync(path.join(root, 'hybrid-rebuyable-bulk.js'), 'utf8')
  .replace(/^export /gm, '');
const cases = [
  ['Reality', 'reality-upgrades.js', 'RebuyableRealityUpgradeState', 'realityMachines', 'rebuyables', 1e30],
  ['Imaginary', 'imaginary-upgrades.js', 'RebuyableImaginaryUpgradeState', 'imaginaryMachines', 'imaginaryRebuyables', 1e15],
  ['Endgame', 'endgame-upgrades.js', 'RebuyableEndgameUpgradeState', 'celestialPoints', 'rebuyables', 1e100],
  ['Duality', 'duality-upgrades.js', 'RebuyableDualityUpgradeState', 'dualMachines', 'dualityRebuyables', 1e20]
];

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
  static isFinite(value) { return [value.sign, value.layer, value.mag].every(Number.isFinite); }
  static floor(value) { return new D(Math.floor(new D(value).n)); }
}

function setup(spec, { count = 2, money = 1000, inverse = 6,
  cost = n => n + 10, purchaseAllowed = true, credits = false, available = true } = {}) {
  const [label, file, className, currencyKey, storeKey, expectedThreshold] = spec;
  const source = fs.readFileSync(path.join(root, file), 'utf8').replace(/\r\n/g, '\n');
  const begin = source.indexOf(`class ${className} extends RebuyableMechanicState {`);
  const end = source.indexOf('\n}\n', begin);
  assert.ok(begin >= 0 && end > begin, `${label} class not found`);
  const classCode = source.slice(begin, end + 2);
  const writes = [], payments = [], costCalls = [];
  let inverseCalls = 0;
  const player = {
    reality: { rebuyables: { 1: count }, imaginaryRebuyables: { 1: count }, dualityRebuyables: { 1: count } },
    endgame: { rebuyables: { 1: count } }
  };
  const currency = {
    value: new D(money),
    gte(price) { return this.value.gte(price); },
    purchase(price) {
      assert.ok(D.isFinite(price), 'must never charge invalid price');
      payments.push(price.n);
      if (!purchaseAllowed || !this.gte(price)) return false;
      this.value = new D(this.value.n - price.n);
      return true;
    }
  };
  const currencies = Object.fromEntries(['realityMachines', 'imaginaryMachines', 'celestialPoints', 'dualMachines']
    .map(key => [key, currency]));
  const sandbox = {
    Decimal: D, Number, Math, Error, console, player,
    Currency: currencies, GameEnd: { creditsEverClosed: credits },
    DC: { E309: new D(1e309) },
    GameCache: { staticGlyphWeights: { invalidate() {} } },
    getHybridCostScaling(amount, ...args) {
      costCalls.push([amount, args]);
      return new D(cost(amount));
    },
    getInverseHybridCostScaling(_money, ...args) {
      inverseCalls++;
      assert.equal(args[0], expectedThreshold);
      return inverse === 'invalid' ? new D(Infinity) : new D(inverse);
    },
    RebuyableMechanicState: class {
      constructor(config) { this.config = config; this.id = 1; }
      get isAffordable() { return currency.gte(new D(cost(this.boughtAmount))); }
      get canBeBought() { return available && !this.isCapped && this.isAffordable; }
      purchase() {
        if (!this.canBeBought) return false;
        this.boughtAmount++;
        return true;
      }
    }
  };
  vm.runInNewContext(`${helper}\n${classCode}\nthis.Upgrade = ${className};`, sandbox);
  const upg = new sandbox.Upgrade({ initialCost: 1, costMult: 30 });
  const owner = label === 'Endgame' ? player.endgame : player.reality;
  const descriptor = Object.getOwnPropertyDescriptor(owner[storeKey], '1');
  Object.defineProperty(owner[storeKey], '1', {
    configurable: true,
    get() { return count; },
    set(value) {
      assert.ok(Number.isSafeInteger(value) && value >= 0, 'unsafe save count');
      writes.push(value);
      count = value;
    }
  });
  assert.equal(descriptor.value, count);
  return { upg, currency, writes, payments, costCalls,
    get count() { return count; }, get inverseCalls() { return inverseCalls; } };
}

for (const spec of cases) {
  const name = spec[0];
  test(`${name}: ordinary bulk preserves last-upgrade-only cost and number save`, () => {
    const w = setup(spec);
    assert.equal(w.upg.bulkPurchase(), true);
    assert.equal(w.count, 6);
    assert.deepEqual(w.writes, [6]);
    assert.deepEqual(w.payments, [15]);
    assert.equal(w.currency.value.n, 985);
  });
  test(`${name}: huge currency bypasses unsafe inverse and caps safely`, () => {
    const w = setup(spec, { money: 1e30, inverse: 'invalid' });
    assert.equal(w.upg.bulkPurchase(), true);
    assert.equal(w.count, Number.MAX_SAFE_INTEGER);
    assert.equal(w.inverseCalls, 0);
    assert.deepEqual(w.payments, [Number.MAX_SAFE_INTEGER - 1 + 10]);
    assert.equal(w.upg.bulkPurchase(), false);
  });
  test(`${name}: inverse overestimate must pay affordable single purchase`, () => {
    const w = setup(spec, { money: 100, inverse: 500 });
    assert.equal(w.upg.bulkPurchase(), true);
    assert.equal(w.count, 3);
    assert.deepEqual(w.payments, [12]);
  });
  test(`${name}: invalid inverse is diagnosed before payment or write`, () => {
    const w = setup(spec, { inverse: 'invalid' });
    assert.throws(() => w.upg.bulkPurchase(), /Invalid hybrid rebuyable inverse/);
    assert.deepEqual(w.payments, []);
    assert.deepEqual(w.writes, []);
  });
  test(`${name}: invalid current count and no available upgrade do not mutate`, () => {
    const bad = setup(spec, { count: Number.MAX_SAFE_INTEGER + 1 });
    assert.equal(bad.upg.bulkPurchase(), false);
    assert.deepEqual(bad.payments, []);
    const unavailable = setup(spec, { available: false });
    assert.equal(unavailable.upg.bulkPurchase(), false);
  });
  test(`${name}: purchase refusal and credits exit never modify save`, () => {
    const denied = setup(spec, { purchaseAllowed: false });
    assert.equal(denied.upg.bulkPurchase(), false);
    assert.deepEqual(denied.writes, []);
    const credits = setup(spec, { credits: true });
    assert.equal(credits.upg.bulkPurchase(), false);
    assert.deepEqual(credits.payments, []);
  });
  test(`${name}: fractional or stale inverse never creates a fractional count`, () => {
    const fractional = setup(spec, { inverse: 5.9 });
    assert.equal(fractional.upg.bulkPurchase(), true);
    assert.equal(fractional.count, 5);
    const stale = setup(spec, { inverse: 1 });
    assert.equal(stale.upg.bulkPurchase(), true);
    assert.equal(stale.count, 3);
  });
  test(`${name}: invalid currency is diagnosed`, () => {
    const w = setup(spec, { money: Infinity });
    assert.throws(() => w.upg.bulkPurchase(), /Invalid hybrid rebuyable currency/);
    assert.deepEqual(w.writes, []);
  });
}

for (const spec of cases) {
  test(`${spec[0]}: manual single purchase stops at the safe count without corrupting the save`, () => {
    const w = setup(spec, { count: Number.MAX_SAFE_INTEGER - 1, money: 1e30 });
    assert.equal(w.upg.isCapped, false);
    assert.equal(w.upg.purchase(), true);
    assert.equal(w.count, Number.MAX_SAFE_INTEGER);
    assert.equal(w.upg.isCapped, true);
    assert.equal(w.upg.purchase(), false);
    assert.deepEqual(w.writes, [Number.MAX_SAFE_INTEGER]);
  });
}
