'use strict';
// End-to-end ADE regression: a fresh browser context, an exported player save,
// real gameLoop/autobuyers, then the game's actual Reality path. No mocks.
// Usage: node tests/run-reality-smoke.cjs <exported-save.txt> [--ticks 100]
const fs = require('node:fs');
const path = require('node:path');
const { URL } = require('node:url');

function optionsFrom(argv) {
  const options = {
    file: path.join(__dirname, 'fixtures/local-overflow-save.txt'),
    url: 'http://127.0.0.1:8080/?realityTest=1',
    ticks: 100,
    stepMs: 50,
    mode: 'auto',
    stressSingularities: false,
    stressDarkEnergy: false,
    stressBulkSingularity: false
  };
  let hasFile = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') return { help: true };
    if (arg === '--url') options.url = argv[++i];
    else if (arg === '--ticks') options.ticks = Number(argv[++i]);
    else if (arg === '--step-ms') options.stepMs = Number(argv[++i]);
    else if (arg === '--manual') options.mode = 'manual';
    else if (arg === '--stress-singularities') options.stressSingularities = true;
    else if (arg === '--stress-dark-energy') options.stressDarkEnergy = true;
    else if (arg === '--stress-bulk-singularity') options.stressBulkSingularity = true;
    else if (!arg.startsWith('-') && !hasFile) { options.file = arg; hasFile = true; }
    else throw new Error(`Unknown argument: ${arg}`);
  }
  const origin = new URL(options.url);
  if (!['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname)) {
    throw new Error('For save privacy, --url must point to localhost / 127.0.0.1 / [::1]');
  }
  if (!Number.isSafeInteger(options.ticks) || options.ticks < 0 || options.ticks > 10000) {
    throw new Error('--ticks must be an integer from 0 to 10000');
  }
  if (!Number.isFinite(options.stepMs) || options.stepMs < 1 || options.stepMs > 1000) {
    throw new Error('--step-ms must be between 1 and 1000');
  }
  return options;
}

