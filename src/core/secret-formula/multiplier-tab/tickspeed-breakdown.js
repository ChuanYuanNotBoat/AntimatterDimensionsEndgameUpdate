import {
  addOrderedFinalImpacts,
  addOrderedTraceMismatch,
  addOrderedTransform,
  createOrderedTransformCache,
} from "./ordered-breakdown";
import { MultiplierTabHelper } from "./helper-functions";

// A diagnostic reproduction of Tickspeed.baseValue/current, in src/core/tickspeed.js.
// Only the statistics tool calls the optional galaxy-count argument to the game function.
// It is important to operate on the *interval* and only invert at display time: galaxy
// strength is an exponent of the per-purchase interval, not a free-standing x multiplier.
function snapshot() {
  const galaxyDetails = {};
  const galaxyCount = effectiveBaseGalaxies(null, galaxyDetails);
  return {
    galaxyCount,
    galaxyDetails,
    noGalaxyMultiplier: getTickSpeedMultiplier(DC.D0),
    galaxyMultiplier: getTickSpeedMultiplier(galaxyCount),
    baseInterval: DC.E3.timesEffectsOf(Achievement(36), Achievement(45), Achievement(66), Achievement(83)),
  };
}

function trace(skipKey = null, steps = null, inputs = snapshot(), producingTiers = null) {
  const { galaxyCount, noGalaxyMultiplier, galaxyMultiplier, baseInterval } = inputs;
  const bought = skipKey === "purchased" || skipKey === "upgrades" ? DC.D0
    : (Laitela.continuumActive ? Tickspeed.continuumValue : player.totalTickBought);
  const free = skipKey === "free" || skipKey === "upgrades" ? DC.D0 : player.totalTickGained;
  const totalUpgrades = bought.add(free);
  let interval = baseInterval;
  let rate = Decimal.divide(1000, interval);

  function intervalStep(key, type, nextInterval, display = "") {
    if (skipKey === key) return;
    const nextRate = Decimal.divide(1000, nextInterval);
    if (steps) addOrderedTransform(steps, key, type, rate, nextRate, {
      display: typeof display === "function" ? display() : display
    });
    interval = nextInterval;
    rate = nextRate;
  }

  if (steps) addOrderedTransform(steps, "base", "formula", DC.D1, rate, {
    display: "1000 ms / (1000 ms × active achievement effects)", alwaysShow: true
  });

  const rateBeforeUpgrades = rate;
  intervalStep("purchased", "formula", interval.times(noGalaxyMultiplier.pow(bought)),
    () => `${format(bought, 2, 2)} purchased or continuum upgrades; no-galaxy factor ${format(noGalaxyMultiplier, 2, 3)}`);
  intervalStep("free", "formula", interval.times(noGalaxyMultiplier.pow(free)),
    () => `${format(free, 2, 2)} free upgrades from Time Shards`);
  if (steps) addOrderedTransform(steps, "upgrades", "formula", rateBeforeUpgrades, rate, {
    display: `${Laitela.continuumActive ? "Continuum" : "Purchased"}: ${format(bought, 2, 2)}; ` +
      `free: ${format(free, 2, 2)}; total: ${format(totalUpgrades, 2, 2)}; ` +
      `per-upgrade interval without galaxies: ${format(noGalaxyMultiplier, 2, 3)}`,
    alwaysShow: true
  });

  // Keep the current purchases when removing galaxies; galaxy strength changes the
  // multiplier applied by EVERY upgrade, not the number of upgrades.
  const currentGalaxyMultiplier = skipKey === "galaxies" ? noGalaxyMultiplier : galaxyMultiplier;
  intervalStep("galaxies", "formula", baseInterval.times(currentGalaxyMultiplier.pow(totalUpgrades)),
    () => `${format(galaxyCount, 2, 2)} effective galaxies; per-upgrade interval ${format(noGalaxyMultiplier, 2, 3)} → ${format(galaxyMultiplier, 2, 3)}`);

  const poweredMultiplier = currentGalaxyMultiplier.pow(totalUpgrades).powEffectOf(Ra.unlocks.tickspeedPower);
  intervalStep("raPower", "formula", baseInterval.times(poweredMultiplier),
    "Ra Tickspeed Power applies to the upgrade multiplier, not the base interval");

  if (Effarig.isRunning && skipKey !== "effarig") {
    // Effarig overrides the powered base interval entirely. The dilation upgrade
    // does not apply during this branch of the gameplay getter.
    intervalStep("effarig", "override", Effarig.tickspeed);
  } else {
    intervalStep("dilationPower", "power", interval.powEffectOf(DilationUpgrade.tickspeedPower));
  }
  if (player.dilation.active || (PelleStrikes.dilation.hasStrike && !PelleStrikes.dilation.isDestroyed())) {
    intervalStep("dilation", "formula", dilatedValueOf(interval));
  }
  if (player.endgame.overcharge.isRunning) {
    intervalStep("overcharge", "formula", dilateMultiplier(interval,
      Math.pow(0.72, player.endgame.overcharge.level)));
  }
  const count = producingTiers ?? MultiplierTabHelper.activeDimCount("AD");
  const result = rate.pow(count);
  if (steps) addOrderedTransform(steps, "dimensionExponent", "power", rate, result, {
    value: count, display: `${count} producing AD tiers`, alwaysShow: true
  });
  return result;
}

function build() {
  const steps = {};
  const inputs = snapshot();
  const result = trace(null, steps, inputs);
  addOrderedFinalImpacts(steps, skip => trace(skip, null, inputs), result, ["base", "dimensionExponent"]);
  addOrderedTraceMismatch(steps, result, Tickspeed.perSecond.pow(MultiplierTabHelper.activeDimCount("AD")),
    "Gameplay Tickspeed differs from the diagnostic formula; inspect src/core/tickspeed.js");
  return steps;
}

const getTrace = createOrderedTransformCache(build, 150);
const sourceCache = createOrderedTransformCache(() => {
  const total = Tickspeed.perSecond.pow(MultiplierTabHelper.activeDimCount("AD"));
  const result = {};
  const inputs = snapshot();
  for (const key of ["antimatter", "generated", "replicanti", "tachyon", "galactic"]) {
    const source = inputs.galaxyDetails.sources.find(item => item.key === key);
    const omitted = effectiveBaseGalaxies(key);
    const without = { ...inputs, galaxyCount: omitted,
      galaxyMultiplier: getTickSpeedMultiplier(omitted) };
    result[key] = {
      type: "formula",
      before: trace(null, null, without),
      after: total,
      display: `${source.name}: raw ${format(source.raw, 2, 2)}, adjusted ${format(source.effective, 2, 2)}; count without source ${format(omitted, 2, 2)} → ${format(inputs.galaxyCount, 2, 2)}.`,
    };
  }
  return result;
}, 180);

// The ordinary Tickspeed page intentionally displays the product across producing AD tiers.
// Antimatter uses one AD1 rate; expose the very same interval trace with exponent 1.
const perDimensionTrace = createOrderedTransformCache(() => {
  const steps = {};
  const inputs = snapshot();
  const result = trace(null, steps, inputs, 1);
  addOrderedFinalImpacts(steps, skip => trace(skip, null, inputs, 1), result, ["base", "dimensionExponent"]);
  addOrderedTraceMismatch(steps, result, Tickspeed.perSecond,
    "One-rate Tickspeed diagnostic differs from the gameplay interval");
  return steps;
}, 150);

export const TickspeedBreakdown = {
  transform: key => getTrace(key),
  perDimensionTransform: key => perDimensionTrace(key),
  galaxySource: key => sourceCache(key),
};
