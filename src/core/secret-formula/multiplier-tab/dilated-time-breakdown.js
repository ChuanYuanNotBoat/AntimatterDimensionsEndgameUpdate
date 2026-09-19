import {
  addOrderedFinalImpacts,
  addOrderedTraceMismatch,
  addOrderedTransform,
  createOrderedTransformCache,
  orderedMultiplyStep,
  orderedPowerStep,
  orderedTransformStep,
} from "./ordered-breakdown";

// Follow both branches of src/core/dilation.js:getDilationGainPerSecond().
// This is a diagnostic shadow trace, never used by gameplay. Its mismatch row
// makes new/changed game effects visible instead of silently misattributing them.
function trace(skipKey = null, steps = null) {
  const pelle = Pelle.isDoomed;
  const amount = Currency.tachyonParticles.value;
  let value = pelle
    ? amount.pow(PelleRifts.paradox.milestones[1].effectOrDefault(1))
    : new Decimal(amount);
  if (steps) addOrderedTransform(steps, "base", "formula", DC.D1, value, {
    alwaysShow: true, display: pelle ? "TP ^ Pelle Paradox milestone" : "Current Tachyon Particles"
  });
  const mult = (key, effect) => {
    value = orderedMultiplyStep(steps, key, value, effect, skipKey);
  };
  const power = (key, exponent) => {
    value = orderedPowerStep(steps, key, value, exponent, skipKey);
  };
  const change = (key, type, next, display = "") => {
    value = orderedTransformStep(steps, key, type, value, next, skipKey, { display });
  };
  if (pelle) {
    // Pelle has a separate restoration allowlist and an early return. It must
    // not inherit disabled effects from the normal branch.
    mult("dilation", DC.D1.timesEffectsOf(
      DilationUpgrade.dtGain, DilationUpgrade.dtGainPelle, DilationUpgrade.flatDilationMult));
    mult("iap", Math.pow(ShopPurchase.dilatedTimePurchases.currentMult, 0.5));
    mult("pelleGlyph", Pelle.specialGlyphEffect.dilation);
    let achievement = DC.D1;
    if (PelleAchievementUpgrade.achievement132.canBeApplied) achievement = achievement.timesEffectOf(Achievement(132));
    if (PelleAchievementUpgrade.achievement137.canBeApplied) achievement = achievement.timesEffectOf(Achievement(137));
    mult("achievement", achievement);
    if (PelleRealityUpgrade.temporalAmplifier.canBeApplied) mult("amplifierDT", RealityUpgrade(1).effectOrDefault(1));
    if (PelleAlchemyUpgrade.alchemyDilation.canBeApplied) mult("alchemy", AlchemyResource.dilation.effectOrDefault(1));
    if (PelleCelestialUpgrade.raV3.canBeApplied) {
      mult("ra1", Ra.unlocks.continuousTTBoost.effects.dilatedTime.effectOrDefault(1));
    }
    if (PelleCelestialUpgrade.raNameless4.canBeApplied) mult("ra2", Ra.unlocks.peakGamespeedDT.effectOrDefault(1));
    if (PelleDestructionUpgrade.destroyedGlyphEffects.canBeApplied) {
      mult("glyph", getAdjustedGlyphEffect("dilationDT"));
      mult("replicantiGlyph", ReplicantiMultipliers.dtMult);
    }
    if (!PelleDestructionUpgrade.disableDTNerf.canBeApplied) mult("nerfPelle", 1e-5);
    mult("endgameMastery", EndgameMastery(112).effectOrDefault(1));
    mult("gamespeed", Alpha.isRunning ? getGameSpeedupForDisplay().pow(0.01) : getGameSpeedupForDisplay());
    if (getAdjustedGlyphEffect("replicationdtgain").neq(0) &&
        PelleDestructionUpgrade.destroyedGlyphEffects.canBeApplied &&
        ResurgenceUpgrade.repSurge.isBought && !player.disablePostReality) {
      power("replicantiSurge", ReplicantiMultipliers.dtPow);
    }
  } else {
    mult("dilation", DilationUpgrade.dtGain.effectOrDefault(1));
    mult("achievement", DC.D1.timesEffectsOf(Achievement(132), Achievement(137)));
    mult("amplifierDT", RealityUpgrade(1).effectOrDefault(1));
    mult("alchemy", AlchemyResource.dilation.effectOrDefault(1));
    mult("ra1", Ra.unlocks.continuousTTBoost.effects.dilatedTime.effectOrDefault(1));
    mult("ra2", Ra.unlocks.peakGamespeedDT.effectOrDefault(1));
    mult("glyph", getAdjustedGlyphEffect("dilationDT"));
    mult("iap", ShopPurchase.dilatedTimePurchases.currentMult);
    mult("replicantiGlyph", ReplicantiMultipliers.dtMult);
    if (LHC.voidRunning) mult("nullUpgrade", NullUpgrade.dilatedTimeMult.effectOrDefault(1));
    if (Enslaved.isRunning && !value.eq(0)) {
      change("enslaved", "softcap", Decimal.pow10(Decimal.pow(value.plus(1).log10(), 0.85).sub(1)));
    }
    if (V.isRunning) power("nerfV", 0.5);
    mult("gamespeed", Alpha.isRunning ? getGameSpeedupForDisplay().pow(0.01) : getGameSpeedupForDisplay());
    if (getAdjustedGlyphEffect("replicationdtgain").neq(0) &&
        ResurgenceUpgrade.repSurge.isBought && !player.disablePostReality) {
      power("replicantiSurge", ReplicantiMultipliers.dtPow);
    }
    if (ResurgenceUpgrade.curr2Surge.isBought && !player.disablePostReality) {
      power("currencySurge", player.dilation.dilatedTime.max(1e10).log10().log10());
    }
  }
  if (!EndgameMastery(271).isBought && value.gte(DC.E20000)) {
    const thresholdLog = DC.E20000.log10();
    change("primarySoftcap", "softcap", Decimal.pow(10,
      Decimal.log10(value).sub(thresholdLog).div(10).add(thresholdLog)));
  }
  return value;
}

function build() {
  const steps = {};
  const result = trace(null, steps);
  addOrderedFinalImpacts(steps, key => trace(key), result, ["base"]);
  addOrderedTraceMismatch(steps, result, getDilationGainPerSecond(),
    "Dilated Time trace differs from src/core/dilation.js");
  return steps;
}

const getTrace = createOrderedTransformCache(build, 250);
export const DilatedTimeBreakdown = {
  transform: key => getTrace(key),
  summary: () => ({ type: "formula", before: DC.D1, after: getDilationGainPerSecond(), alwaysShow: true }),
};