async function run() {
  const options = optionsFrom(process.argv.slice(2));
  if (options.help) {
    console.log('Usage: node tests/run-reality-smoke.cjs [save.txt] [--url http://127.0.0.1:8080/]');
    console.log('       [--ticks 100] [--step-ms 50] [--manual] [--stress-singularities] [--stress-dark-energy]');
    console.log('       [--stress-bulk-singularity]');
    console.log('Runs the real ADE game loop and Reality in a disposable browser context.');
    return;
  }
  const filename = path.resolve(options.file);
  if (!fs.existsSync(filename)) {
    throw new Error(`No test save at ${filename}. Export a save once and supply its path, or place it at tests/fixtures/local-overflow-save.txt`);
  }
  const saveText = fs.readFileSync(filename, 'utf8').trim();
  if (saveText.length < 40) throw new Error('Test save is empty or too short');
  let playwright;
  try { playwright = require('playwright'); } catch {
    throw new Error('Playwright is required: npm install --no-save --package-lock=false playwright');
  }

  // Hard fail on infinite synchronous loops, rather than silently hanging CI.
  const watchdog = setTimeout(() => {
    console.error('FAIL: Reality smoke test timed out after 90 seconds');
    process.exit(124);
  }, 90000);
  let browser;
  try {
    try {
      browser = await playwright.chromium.launch({ channel: 'msedge', headless: true });
    } catch {
      browser = await playwright.chromium.launch({ headless: true });
    }
    // Never reuse the user's regular browser profile, localStorage, cookies, or cloud login.
    const context = await browser.newContext({ serviceWorkers: 'block' });
    await context.route('https://www.googletagmanager.com/**', route => route.abort());
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.stack || error.message));
    console.log(`Fixture: ${path.basename(filename)} | ticks=${options.ticks} | ${options.mode} Reality` +
      (options.stressSingularities ? ' | synthetic extreme singularities' : '') +
      (options.stressDarkEnergy ? ' | synthetic extreme Dark Energy production' : '') +
      (options.stressBulkSingularity ? ' | synthetic bulk Singularity timing' : ''));
    await page.goto(options.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForFunction(() => Boolean(window.GameStorage && window.GameSaveSerializer &&
      window.GameIntervals && window.gameLoop && window.player && window.isRealityAvailable &&
      window.autoReality && window.processManualReality), null, { timeout: 20000 });

    const outcome = await page.evaluate(async ({ saveText: text, ticks, stepMs, mode,
      stressSingularities, stressDarkEnergy, stressBulkSingularity }) => {
      let phase = 'prepare';
      let tick = 0;
      const isFiniteDecimal = value => value && [value.sign, value.layer, value.mag].every(Number.isFinite);
      const describe = value => value && typeof value === 'object' && 'layer' in value
        ? `Decimal(sign=${value.sign},layer=${value.layer},mag=${value.mag})` : String(value);
      const awaitGlyphProcessing = async () => {
        // Amplified Realities process glyphs in Async.run() *after* the Reality
        // count changes. Do not mark a reset successful before this finishes.
        await new Promise(resolve => setTimeout(resolve, 25));
        const progress = () => window.ui && window.ui.$viewModel &&
          window.ui.$viewModel.modal && window.ui.$viewModel.modal.progressBar;
        const deadline = Date.now() + 25000;
        while (progress() && Date.now() < deadline) {
          await new Promise(resolve => setTimeout(resolve, 25));
        }
        if (progress()) throw new Error('Async Reality glyph processing exceeded 25 seconds');
      };
      const diagnostics = () => {
        const details = {};
        for (const [name, fn] of [
          ['singularities', () => window.Currency.singularities.value],
          ['dimensionPower', () => window.SingularityMilestone.dimensionPow.effectOrDefault(1)],
          ['cd8Amount', () => window.CelestialDimension(8).amount],
          ['cd8Multiplier', () => window.CelestialDimension(8).multiplier],
          ['gameSpeed', () => window.getGameSpeedupFactor()],
          ['replicantiAmount', () => window.Replicanti.amount],
          ['replicantiBaseInterval', () => window.player.replicanti.interval],
          ['replicantiSpeedMult', () => window.totalReplicantiSpeedMult(false)],
          ['replicantiReality6', () => window.RealityUpgrade(6).effectOrDefault(1)],
          ['replicantiPreReality', () => window.Effects.product(
            window.Achievement(81), window.TimeStudy(62), window.TimeStudy(213)
          )],
          ['replicationGlyphSpeed', () => window.getAdjustedGlyphEffect('replicationspeed')],
          ['replicationDtSpeed', () => window.ReplicantiMultipliers.dtMult],
          ['replicationAlchemy', () => window.AlchemyResource.replication.effectOrDefault(1)],
          ['replicationRa', () => window.Ra.unlocks.continuousTTBoost.effects.replicanti.effectOrDefault(1)],
          ['replicantiInterval', () => window.getReplicantiInterval(false)],
          ['replicantiChance', () => window.Replicanti.chance],
          ['replicantiIntervalPow', () => window.BreakEternityUpgrade.replicantiIntervalPow.effectOrDefault(1)],
          ['replicantiUncapped', () => window.Replicanti.isUncapped],
          ['replicantiCap', () => window.replicantiCap()],
          ['replicantiGalaxyBuying', () => window.Replicanti.galaxies.areBeingBought],
          ['ttPerSecond', () => window.getTTPerSecond()],
          ['ttRaContinuous', () => window.Ra.unlocks.continuousTTBoost.effects.ttGen.effectOrDefault(1)],
          ['ttAchievementMult', () => window.Ra.unlocks.achievementTTMult.effectOrDefault(1)],
          ['ttGlyphEffect', () => window.getAdjustedGlyphEffect('dilationTTgen')],
          ['ttDilationGenerator', () => window.DilationUpgrade.ttGenerator.effectOrDefault(window.DC.D0)],
          ['ttSingularityPower', () => window.SingularityMilestone.theoremPowerFromSingularities.effectOrDefault(1)],
          ['ttAlphaPower', () => window.AlphaUnlocks.timeTheoremGeneration.effects.buff.effectOrDefault(1)],
          ['uncappedRM', () => window.MachineHandler.uncappedRM],
          ['baseIMCap', () => window.MachineHandler.baseIMCap],
          ['hardcapIM', () => window.MachineHandler.hardcapIM]
        ]) {
          try { details[name] = describe(fn()); } catch (error) { details[name] = error.message; }
        }
        return details;
      };
      try {
        window.GameIntervals.stop();
        // Disable all periodic work and writes during this isolated test page.
        for (const interval of window.GameIntervals.all()) {
          interval.start = () => {};
          interval.restart = () => {};
        }
        window.GameIntervals.start = () => {};
        window.GameIntervals.restart = () => {};
        window.GameStorage.save = () => {};
        window.GameStorage.saveToBackup = () => {};
        window.GameStorage.backupOfflineSlots = () => {};
        window.GameStorage.tryOnlineBackups = () => {};
        window.GameStorage.offlineEnabled = false;
        window.GameStorage.ignoreBackupTimer = true;

        phase = 'deserialize';
        const root = window.GameSaveSerializer.deserialize(text);
        const snapshot = root && root.saves ? root.saves[root.current] : root;
        if (!snapshot || window.GameStorage.checkPlayerObject(snapshot) !== '') {
          throw new Error('Invalid exported player save or selected slot');
        }
        phase = 'load';
        // The real load pipeline performs migrations, cache rebuilding and glyph setup.
        window.GameStorage.loadPlayerObject(snapshot);
        window.GameIntervals.stop();
        window.GameStorage.ignoreBackupTimer = true;
        if (stressSingularities) {
          phase = 'synthetic-singularity-scenario';
          // Deliberately large but finite Decimal: log10(singularities) itself
          // exceeds native Number. Only the disposable in-memory save is changed.
          const huge = window.Decimal.pow10(window.Decimal.pow10(400));
          if (!isFiniteDecimal(huge)) throw new Error('Unable to construct finite extreme singularities');
          window.Currency.singularities.value = huge;
        }
        if (stressDarkEnergy) {
          phase = 'synthetic-dark-energy-scenario';
          // The actual tick path must accept a finite high-layer DE multiplier
          // without first constructing Infinity in ticks × powerDE.
          const dim = window.DarkMatterDimension(1);
          const huge = window.Decimal.pow10(window.Decimal.pow10(400));
          if (!isFiniteDecimal(huge)) throw new Error('Unable to construct finite extreme Dark Energy production');
          Object.defineProperty(dim, 'isUnlocked', { configurable: true, get: () => true });
          Object.defineProperty(dim, 'powerDE', { configurable: true, get: () => huge });
          dim.timeSinceLastUpdate = Math.max(dim.timeSinceLastUpdate, 1000);
          window.DarkMatterDimensions.tick(1000);
          if (!isFiniteDecimal(window.Currency.darkEnergy.value)) {
            throw new Error(`Dark Energy became nonfinite: ${describe(window.Currency.darkEnergy.value)}`);
          }
        }
        if (stressBulkSingularity) {
          phase = 'synthetic-bulk-singularity-scenario';
          const originalTime = Object.getOwnPropertyDescriptor(window.Singularity, 'timePerCondense');
          if (!originalTime) throw new Error('Unable to override Singularity time for bulk Autobuyer test');
          try {
            window.player.auto.bulkSingularity.lowerBound = 0.1;
            window.player.auto.bulkSingularity.hasLowerBound = true;
            window.player.auto.bulkSingularity.hasUpperBound = false;
            window.Currency.singularities.value = window.DC.E2;
            window.player.celestials.laitela.singularityCapIncreases = window.DC.BEMAX;
            Object.defineProperty(window.Singularity, 'timePerCondense', {
              configurable: true,
              get: () => window.DC.D0
            });
            window.Autobuyer.bulkSingularity.tick();
          } finally {
            Object.defineProperty(window.Singularity, 'timePerCondense', originalTime);
          }
          if (!isFiniteDecimal(window.player.celestials.laitela.singularityCapIncreases)) {
            throw new Error('Bulk Singularity Autobuyer wrote a nonfinite cap-increase count');
          }
        }
        const before = new window.Decimal(window.player.realities);
        const startedReady = window.isRealityAvailable();
        phase = 'gameLoop';
        for (tick = 0; tick < ticks; tick++) {
          window.gameLoop(stepMs);
          if (window.player.realities.gt(before)) break;
          // Let Vue and async reset callbacks progress without starting intervals.
          if ((tick + 1) % 10 === 0) await Promise.resolve();
        }
        if (window.player.realities.gt(before)) {
          phase = 'automatic-reset-during-ticks';
          await awaitGlyphProcessing();
          return { status: 'passed', phase, tick, startedReady,
            realitiesBefore: describe(before), realitiesAfter: describe(window.player.realities) };
        }
        const ready = window.isRealityAvailable();
        if (!ready) {
          return { status: 'not-ready', phase: 'eligibility', tick,
            startedReady, diagnostic: diagnostics() };
        }
        phase = mode === 'manual' ? 'processManualReality' : 'autoReality';
        if (mode === 'manual') window.processManualReality(false);
        else window.autoReality();
        await awaitGlyphProcessing();
        if (!isFiniteDecimal(window.player.realities)) {
          throw new Error(`Reality count became nonfinite: ${describe(window.player.realities)}`);
        }
        return {
          status: window.player.realities.gt(before) ? 'passed' : 'no-reset',
          phase, tick, startedReady, realitiesBefore: describe(before),
          realitiesAfter: describe(window.player.realities), diagnostic: diagnostics()
        };
      } catch (error) {
        return { status: 'failed', phase, tick, error: error.stack || String(error), diagnostic: diagnostics() };
      } finally {
        window.GameIntervals.stop();
      }
    }, { saveText, ticks: options.ticks, stepMs: options.stepMs, mode: options.mode,
      stressSingularities: options.stressSingularities, stressDarkEnergy: options.stressDarkEnergy,
      stressBulkSingularity: options.stressBulkSingularity });

    await page.waitForTimeout(100);
    if (pageErrors.length > 0) {
      console.error(`FAIL: browser uncaught error(s):\n${pageErrors.slice(0, 3).join('\n---\n')}`);
      process.exitCode = 1;
    }
    console.log(JSON.stringify(outcome, null, 2));
    if (outcome.status !== 'passed') process.exitCode = 1;
    await context.close();
  } finally {
    clearTimeout(watchdog);
    if (browser) await browser.close();
  }
}

run().catch(error => { console.error(`FAIL: ${error.stack || error}`); process.exitCode = 1; });
