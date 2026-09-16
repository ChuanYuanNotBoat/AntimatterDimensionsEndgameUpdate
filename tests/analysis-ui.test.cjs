// Self-contained regression tests for the multiplier analysis UI, requiring only Node.js.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const statistics = path.join(root, 'src/components/tabs/statistics');
const navigationCode = fs.readFileSync(path.join(statistics, 'multiplier-tab-navigation.js'), 'utf8')
  .replace(/^export /gm, '');
const navContext = { module: { exports: {} } };
vm.runInNewContext(`${navigationCode}\nmodule.exports = { MULTIPLIER_TAB_GROUPS, availableMultiplierTabGroups, resolveMultiplierTab };`,
  navContext);
const navigation = navContext.module.exports;

function loadVueScript(filename, globals) {
  const file = fs.readFileSync(path.join(statistics, filename), 'utf8');
  const source = file.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  assert.ok(source, `Missing Vue script: ${filename}`);
  const code = source.replace(/^import[\s\S]*?;\s*/gm, '').replace('export default', 'module.exports =');
  const context = { module: { exports: {} }, ...globals };
  vm.runInNewContext(code, context, { filename });
  return context.module.exports;
}

function setup(selected = 2) {
  const maxTier = { AD: 8, ID: 8, TD: 8 };
  const player = { options: { multiplierTab: { currTab: selected, replacePowers: false, showAltGroup: true } } };
  const multiplierTabValues = {};
  for (const group of navigation.MULTIPLIER_TAB_GROUPS) {
    for (const option of group.options) {
      multiplierTabValues[option.key] = {
        total: {
          overlay: [],
          isActive: tier => tier ? tier <= (maxTier[option.key] ?? 0) : true
        }
      };
    }
  }
  const globals = {
    player,
    GameDatabase: { multiplierTabValues },
    createEntryInfo: key => ({ key, isOrdered: /^(IP|EP|AD|ID|TD)_total/.test(key) }),
    availableMultiplierTabGroups: navigation.availableMultiplierTabGroups,
    resolveMultiplierTab: navigation.resolveMultiplierTab,
    MultiplierBreakdownEntry: {}
  };
  const options = loadVueScript('MultiplierBreakdownTab.vue', globals);
  const instance = { ...options.data(), $set: (target, key, value) => { target[key] = value; } };
  for (const [key, getter] of Object.entries(options.computed)) {
    Object.defineProperty(instance, key, { get: () => getter.call(instance) });
  }
  for (const [key, method] of Object.entries(options.methods)) instance[key] = method.bind(instance);
  options.created.call(instance);
  return { instance, player, maxTier, options };
}

test('existing numeric tab IDs and saved category selections remain intact', () => {
  const { instance, player } = setup(2);
  assert.equal(instance.currentKey, 'AD');
  assert.equal(player.options.multiplierTab.currTab, 2);
  const ip = instance.availableGroups.find(group => group.key === 'prestige').options.find(option => option.key === 'IP');
  instance.selectTab(ip);
  assert.equal(player.options.multiplierTab.currTab, 3);
  assert.equal(instance.resource.key, 'IP_total');
  assert.equal(instance.analysisModeLabel, 'Ordered formula');
});

test('inline switch goes Overall → AD1 → AD8 → Overall without changing saved tab', () => {
  const { instance, player } = setup();
  assert.equal(instance.resource.key, 'AD_total');
  assert.equal(instance.analysisModeLabel, 'Combined source impacts');
  assert.deepEqual(Array.from(instance.dimensionOptions, option => option.tier), [0, 1, 2, 3, 4, 5, 6, 7, 8]);
  instance.stepDimension(-1); // Previous is disabled at Overall, even when called directly.
  assert.equal(instance.dimensionTier, 0);
  instance.stepDimension(1);
  assert.equal(instance.dimensionTier, 1);
  assert.equal(instance.resource.key, 'AD_total_1');
  instance.selectDimension(8);
  instance.stepDimension(1); // Next is disabled at last tier.
  assert.equal(instance.resource.key, 'AD_total_8');
  instance.stepDimension(-1);
  assert.equal(instance.resource.key, 'AD_total_7');
  instance.selectDimension(0);
  assert.equal(instance.resource.key, 'AD_total');
  assert.equal(player.options.multiplierTab.currTab, 2);
});

