import {
  addOrderedFinalImpacts,
  addOrderedTraceMismatch,
  addOrderedTransform,
  createOrderedTransformCache,
  orderedMultiplyStep,
  orderedPowerStep,
} from "./ordered-breakdown";

// Shadow src/game.js:gainedInfinities(), including its EC4/Pelle early returns.
// Do not replace the gameplay formula with this diagnostic trace.
function trace(skipKey = null, steps = null) {
  let value = DC.D1;
  if (steps) addOrderedTransform(steps, "base", "formula", DC.D1, value, { alwaysShow: true });
  const mult = (key, effect) => { value = orderedMultiplyStep(steps, key, value, effect, skipKey); };
  const power = (key, exponent) => { value = orderedPowerStep(steps, key, value, exponent, skipKey); };
  if (EternityChallenge(4).isRunning) return value;

  if (Pelle.isDoomed) {
    if (PelleAchievementUpgrade.achievement87.canBeApplied) {
      mult("achievement87", new Decimal(Effects.max(1, Achievement(87))));
    }
    if (PelleDestructionUpgrade.timestudy32.canBeApplied) mult("study32", TimeStudy(32).effectOrDefault(1));
    if (PelleRealityUpgrade.boundlessAmplifier.canBeApplied) mult("reality5", RealityUpgrade(5).effectOrDefault(1));
    if (PelleRealityUpgrade.innumerablyConstruct.canBeApplied) mult("reality7", RealityUpgrade(7).effectOrDefault(1));
    if (PelleAchievementUpgrade.achievement131.canBeApplied) {
      mult("achievement131", Achievement(131).effects.infinitiesGain.effectOrDefault(1));
    }
    if (PelleDestructionUpgrade.timestudy191.canBeApplied) {
      mult("study191", TimeStudy(191).effects.infinitiesGain.effectOrDefault(1));
    }
    if (PelleAchievementUpgrade.achievement164.canBeApplied) mult("achievement164", Achievement(164).effectOrDefault(1));
    if (PelleCelestialUpgrade.raV3.canBeApplied) {
      mult("ra", Ra.unlocks.continuousTTBoost.effects.infinity.effectOrDefault(1));
    }
    if (PelleDestructionUpgrade.destroyedGlyphEffects.canBeApplied) {
      mult("glyph", getAdjustedGlyphEffect("infinityinfmult"));
    }
    if (PelleDestructionUpgrade.singularityMilestones.canBeApplied) {
      power("singularity", SingularityMilestone.infinitiedPow.effectOrDefault(1));
    }
  } else {
    mult("achievement87", Effects.max(1, Achievement(87)).toDecimal());
    mult("study32", TimeStudy(32).effectOrDefault(1));
    mult("reality5", RealityUpgrade(5).effectOrDefault(1));
    mult("reality7", RealityUpgrade(7).effectOrDefault(1));
    mult("achievement131", Achievement(131).effects.infinitiesGain.effectOrDefault(1));
    mult("study191", TimeStudy(191).effects.infinitiesGain.effectOrDefault(1));
    mult("achievement164", Achievement(164).effectOrDefault(1));
    mult("ra", Ra.unlocks.continuousTTBoost.effects.infinity.effectOrDefault(1));
    mult("glyph", getAdjustedGlyphEffect("infinityinfmult"));
    if (LHC.voidRunning) mult("nullUpgrade", NullUpgrade.infinityMult.effectOrDefault(1));
    power("singularity", SingularityMilestone.infinitiedPow.effectOrDefault(1));
  }
  if (!player.disablePostReality) {
    power("alphaEC10", AlphaUnlocks.eternityChallenge10.effects.buff.effectOrDefault(1));
  }
  if (ResurgenceUpgrade.curr1Surge.isBought && !player.disablePostReality) {
    power("currencySurge", player.infinities.max(1e10).log10().log10());
  }
  power("chargedInfinityGen", BreakInfinityUpgrade.infinitiedGen.chargedEffect.effectOrDefault(1));
  return value;
}

function build() {
  const steps = {};
  const result = trace(null, steps);
  addOrderedFinalImpacts(steps, key => trace(key), result, ["base"]);
  addOrderedTraceMismatch(steps, result, gainedInfinities(), "Infinity gain differs from src/game.js");
  return steps;
}

const getTrace = createOrderedTransformCache(build, 120);
export const InfinitiesBreakdown = {
  transform: key => getTrace(key),
  summary: () => ({ type: "formula", before: DC.D1, after: gainedInfinities(), alwaysShow: true }),
};
