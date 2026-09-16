import {
  addOrderedFinalImpacts,
  addOrderedTraceMismatch,
  addOrderedTransform,
  createOrderedTransformCache,
  orderedMultiplyStep,
  orderedPowerStep,
} from "./ordered-breakdown";

// Shadow src/core/eternity.js:gainedEternities(), preserving the Pelle branch.
function trace(skipKey = null, steps = null) {
  let value = DC.D1;
  if (steps) addOrderedTransform(steps, "base", "formula", DC.D1, value, { alwaysShow: true });
  const mult = (key, effect) => { value = orderedMultiplyStep(steps, key, value, effect, skipKey); };
  const power = (key, exponent) => { value = orderedPowerStep(steps, key, value, exponent, skipKey); };
  if (Pelle.isDoomed) {
    if (PelleAchievementUpgrade.achievement102.canBeApplied) mult("achievement102", Achievement(102).effectOrDefault(1));
    if (PelleAchievementUpgrade.achievement113.canBeApplied) mult("achievement113", Achievement(113).effectOrDefault(1));
    if (PelleRealityUpgrade.eternalAmplifier.canBeApplied) mult("reality3", RealityUpgrade(3).effectOrDefault(1));
    if (PelleDestructionUpgrade.destroyedGlyphEffects.canBeApplied) mult("glyph", getAdjustedGlyphEffect("timeetermult"));
    if (PelleAlchemyUpgrade.alchemyEternity.canBeApplied) power("alchemy", AlchemyResource.eternity.effectValue);
  } else {
    mult("glyph", getAdjustedGlyphEffect("timeetermult"));
    mult("reality3", RealityUpgrade(3).effectOrDefault(1));
    mult("achievement102", Achievement(102).effectOrDefault(1));
    mult("achievement113", Achievement(113).effectOrDefault(1));
    power("alchemy", AlchemyResource.eternity.effectValue);
    if (LHC.voidRunning) mult("nullUpgrade", NullUpgrade.eternityMult.effectOrDefault(1));
  }
  if (ResurgenceUpgrade.curr1Surge.isBought && !player.disablePostReality) {
    power("currencySurge", player.eternities.max(1e10).log10().log10());
  }
  return value;
}

function build() {
  const steps = {};
  const result = trace(null, steps);
  addOrderedFinalImpacts(steps, key => trace(key), result, ["base"]);
  addOrderedTraceMismatch(steps, result, gainedEternities(), "Eternity gain differs from src/core/eternity.js");
  return steps;
}

const getTrace = createOrderedTransformCache(build, 120);
export const EternitiesBreakdown = {
  transform: key => getTrace(key),
  summary: () => ({ type: "formula", before: DC.D1, after: gainedEternities(), alwaysShow: true }),
};
