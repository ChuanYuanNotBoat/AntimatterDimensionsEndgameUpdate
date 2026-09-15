import {
  addOrderedFinalImpacts,
  addOrderedTraceMismatch,
  addOrderedTransform,
  createOrderedTransformCache,
  orderedMultiplyStep,
  orderedPowerStep,
  orderedTransformStep,
} from "./ordered-breakdown";

function epPositivePowers(skipKey = null) {
  let value = DC.D1;
  if (skipKey !== "glyphPower" && GlyphAlteration.isAdded("time")) {
    value = value.times(getSecondaryGlyphEffect("timeEP"));
  }
  if (skipKey !== "endgameMastery142" && EndgameMastery(142).isBought) {
    value = value.timesEffectsOf(EndgameMastery(142));
  }
  if (skipKey !== "raPower") value = value.timesEffectOf(Ra.unlocks.eternityPointPower);
  if (skipKey !== "achievement232") value = value.timesEffectOf(Achievement(232));
  if (skipKey !== "ascensionEPPower" && Ascensions.epA.isUnlocked) {
    value = value.timesEffectOf(EternityUpgrade.epMult);
  }
  return value;
}

function epDivisors(skipKey = null) {
  const improved = skipKey === "divisor"
    ? new Decimal(308)
    : new Decimal(308).sub(PelleRifts.recursion.effectValue);
  const final = skipKey === "powerCompensation"
    ? improved
    : Decimal.max(improved, epPositivePowers(skipKey).times(2));
  return { improved, final, formulaFinal: final.toNumber() };
}

function epFromDivisor(divisor) {
  return DC.D5.pow(
    player.records.thisEternity.maxIP
      .plus(gainedInfinityPoints())
      .add(1)
      .log10()
      .div(divisor)
      .sub(0.7)
  );
}

function pelleTimeStudyMult() {
  let value = DC.D1;
  if (PelleDestructionUpgrade.timestudy61.canBeApplied) value = value.timesEffectOf(TimeStudy(61));
  if (PelleDestructionUpgrade.timestudy122.canBeApplied) value = value.timesEffectOf(TimeStudy(122));
  if (PelleDestructionUpgrade.timestudy121.canBeApplied) value = value.timesEffectOf(TimeStudy(121));
  if (PelleDestructionUpgrade.timestudy123.canBeApplied) value = value.timesEffectOf(TimeStudy(123));
  return value;
}

function normalTimeStudyMult() {
  return DC.D1.timesEffectsOf(
    TimeStudy(61),
    TimeStudy(122),
    TimeStudy(121),
    TimeStudy(123),
  );
}

function epTimeStudyMult() {
  return Pelle.isDisabled("EPMults") ? pelleTimeStudyMult() : normalTimeStudyMult();
}

function epEternityUpgradeMult() {
  if (Ascensions.epA.isUnlocked) return DC.D1;
  if (Pelle.isDisabled("EPMults") && !PelleDestructionUpgrade.x5EPUpgrade.canBeApplied) return DC.D1;
  return EternityUpgrade.epMult.effectOrDefault(1);
}

function epRealityUpgradeMult() {
  if (Pelle.isDisabled("EPMults") && !PelleRealityUpgrade.knowingExistence.canBeApplied) return DC.D1;
  return RealityUpgrade(12).effectOrDefault(1);
}

function epGlyphMult() {
  if (Pelle.isDisabled("EPMults") && !PelleDestructionUpgrade.destroyedGlyphEffects.canBeApplied) return DC.D1;
  return getAdjustedGlyphEffect("timeEP");
}

function epPelleGlyphMult() {
  return Pelle.isDisabled("EPMults") ? Pelle.specialGlyphEffect.time : DC.D1;
}

function epPelleVacuumMult() {
  return Pelle.isDisabled("EPMults") ? PelleRifts.vacuum.milestones[2].effectOrDefault(1) : DC.D1;
}

function epCursedGlyphMult() {
  return Pelle.isDisabled("EPMults") ? DC.D1 : getAdjustedGlyphEffect("cursedEP");
}

function epIAPMult() {
  return Pelle.isDisabled("EPMults") ? DC.D1 : ShopPurchase.EPPurchases.currentMult;
}

function epAlphaTimeStudyMult() {
  return player.disablePostReality ? DC.D1 : AlphaUnlocks.timestudy61.effects.buff.effectOrDefault(1);
}

function epNullUpgradeMult() {
  return !Pelle.isDisabled("EPMults") && LHC.voidRunning
    ? NullUpgrade.eternityPointMult.effectOrDefault(1)
    : DC.D1;
}

