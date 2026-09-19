const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const code = fs.readFileSync(path.join(__dirname, '../src/core/storage/storage.js'), 'utf8').replace(/\r\n/g, '\n');
const functionStart = code.indexOf('function isInspectSaveMode() {');
const functionEnd = code.indexOf('\n}', functionStart) + 2;
assert.ok(functionStart >= 0 && functionEnd > functionStart);
const functionSource = code.slice(functionStart, functionEnd);

function setup(query, dev = true) {
  const context = { DEV: dev, window: { location: { search: query } }, URLSearchParams };
  vm.runInNewContext(`${functionSource}; this.inspect = isInspectSaveMode;`, context);
  return context;
}

test('inspection flag is development-only and opt-in', () => {
  assert.equal(setup('?inspectSave=1').inspect(), true);
  assert.equal(setup('?inspectSave=0').inspect(), false);
  assert.equal(setup('').inspect(), false);
  assert.equal(setup('?inspectSave=1', false).inspect(), false);
});

test('inspection disables offline simulations before replay starts', () => {
  const line = code.match(/const simulateOffline = ([^;]+);/);
  assert.ok(line, 'offline simulation expression missing');
  for (const [query, expected] of [['?inspectSave=1', false], ['', true]]) {
    const env = setup(query);
    env.player = { options: { offlineProgress: true } };
    env.offlineEnabled = undefined;
    assert.equal(vm.runInNewContext(line[1].replace('this.offlineEnabled', 'offlineEnabled'), env), expected);
  }
});

test('inspection prevents both manual and automatic saves', () => {
  const canSave = code.match(/  canSave\(ignoreSimulation = false\) \{([\s\S]*?)\n  \},/);
  assert.ok(canSave);
  for (const [query, expected] of [['?inspectSave=1', false], ['', true]]) {
    const env = setup(query);
    env.GlyphSelection = { active: false };
    env.ui = { $viewModel: { modal: { progressBar: undefined } } };
    env.GameEnd = { endState: 0, removeAdditionalEnd: false };
    env.END_STATE_MARKERS = { SAVE_DISABLED: 10, INTERACTIVITY_DISABLED: 20 };
    const result = vm.runInNewContext(`({ canSave(ignoreSimulation=false) {${canSave[1]}\n} }).canSave()`, env);
    assert.equal(result, expected);
  }
});

test('post-load in inspection mode stops intervals and still refreshes UI', () => {
  const method = code.match(/  postLoadStuff\(\) \{([\s\S]*?)\n  \}\n\};/);
  assert.ok(method);
  for (const [query, expectedStop, expectedRestart] of [['?inspectSave=1', 1, 0], ['', 0, 1]]) {
    const env = setup(query);
    let stopped = 0, restarted = 0, updated = 0;
    env.GameIntervals = { stop: () => stopped++, restart: () => restarted++ };
    env.GameStorage = { ignoreBackupTimer: true };
    env.Enslaved = {};
    env.player = { options: { updateRate: 50 }, celestials: { enslaved: { storedReal: 0 } } };
    env.SecretAchievement = () => ({ unlock: () => assert.fail('unexpected achievement') });
    env.GameUI = { update: () => updated++ };
    env.AlchemyResources = { all: [] };
    vm.runInNewContext(`({ postLoadStuff() { ${method[1]}\n } }).postLoadStuff()`, env);
    assert.equal(stopped, expectedStop);
    assert.equal(restarted, expectedRestart);
    assert.equal(updated, 1);
  }
});

test('offline backup triggers are bypassed while inspecting', () => {
  assert.equal((code.match(/if \(!isInspectSaveMode\(\)\) this\.backupOfflineSlots\(\);/g) ?? []).length, 3);
});
