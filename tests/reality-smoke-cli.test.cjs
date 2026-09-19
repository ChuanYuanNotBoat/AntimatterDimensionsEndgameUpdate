'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');
const runner = path.join(__dirname, 'run-reality-smoke.cjs');
function execute(...args) {
  return spawnSync(process.execPath, [runner, ...args], { encoding: 'utf8', timeout: 5000 });
}

test('Reality browser runner explains its CLI without needing Playwright', () => {
  const result = execute('--help');
  assert.equal(result.status, 0);
  assert.match(result.stdout, /disposable browser context/);
});

test('Reality runner rejects a remote endpoint before reading a private save', () => {
  const result = execute('--url', 'https://example.com');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /localhost/);
});

test('Reality runner reports a missing fixture rather than using current localStorage', () => {
  const result = execute(path.join(__dirname, 'fixtures/no-such-save.txt'));
  assert.equal(result.status, 1);
  assert.match(result.stderr, /No test save/);
});