function evaluateEternityPoints(skipKey = null, steps = null) {
  if (!Player.canEternity) return DC.D1;

  const divisors = epDivisors(skipKey);
  const baseAt308 = epFromDivisor(308);
  const improvedBase = epFromDivisor(divisors.improved);
  const finalBase = epFromDivisor(divisors.formulaFinal);

  if (steps) {
    addOrderedTransform(steps, "base", "formula", DC.D1, baseAt308, { alwaysShow: true });
    addOrderedTransform(steps, "divisor", "formula", baseAt308, improvedBase, {
      display: `Formula divisor ${format(308, 0)} ➜ ${format(divisors.improved, 2, 2)}`
    });
    addOrderedTransform(steps, "powerCompensation", "softcap", improvedBase, finalBase, {
      display: `Formula divisor ${format(divisors.improved, 2, 2)} ➜ ${format(divisors.final, 2, 2)}`
    });
  }

  let ep = finalBase;

  if (Pelle.isDisabled("EPMults")) {
    ep = orderedMultiplyStep(steps, "pelleGlyph", ep, epPelleGlyphMult(), skipKey);
    ep = orderedMultiplyStep(steps, "pelle", ep, epPelleVacuumMult(), skipKey);
    ep = orderedMultiplyStep(steps, "eternityUpgrade", ep, epEternityUpgradeMult(), skipKey);
    ep = orderedMultiplyStep(steps, "timeStudy", ep, epTimeStudyMult(), skipKey);
    ep = orderedMultiplyStep(steps, "realityUpgrade", ep, epRealityUpgradeMult(), skipKey);
    ep = orderedMultiplyStep(steps, "glyph", ep, epGlyphMult(), skipKey);
    ep = orderedMultiplyStep(steps, "alphaTimeStudy", ep, epAlphaTimeStudyMult(), skipKey);
  } else {
    ep = orderedMultiplyStep(steps, "cursedGlyph", ep, epCursedGlyphMult(), skipKey);
    ep = orderedMultiplyStep(steps, "iap", ep, epIAPMult(), skipKey);
    ep = orderedMultiplyStep(steps, "timeStudy", ep, epTimeStudyMult(), skipKey);
    ep = orderedMultiplyStep(steps, "realityUpgrade", ep, epRealityUpgradeMult(), skipKey);
    ep = orderedMultiplyStep(steps, "glyph", ep, epGlyphMult(), skipKey);
    ep = orderedMultiplyStep(steps, "alphaTimeStudy", ep, epAlphaTimeStudyMult(), skipKey);
    ep = orderedMultiplyStep(steps, "eternityUpgrade", ep, epEternityUpgradeMult(), skipKey);
    ep = orderedMultiplyStep(steps, "nullUpgrade", ep, epNullUpgradeMult(), skipKey);
  }

  if (Teresa.isRunning) {
    ep = orderedPowerStep(steps, "nerfTeresa", ep, 0.55, skipKey);
  } else if (V.isRunning) {
    ep = orderedPowerStep(steps, "nerfV", ep, 0.5, skipKey);
  } else if (Laitela.isRunning) {
    ep = orderedTransformStep(steps, "nerfLaitela", "softcap", ep, dilatedValueOf(ep), skipKey);
  }

  if (GlyphAlteration.isAdded("time")) {
    ep = orderedPowerStep(steps, "glyphPower", ep, getSecondaryGlyphEffect("timeEP"), skipKey);
  }
  if (EndgameMastery(142).isBought) {
    ep = orderedPowerStep(steps, "endgameMastery142", ep, EndgameMastery(142).effectOrDefault(1), skipKey);
  }
  ep = orderedPowerStep(steps, "raPower", ep, Ra.unlocks.eternityPointPower.effectOrDefault(1), skipKey);
  ep = orderedPowerStep(steps, "achievement232", ep, Achievement(232).effectOrDefault(1), skipKey);

  if (Alpha.isRunning) {
    ep = orderedPowerStep(
      steps,
      "alphaEC10Nerf",
      ep,
      AlphaUnlocks.eternityChallenge10.effects.nerf.effectOrDefault(1),
      skipKey
    );
    ep = orderedPowerStep(
      steps,
      "alphaTD8Nerf",
      ep,
      AlphaUnlocks.timeDimension8.effects.nerf.effectOrDefault(1),
      skipKey
    );
  }

  if (Ascensions.epA.isUnlocked) {
    ep = orderedPowerStep(steps, "ascensionEPPower", ep, EternityUpgrade.epMult.effectOrDefault(1), skipKey);
  }

  if (Alpha.isRunning && Alpha.currentStage < 27) {
    ep = orderedTransformStep(steps, "alphaHardcap", "hardcap", ep, ep.min(DC.E3350), skipKey, {
      display: `Hardcap at ${format(DC.E3350, 2, 2)}`
    });
  }

  if (ResurgenceUpgrade.epSurge.isBought && !player.disablePostReality) {
    ep = orderedTransformStep(steps, "epSurge", "hardcap", ep, ep.min(player.antimatter), skipKey, {
      display: `Capped to Antimatter (${format(player.antimatter, 2, 2)})`
    });
  }

  if (skipKey !== "floor") {
    const floored = ep.floor();
    if (steps) addOrderedTransform(steps, "floor", "floor", ep, floored);
    ep = floored;
  }
  return ep;
}

function buildEternityPointBreakdown() {
  const steps = {};
  if (!Player.canEternity) return steps;

  const finalWith = evaluateEternityPoints(null, steps);
  addOrderedFinalImpacts(steps, evaluateEternityPoints, finalWith);
  addOrderedTraceMismatch(
    steps,
    finalWith,
    gainedEternityPoints(),
    "Breakdown differs from the current EP gain formula"
  );
  return steps;
}

const epTransform = createOrderedTransformCache(buildEternityPointBreakdown);

export const EternityPointBreakdown = {
  transform: key => epTransform(key),
  baseAt308: () => epFromDivisor(308),
  divisors: () => epDivisors(),
  timeStudyMult: () => epTimeStudyMult(),
  eternityUpgradeMult: () => epEternityUpgradeMult(),
  realityUpgradeMult: () => epRealityUpgradeMult(),
  glyphMult: () => epGlyphMult(),
  pelleGlyphMult: () => epPelleGlyphMult(),
  pelleVacuumMult: () => epPelleVacuumMult(),
  cursedGlyphMult: () => epCursedGlyphMult(),
  iapMult: () => epIAPMult(),
  alphaTimeStudyMult: () => epAlphaTimeStudyMult(),
  nullUpgradeMult: () => epNullUpgradeMult(),
};
