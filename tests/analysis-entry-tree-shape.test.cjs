// Regression for IP/EP analysis sub-panels: the formula tree stores arrays of keys,
// while getResourceEntryInfoGroups() wraps them in objects containing .entries.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8').replace(/\r\n/g, '\n');

function readEntryDeclarations(resource) {
  const source = read(`src/core/secret-formula/multiplier-tab/${resource === 'IP' ? 'infinity' : 'eternity'}-points.js`);
  const entries = {};
  // A declaration is indented two spaces, whereas properties are indented four.
  for (const [, name, body] of source.matchAll(/^  (\w+): \{([\s\S]*?)(?=^  \w+: \{|^\};)/gm)) {
    entries[name] = {
      ...( /\btransformValue\s*:/.test(body) ? { transformValue: () => null } : {} ),
      ...( /\bisOrdered\s*:\s*true/.test(body) ? { isOrdered: true } : {} )
    };
  }
  assert.ok(entries.total?.isOrdered, `${resource} root must declare ordered display`);
  assert.ok(entries.base?.transformValue, `${resource} base must declare an ordered transform`);
  return entries;
}

function setup() {
  const values = {
    IP: readEntryDeclarations('IP'),
    EP: readEntryDeclarations('EP'),
    general: { achievement: {}, timeStudy: {} },
    AD: {}, ID: {}, TD: {},
    TP: { total: {} }, DT: { total: {} }, infinities: { total: {} },
    eternities: { total: {} }, gamespeed: { total: {} }, replicanti: { total: {} }
  };
  const context = vm.createContext({
    multiplierTabValues: values,
    MultiplierTabHelper: {
      achievementDimCheck: () => true,
      timeStudyDimCheck: () => true,
      ICDimCheck: () => true,
      ECDimCheck: () => true
    },
    AD_ORDERED_KEYS: ['purchase'], AD_ORDERED_GROUPS: [['purchase', 'Purchase', []]],
    Vue: { observable: object => object },
    Decimal: class { constructor(value) { this.value = value; } }
  });
  vm.runInContext(read('src/core/secret-formula/multiplier-tab/tree.js')
    .replace(/^import .*\n/gm, '').replace(/^export /gm, '') + '\nglobalThis.tree = multiplierTabTree;', context);
  context.GameDatabase = { multiplierTabTree: context.tree, multiplierTabValues: values };
  vm.runInContext(read('src/components/tabs/statistics/breakdown-entry-info.js')
    .replace(/^import .*\n/gm, '').replace(/^export /gm, '') +
    '\nglobalThis.entryInfo = { createEntryInfo, BreakdownEntryInfo };', context);
  return { tree: context.tree, createEntryInfo: context.entryInfo.createEntryInfo };
}

test('real IP/EP tree uses arrays of child keys, not .entries wrapper objects', () => {
  const { tree } = setup();
  for (const key of ['IP_total', 'EP_total', 'IP_base', 'EP_base', 'IP_achievement', 'EP_timeStudy']) {
    assert.ok(Array.isArray(tree[key]), `${key} must exist`);
    assert.ok(tree[key].every(group => Array.isArray(group) && group.every(child => typeof child === 'string')),
      `${key} must store key arrays`);
  }
});

test('IP/EP root keeps ordered calculation, including full original tree', () => {
  const { createEntryInfo } = setup();
  assert.equal(createEntryInfo('IP_total').isOrdered, true);
  assert.equal(createEntryInfo('EP_total').isOrdered, true);
});

test('IP/EP base breakdowns with legacy display-only children retain percent view', () => {
  const { createEntryInfo } = setup();
  for (const key of ['IP_base', 'EP_base', 'IP_achievement', 'IP_timeStudy', 'EP_timeStudy']) {
    assert.equal(createEntryInfo(key).isOrdered, false, key);
  }
});

test('transform entries without children fall back to ordered formula', () => {
  const { createEntryInfo, tree } = setup();
  assert.equal(tree.IP_divisor, undefined);
  assert.equal(createEntryInfo('IP_divisor').isOrdered, true);
});

test('explicit isOrdered=false takes precedence over transform fallback', () => {
  const { createEntryInfo } = setup();
  // Declaration is static and the cache has not yet created this entry.
  const resource = createEntryInfo('IP_divisor');
  resource._isOrdered = () => false;
  assert.equal(resource.isOrdered, false);
});
