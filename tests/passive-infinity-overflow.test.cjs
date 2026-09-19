// Exercise the real passivePrestigeGen() body with finite mock Decimal arithmetic.
// It must preserve normal gains while saturating otherwise unrepresentable products/sums.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../src/game.js'), 'utf8').replace(/\r\n/g, '\n');
const start = source.indexOf('function passivePrestigeGen(realDiff) {');
const end = source.indexOf('\nfunction applyAutoUnlockPerks()', start);
assert.ok(start >= 0 && end > start, 'passive generator body must exist');
const body = source.slice(start, end);
const MAX = 1000000;

class Decimal {
  constructor(value) { this.n = Number(value instanceof Decimal ? value.n : value); }
  valueOf() { return this.n; }
  plus(v) { return new Decimal(this.n + Number(v)); }
  add(v) { return this.plus(v); }
  minus(v) { return new Decimal(this.n - Number(v)); }
  sub(v) { return this.minus(v); }
  times(v) { return new Decimal(this.n * Number(v)); }
  div(v) { return new Decimal(this.n / Number(v)); }
  floor() { return new Decimal(Math.floor(this.n)); }
  toNumber() { return this.n; }
  gte(v) { return this.n >= Number(v); }
  powEffectOf() { return this; }
  static clampMin(low, value) { return new Decimal(Math.max(Number(low), Number(value))); }
  static times(a, b) { return new Decimal(Number(a) * Number(b)); }
  static pow(a, b) { return new Decimal(Number(a) ** Number(b)); }
}

function bounded(op, left, right) {
  const a = Number(left);
  const b = Number(right);
  if (Number.isNaN(a) || Number.isNaN(b)) throw new Error(`Invalid bounded ${op} operand`);
  return new Decimal(Math.min(MAX, op === 'sum' ? a + b : a * b));
}

function setup({ infinityGain = 11, eternities = 20, balance = 100, part = 0.25,
  realityMultiplier = 2, delta = 1, alpha = false } = {}) {
  let stored = new Decimal(balance);
  const infinities = {
    get value() { return stored; },
    set value(value) {
      assert.ok(Number.isFinite(value.n) && value.n <= MAX,
        `Infinity player setter received an overflowing or NaN value: ${value.n}`);
      stored = value;
    },
    add(amount) { this.value = this.value.plus(amount); }
  };
  const effect = value => ({ applyEffect: callback => callback(value) });
  const context = {
    Decimal, Math,
    DC: { D0: new Decimal(0), D1: new Decimal(1), E9E15: new Decimal(100000) },
    boundedPositiveSum: (a, b) => bounded('sum', a, b),
    boundedPositiveProduct: (a, b) => bounded('product', a, b),
    RealityUpgrade: id => ({ isBought: id !== 14, effectValue: new Decimal(id === 11 ? 7 : realityMultiplier),
      ...effect(id === 7 ? 3 : realityMultiplier) }),
    Achievement: () => effect(1),
    BreakInfinityUpgrade: { infinitiedGen: { isBought: true } },
    Pelle: { isDoomed: false },
    PelleDestructionUpgrade: { passiveInfGen: { canBeApplied: true } },
    PelleRealityUpgrade: { eternalFlow: { canBeApplied: true }, boundlessFlow: { canBeApplied: true } },
    PelleCelestialUpgrade: { effarigRewards: { canBeApplied: true } },
    EternityChallenge: () => ({ isRunning: false }),
    Alpha: { isRunning: alpha, isDestroyed: false },
    Time: { deltaTime: new Decimal(delta), deltaTimeMs: new Decimal(100),
      unscaledDeltaTime: { totalMilliseconds: new Decimal(100) } },
    Ra: { unlocks: { continuousTTBoost: { effects: { infinity: effect(4) } } } },
    getAdjustedGlyphEffect: () => new Decimal(5),
    EffarigUnlock: { eternity: { isUnlocked: true } },
    gainedInfinities: () => new Decimal(infinityGain),
    Currency: { infinities, eternities: { value: new Decimal(eternities),
      gte(amount) { return this.value.gte(amount); } } },
    player: { infinities: new Decimal(balance), partInfinitied: part,
      records: { bestInfinity: { time: new Decimal(50) } },
      disablePostReality: false, reality: { partEternitied: new Decimal(0) } },
    AlchemyResource: { eternity: { effectValue: 1 } }
  };
  vm.runInNewContext(`${body}\nthis.passivePrestigeGen = passivePrestigeGen;`, context);
  return { run: () => context.passivePrestigeGen(), context, infinities };
}

test('normal Infinity generation preserves gameplay gain and fractional remainder', () => {
  const { run, infinities, context } = setup();
  run();
  // base (0.5 * 100 / 50) * 2 * 3 * 4 * 5 = 120; RU11 = 7;
  // Effarig = 11 * 20 * 1 = 220, plus a 0.25 carry.
  assert.equal(infinities.value.n, 447);
  assert.equal(context.player.partInfinitied, 0.25);
});

test('late-game Effarig factor product saturates before Decimal layer overflow', () => {
  const { run, infinities, context } = setup({ infinityGain: MAX, eternities: MAX, delta: MAX });
  run();
  assert.equal(infinities.value.n, MAX);
  assert.equal(context.player.partInfinitied, 0);
});

test('finite gain plus balance saturates without overflowing the player setter', () => {
  const { run, infinities } = setup({ balance: MAX - 1 });
  run();
  assert.equal(infinities.value.n, MAX);
});

test('malformed upstream gain is diagnosed, not quietly converted into a cap', () => {
  const { run, infinities } = setup({ infinityGain: NaN });
  assert.throws(run, /Invalid bounded product operand/);
  assert.equal(infinities.value.n, 100);
});

test('Alpha time-source route uses the same bounded generation formula', () => {
  const { run, infinities } = setup({ alpha: true });
  run();
  assert.equal(infinities.value.n, 447);
});
