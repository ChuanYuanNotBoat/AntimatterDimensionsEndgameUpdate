'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const source = fs.readFileSync(path.join(__dirname, '../src/core/machines.js'), 'utf8').replace(/\r\n/g, '\n');

test('Imaginary Machine hardcaps use bounded Decimal products and powers', () => {
  assert.match(source, /import \{ boundedPositivePower, boundedPositiveProduct \} from "\.\/finite-decimal";/);
  const baseHardcap = source.split('  get baseHardcapIM() {')[1].split('  get hardcapIM() {')[0];
  assert.match(baseHardcap, /const base = boundedPositiveProduct\(this\.baseIMHardcap, DualityUpgrade\(6\)\.effectOrDefault\(1\)\);/);
  assert.match(baseHardcap, /return boundedPositivePower\(base, exponent\);/);
  const hardcap = source.split('  get hardcapIM() {')[1].split('  get uncappedIM() {')[0];
  assert.match(hardcap, /return boundedPositivePower\(this\.baseHardcapIM, exponent\);/);
});

test('Dual Machine caps clamp only at the established Decimal representation boundary', () => {
  const baseCap = source.split('  get baseDMCap() {')[1].split('  get currentDMCap() {')[0];
  assert.match(baseCap, /return Decimal\.min\(cap, DC\.BEMAX\);/);
  assert.match(source, /return boundedPositiveProduct\(player\.reality\.jMCap, DualityUpgrade\(13\)\.effectOrDefault\(1\)\);/);
  assert.match(source, /return boundedPositiveProduct\(this\.baseDMCap, DualityUpgrade\(13\)\.effectOrDefault\(1\)\);/);
});
