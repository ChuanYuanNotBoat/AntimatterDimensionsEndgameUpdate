import {
  addOrderedFinalImpacts,
  addOrderedTraceMismatch,
  addOrderedTransform,
  createOrderedTransformCache,
} from "./ordered-breakdown";

// Shadow the full live algorithm in src/game.js:getGameSpeedupFactor(), without
// touching the game-loop calculation. This trace includes every source in source
// order and validates the result against the real getter on every cache refresh.
// A missing future modifier produces a visible traceMismatch rather than a fake x1.
function trace(skipKey = null, steps = null) {
  let value = DC.D1;
  const step = (key, type, evaluate, display = "") => {
    if (skipKey === key) return;
    const before = value;
    value = evaluate(value);
    if (steps) addOrderedTransform(steps, key, type, before, value, { display });
  };
  if (EternityChallenge(12).isRunning || player.endgame.overcharge.isRunning) {
    step("fixed", "override", () => new Decimal(1 / 1000),
      "EC12 or Overcharge fixes game speed at 1/1000");
    if (skipKey !== "fixed") {
      // The gameplay getter returns immediately in this state, skipping even
      // Pelle, the late peak/clamp rules, and the other game-speed sources.
      if (steps) addOrderedTransform(steps, "base", "formula", DC.D1, DC.D1, { alwaysShow: true });
      return displaySpeed(value, skipKey, steps);
    }
  }

  step("blackHole", "formula", before => {
    let factor = before;
    if (BlackHoles.areNegative) return factor.times(player.blackHoleNegative);
    if (!BlackHoles.arePaused) {
      for (const blackHole of BlackHoles.list) {
        if (!blackHole.isUnlocked || !blackHole.isActive) break;
        factor = factor.times(Decimal.pow(blackHole.power, BlackHoles.unpauseAccelerationFactor));
        factor = factor.times(VUnlocks.achievementBH.effectOrDefault(1));
        if (Pelle.isDoomed && PelleCelestialUpgrade.vMilestones3.canBeApplied) {
          factor = factor.times(VUnlocks.achievementBH.effectValue);
        }
        if (ResurgenceUpgrade.achSurge.isBought && !player.disablePostReality) {
          factor = factor.pow(Achievements.powerConv(VUnlocks.achievementBH.effectOrDefault(1)));
        }
      }
    }
    return factor;
  }, "Black Hole activity, acceleration, V milestones, Pelle restoration, Resurgence power");
  step("singularity", "multiply", before =>
    before.times(SingularityMilestone.gamespeedFromSingularities.effectOrDefault(1)));
  step("timeGlyph", "multiply", before => before.times(getAdjustedGlyphEffect("timespeed")));
  step("effarigGlyphPower", "power", before => before.pow(getAdjustedGlyphEffect("effarigblackhole")));

  step("celestialMatter", "multiply", before => {
    if (player.endgame.celestialMatter.lte(0) || !player.endgame.celestialMatterMultiplier.isActive) return before;
    return before.times(Decimal.pow(player.endgame.celestialMatter, CelestialDimensions.conversionExponent));
  }, "CM ^ CelestialDimensions.conversionExponent; only while CM toggle is active");
  step("celestialIP", "multiply", before =>
    before.timesEffectOf(CelestialInfinityUpgrade.gameSpeedMultCIP),
  "Celestial Infinity Upgrade: gameSpeedMultCIP (independent of the CM toggle)");

  step("raTesseract", "multiply", before => Ra.unlocks.gameSpeedTesseractBoost.canBeApplied
    ? before.timesEffectOf(Ra.unlocks.gameSpeedTesseractBoost) : before);
  step("raPower", "power", before => Ra.unlocks.gameSpeedImprovement.canBeApplied
    ? before.powEffectOf(Ra.unlocks.gameSpeedImprovement) : before);

  step("timeStorage", "formula", before => {
    if (!Enslaved.isStoringGameTime) return before;
    const weight = (Ra.unlocks.autoPulseTime.canBeApplied || ExpansionPack.enslavedPack.isBought) &&
      !player.disablePostReality ? 0.99 : 1;
    return before.times(1 - weight).plus(weight);
  }, "Storing time: factor × (1 - storedTimeWeight) + storedTimeWeight");

  step("celestialNerf", "formula", before => {
    if (Effarig.isRunning) return Effarig.multiplier(before);
    if (!Laitela.isRunning) return before;
    const divisor = ExpansionPack.laitelaPack.isBought && !player.disablePostReality ? 5 : 10;
    const modifier = Math.clampMax(Time.thisRealityRealTime.totalMinutes.toNumber() / divisor, 1);
    return Decimal.pow(before, modifier);
  }, "Effarig multiplier, or Lai'tela's reality-time exponent");
  step("pelle", "multiply", before => before.times(PelleUpgrade.timeSpeedMult.effectValue));
  step("peak", "hardcap", before => {
    const applyMax = !Teresa.isRunning && !Effarig.isRunning && !Enslaved.isRunning &&
      !V.isRunning && !Ra.isRunning && !Laitela.isRunning && !Pelle.isDoomed &&
      player.endgame.celestialMatterMultiplier.isActive;
    return EndgameUpgrade(7).isBought && applyMax && !player.disablePostReality
      ? Decimal.clampMin(before, player.records.thisEndgame.peakGameSpeed) : before;
  }, "Endgame Upgrade 7: floor at highest game speed this Endgame");
  step("clamp", "hardcap", before => {
    const cap = EndgameMilestone.gameSpeedUncap.isReached && !player.disablePostReality ? DC.BEMAX : DC.E300;
    return Decimal.clamp(before, new Decimal(1e-300), cap);
  }, "Gameplay cap: [1e-300, 1e300], or BEMAX after the uncap milestone");
  if (steps) addOrderedTransform(steps, "base", "formula", DC.D1, DC.D1, { alwaysShow: true });
  return displaySpeed(value, skipKey, steps);
}

function displaySpeed(value, skipKey, steps) {
  if (skipKey === "autoRelease") return value;
  const before = value;
  if (Enslaved.isAutoReleasing && Enslaved.canRelease(true) && !BlackHoles.areNegative &&
      (!Pelle.isDisabled("blackhole") || PelleDestructionUpgrade.blackHole.canBeApplied)) {
    value = Decimal.max(Enslaved.autoReleaseSpeed, value);
  }
  if (steps) addOrderedTransform(steps, "autoRelease", "formula", before, value, {
    display: "Displayed speed may use Enslaved automatic release speed"
  });
  return value;
}

function build() {
  const steps = {};
  const result = trace(null, steps);
  addOrderedFinalImpacts(steps, skip => trace(skip), result, ["base"]);
  addOrderedTraceMismatch(steps, result, getGameSpeedupForDisplay(),
    "Game speed source code no longer matches this diagnostic; check src/game.js");
  return steps;
}

const getTrace = createOrderedTransformCache(build, 170);
export const GameSpeedBreakdown = { transform: key => getTrace(key) };