test('switching AD / ID / TD resets inline view to Overall; detail remains in same tab', () => {
  const { instance, player } = setup();
  instance.selectDimension(7);
  const id = instance.availableGroups.find(group => group.key === 'dimensions').options.find(o => o.key === 'ID');
  instance.selectTab(id);
  assert.equal(instance.resource.key, 'ID_total');
  assert.equal(instance.analysisModeLabel, 'Combined source impacts');
  instance.stepDimension(1);
  instance.selectDimension(2);
  assert.equal(instance.resource.key, 'ID_total_2');
  assert.equal(instance.analysisModeLabel, 'Ordered formula');
  assert.equal(player.options.multiplierTab.currTab, 4);
  const td = instance.availableGroups.find(group => group.key === 'dimensions').options.find(o => o.key === 'TD');
  instance.selectTab(td);
  assert.equal(instance.resource.key, 'TD_total');
  instance.stepDimension(1);
  assert.equal(instance.resource.key, 'TD_total_1');
  assert.equal(player.options.multiplierTab.currTab, 8);
  const ad = instance.availableGroups.find(group => group.key === 'dimensions').options.find(o => o.key === 'AD');
  instance.selectTab(ad);
  assert.equal(instance.resource.key, 'AD_total');
});

test('inline switch skips locked tiers and resets to Overall when selected tier becomes locked', () => {
  const { instance, maxTier } = setup();
  instance.selectDimension(8);
  maxTier.AD = 3;
  instance.update();
  assert.equal(instance.dimensionTier, 0);
  assert.deepEqual(Array.from(instance.dimensionOptions, option => option.tier), [0, 1, 2, 3]);
  instance.selectDimension(8);
  assert.equal(instance.dimensionTier, 0);
  instance.stepDimension(1);
  assert.equal(instance.dimensionTier, 1);
  maxTier.AD = 0;
  instance.update();
  assert.equal(instance.resource.key, 'AD_total');
  instance.stepDimension(1);
  assert.equal(instance.dimensionTier, 0);
});

test('dimension roots suppress the obsolete all-tiers grouping; child controls retain it', () => {
  const options = loadVueScript('MultiplierBreakdownEntry.vue', {
    BreakdownEntryInfo: class {},
    PrimaryToggleButton: {},
    getResourceEntryInfoGroups: () => [],
    PercentageRollingAverage: class {},
    player: { options: { multiplierTab: { showAltGroup: true } } }
  });
  for (const key of ['AD_total', 'ID_total', 'TD_total', 'AD_total_3']) {
    const rootEntry = { isRoot: true, resource: { key }, groups: [1, 2], changeGroup: () => assert.fail('root changed grouping') };
    Object.defineProperty(rootEntry, 'isDimensionRoot', { get: () => options.computed.isDimensionRoot.call(rootEntry) });
    assert.equal(rootEntry.isDimensionRoot, true);
    options.created.call(rootEntry);
  }
  let groupChanged = 0;
  const child = { isRoot: false, resource: { key: 'AD_purchase' }, groups: [1, 2], changeGroup: () => groupChanged++ };
  Object.defineProperty(child, 'isDimensionRoot', { get: () => options.computed.isDimensionRoot.call(child) });
  options.created.call(child);
  assert.equal(groupChanged, 1);
});

test('UI switches within the same analysis header, not via dimension tabs', () => {
  const source = fs.readFileSync(path.join(statistics, 'MultiplierBreakdownTab.vue'), 'utf8');
  assert.match(source, /class="c-multiplier-context"[\s\S]*?class="l-dimension-inline-switch"/);
  assert.match(source, /aria-label="Choose overall or dimension analysis view"/);
  assert.match(source, /aria-label="Previous dimension analysis view"/);
  assert.match(source, /aria-label="Next dimension analysis view"/);
  assert.match(source, /stepDimension\(-1\)/);
  assert.match(source, /stepDimension\(1\)/);
  assert.match(source, /\{ tier: 0, text: "Overall" \}/);
  assert.doesNotMatch(source, /selectDimensionMode|By dimension|<button\s+v-for="option in dimensionOptions"/);
});

test('AD explains traced multiplier scope; AM retains honest approximate-production caveat', () => {
  const source = fs.readFileSync(path.join(statistics, 'MultiplierBreakdownTab.vue'), 'utf8');
  assert.match(source, /AD analyzes individual dimension multipliers/);
  assert.match(source, /Antimatter production attribution remains approximate/);
  assert.match(source, /currentKey === 'AD'/);
  assert.match(source, /currentKey === 'AM'/);
});
