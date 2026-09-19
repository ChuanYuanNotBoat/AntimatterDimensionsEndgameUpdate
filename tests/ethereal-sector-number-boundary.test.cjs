'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

// Keep enormous but valid powers in logarithmic form, as the actual Decimal
// does. Converting such a power to Number must never be part of sector advance.
class D {
  constructor(input) {
    if (input instanceof D) this.log = input.log;
    else if (typeof input !== 'number' || Number.isNaN(input) || input < 0) this.log = NaN;
    else this.log = input === 0 ? -Infinity : Math.log(input);
  }
  static fromLog(log) { const d = Object.create(D.prototype); d.log = log; return d; }
  get sign() { return Number.isNaN(this.log) ? NaN : this.log === -Infinity ? 0 : 1; }
  get layer() { return Number.isNaN(this.log) ? NaN : this.log > Math.log(Number.MAX_VALUE) ? 1 : 0; }
  get mag() { return Number.isNaN(this.log) ? NaN : this.sign === 0 ? 0 : this.layer ? this.log : this.toNumber(); }
  valueOf() { throw new Error('Implicit conversion from Decimal to number'); }
  toNumber() { return Math.exp(this.log); }
  eq(x) { return this.log === new D(x).log; }
  lt(x) { return this.log < new D(x).log; }
  gte(x) { return this.log >= new D(x).log; }
  add(x) { return new D(this.toNumber() + new D(x).toNumber()); }
  div(x) { return D.fromLog(this.log - new D(x).log); }
  ln() { return new D(this.log); }
  static floor(x) { return new D(Math.floor(new D(x).toNumber())); }
  static pow(base, exponent) {
    const b = new D(base);
    return D.fromLog(b.log * new D(exponent).toNumber());
  }
  static lambertw(x) {
    const v = new D(x).toNumber();
    if (!(v > 0 && Number.isFinite(v))) throw new Error('unexpected Lambert W input');
    let w = Math.log1p(v);
    for (let i = 0; i < 24; i++) {
      const ew = Math.exp(w);
      const next = w - (w * ew - v) / (ew * (w + 1));
      if (Math.abs(next - w) <= 1e-15 * Math.max(1, w)) { w = next; break; }
      w = next;
    }
    return new D(w);
  }
}

const source = fs.readFileSync(path.join(__dirname, '../src/core/ethereal.js'), 'utf8');
const start = source.indexOf('export function tryAdvanceSector() {');
const end = source.indexOf('export function resetForStar(', start);
assert.ok(start > 0 && end > start, 'actual sector advancement function located');
const code = source.slice(start, end).replace('export function', 'function');

function setup({ sector = 1, power = 1, surge = true } = {}) {
  let current = sector;
  const saves = [];
  let lambertCalls = 0;
  const player = { endgame: { ethereal: {
    get sector() { return current; },
    set sector(value) {
      assert.equal(typeof value, 'number');
      assert.ok(Number.isSafeInteger(value), 'no unsafe integer or Infinity reaches save setter');
      saves.push(value);
      current = value;
    }
  } } };
  const value = power instanceof D ? power : new D(power);
  const Decimal = class extends D {};
  Decimal.pow = D.pow;
  Decimal.floor = D.floor;
  Decimal.lambertw = x => { lambertCalls++; return D.lambertw(x); };
  const currency = {
    value,
    lt: threshold => value.lt(threshold)
  };
  const sandbox = {
    Decimal, Number, Error, Math, player,
    Currency: { etherealPower: currency },
    Ethereal: { get sectorThreshold() { return D.pow(current, current); } },
    DivinityMilestone: { ascendedSurge: { isReached: surge } }
  };
  vm.runInNewContext(code + '\nglobalThis.advance = tryAdvanceSector;', sandbox);
  return {
    advance: sandbox.advance,
    get current() { return current; },
    get saves() { return saves; },
    get lambertCalls() { return lambertCalls; }
  };
}

test('ordinary Sector advances once at the same threshold without ascended surge', () => {
  const below = setup({ sector: 2, power: 3, surge: false });
  below.advance();
  assert.equal(below.current, 2);
  const normal = setup({ sector: 2, power: 4, surge: false });
  normal.advance();
  assert.equal(normal.current, 3);
  assert.equal(normal.lambertCalls, 0);
});

test('zero-log power=1 uses the correct mathematical limit without calling Lambert W', () => {
  const world = setup({ sector: 1, power: 1 });
  world.advance();
  assert.equal(world.current, 2);
  assert.equal(world.lambertCalls, 0);
  world.advance();
  assert.equal(world.current, 2, 'Sector 2 needs 2^2 power');
});

test('Ascended surge bulk-advances exactly across ordinary thresholds', () => {
  for (const [power, expected] of [[2, 2], [4, 3], [26, 3], [27, 4], [255, 4], [256, 5], [10000, 6]]) {
    const world = setup({ sector: 1, power });
    world.advance();
    assert.equal(world.current, expected, `power ${power}`);
  }
});

test('astronomically large finite power caps before Lambert W or any unsafe toNumber', () => {
  const world = setup({ sector: 4, power: D.fromLog(1e20) });
  world.advance();
  assert.equal(world.current, Number.MAX_SAFE_INTEGER);
  assert.equal(world.lambertCalls, 0);
  assert.deepEqual(world.saves, [Number.MAX_SAFE_INTEGER]);
  world.advance();
  assert.equal(world.saves.length, 1, 'no repeated saturated writes each game tick');
});

test('already large legacy sector is never lowered or incremented imprecisely', () => {
  const world = setup({ sector: Number.MAX_SAFE_INTEGER + 1, power: D.fromLog(1e20) });
  world.advance();
  assert.equal(world.current, Number.MAX_SAFE_INTEGER + 1);
  assert.equal(world.saves.length, 0);
});

test('invalid saved sector and invalid upstream power remain errors before a write', () => {
  const invalid = setup({ sector: NaN });
  assert.throws(() => invalid.advance(), /Invalid saved Ethereal sector/);
  assert.equal(invalid.saves.length, 0);
  const badPower = setup({ sector: 1, power: new D(NaN) });
  assert.throws(() => badPower.advance(), /Invalid Ethereal Power/);
  assert.equal(badPower.saves.length, 0);
});


test('zero Ethereal Power does not advance and never enters inverse calculation', () => {
  const world = setup({ sector: 1, power: 0 });
  world.advance();
  assert.equal(world.current, 1);
  assert.equal(world.saves.length, 0);
  assert.equal(world.lambertCalls, 0);
});

test('normal one-by-one advancement stops at the last exactly representable sector', () => {
  const sector = Number.MAX_SAFE_INTEGER - 1;
  const world = setup({ sector, power: D.fromLog(1e20), surge: false });
  world.advance();
  assert.equal(world.current, Number.MAX_SAFE_INTEGER);
  world.advance();
  assert.equal(world.saves.length, 1);
});

test('fractional, infinite, and negative saved sectors are diagnosed before mutation', () => {
  for (const sector of [1.5, Infinity, -2]) {
    const world = setup({ sector });
    assert.throws(() => world.advance(), /Invalid saved Ethereal sector/);
    assert.equal(world.saves.length, 0);
  }
});
