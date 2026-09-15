import {
  addOrderedFinalImpacts,
  addOrderedTraceMismatch,
  addOrderedTransform,
  createOrderedTransformCache,
  orderedMultiplyStep,
  orderedPowerStep,
  orderedTransformStep,
} from "./ordered-breakdown";

function ipPositivePowers(skipKey = null) {
  let value = DC.D1;
  if (skipKey !== "glyphPower" &&
      ((Pelle.isDoomed && PelleCelestialUpgrade.raTeresa3.canBeApplied) || GlyphAlteration.isAdded("infinity"))) {
    value = value.times(getSecondaryGlyphEffect("infinityIP"));
  }
  if (skipKey !== "endgameMastery141" && EndgameMastery(141).isBought) {
    value = value.timesEffectsOf(EndgameMastery(141));
  }
  if (skipKey !== "alphaPower" && !player.disablePostReality) {
    value = value.times(AlphaUnlocks.infinity.effects.buff.effectOrDefault(1));
  }
  if (skipKey !== "replicantiSurge" && AlchemyResource.exponential.amount > 0 &&
      ResurgenceUpgrade.repSurge.isBought && !player.disablePostReality) {
    value = value.times(ReplicantiMultipliers.ipPow);
  }
  if (skipKey !== "ascensionIPPower" && Ascensions.ipA.isUnlocked) {
    value = value.timesEffectOf(InfinityUpgrade.ipMult);
  }
  return value;
}

function ipDivisors(skipKey = null) {
  const improved = skipKey === "divisor"
    ? new Decimal(308)
    : new Decimal(Effects.min(
      308,
      Achievement(103),
      TimeStudy(111),
      EndgameMastery(151)
    ));
  const final = skipKey === "powerCompensation"
    ? improved
    : Decimal.max(improved, ipPositivePowers(skipKey).times(2));
  return { improved, final, formulaFinal: final.toNumber() };
}

function ipFromDivisor(divisor) {
  // The Pelle-disabled IP multiplier branch always uses the post-Break-Infinity formula, regardless of player.break.
  const useBrokenInfinityFormula = Pelle.isDisabled("IPMults") || player.break;
  return useBrokenInfinityFormula
    ? Decimal.pow10(player.records.thisInfinity.maxAM.add(1).log10().div(divisor).sub(0.75))
    : new Decimal(308).div(divisor);
}

function pelleTimeStudyMult() {
  let value = DC.D1;
  if (PelleDestructionUpgrade.timestudy41.canBeApplied) value = value.timesEffectOf(TimeStudy(41));
  if (PelleDestructionUpgrade.timestudy51.canBeApplied) value = value.timesEffectOf(TimeStudy(51));
  if (PelleDestructionUpgrade.timestudy141.canBeApplied) value = value.timesEffectOf(TimeStudy(141));
  if (PelleDestructionUpgrade.timestudy142.canBeApplied) value = value.timesEffectOf(TimeStudy(142));
  if (PelleDestructionUpgrade.timestudy143.canBeApplied) value = value.timesEffectOf(TimeStudy(143));
  return value;
}

function normalTimeStudyMult() {
  return DC.D1.timesEffectsOf(
    TimeStudy(41),
    TimeStudy(51),
    TimeStudy(141),
    TimeStudy(142),
    TimeStudy(143),
  );
}

function ipTimeStudyMult() {
  return Pelle.isDisabled("IPMults") ? pelleTimeStudyMult() : normalTimeStudyMult();
}

function pelleAchievementMult() {
  let value = DC.D1;
  if (PelleAchievementUpgrade.achievement85.canBeApplied) value = value.timesEffectOf(Achievement(85));
  if (PelleAchievementUpgrade.achievement93.canBeApplied) value = value.timesEffectOf(Achievement(93));
  if (PelleAchievementUpgrade.achievement116.canBeApplied) value = value.timesEffectOf(Achievement(116));
  if (PelleAchievementUpgrade.achievement125.canBeApplied) value = value.timesEffectOf(Achievement(125));
  if (PelleAchievementUpgrade.achievement141.canBeApplied) value = value.timesEffectOf(Achievement(141).effects.ipGain);
  return value;
}

function normalAchievementMult() {
  return DC.D1.timesEffectsOf(
    Achievement(85),
    Achievement(93),
    Achievement(116),
    Achievement(125),
    Achievement(141).effects.ipGain,
  );
}

function ipAchievementMult() {
  return Pelle.isDisabled("IPMults") ? pelleAchievementMult() : normalAchievementMult();
}

function ipDilationUpgradeMult() {
  if (Pelle.isDisabled("IPMults")) {
    return PelleDestructionUpgrade.reenableIPDilationUpgrade.canBeApplied
      ? DilationUpgrade.ipMultDT.effectOrDefault(1)
      : DC.D1;
  }
  return DilationUpgrade.ipMultDT.effectOrDefault(1);
}

function ipGlyphMult() {
  if (Pelle.isDisabled("IPMults")) {
    return PelleDestructionUpgrade.destroyedGlyphEffects.canBeApplied
      ? getAdjustedGlyphEffect("infinityIP")
      : DC.D1;
  }
  return getAdjustedGlyphEffect("infinityIP");
}

function ipInfinityUpgradeMult() {
  if (Ascensions.ipA.isUnlocked) return DC.D1;
  if (Pelle.isDisabled("IPMults")) {
    return PelleDestructionUpgrade.x2IPUpgrade.canBeApplied
      ? InfinityUpgrade.ipMult.effectOrDefault(1)
      : DC.D1;
  }
  return InfinityUpgrade.ipMult.effectOrDefault(1);
}

function ipReplicantiMult() {
  if (!Replicanti.areUnlocked) return DC.D1;
  if (Pelle.isDisabled("IPMults") && !PelleAlchemyUpgrade.alchemyExponential.canBeApplied) return DC.D1;
  return ReplicantiMultipliers.ipMult;
}

function evaluateInfinityPoints(skipKey = null, steps = null) {
  if (!Player.canCrunch) return DC.D1;

  const divisors = ipDivisors(skipKey);
  const baseAt308 = ipFromDivisor(308);
  const improvedBase = ipFromDivisor(divisors.improved.toNumber());
  const finalBase = ipFromDivisor(divisors.formulaFinal);

  if (steps) {
    addOrderedTransform(steps, "base", "formula", DC.D1, baseAt308, { alwaysShow: true });
    addOrderedTransform(steps, "divisor", "formula", baseAt308, improvedBase, {
      display: `Formula divisor ${format(308, 0)} ➜ ${format(divisors.improved, 2, 2)}`
    });
    addOrderedTransform(steps, "powerCompensation", "softcap", improvedBase, finalBase, {
      display: `Formula divisor ${format(divisors.improved, 2, 2)} ➜ ${format(divisors.final, 2, 2)}`
    });
  }

  let ip = finalBase;

  if (Pelle.isDisabled("IPMults")) {
    ip = orderedMultiplyStep(steps, "pelle", ip, DC.D1.timesEffectsOf(PelleRifts.vacuum), skipKey);
    ip = orderedMultiplyStep(steps, "pelleGlyph", ip, Pelle.specialGlyphEffect.infinity, skipKey);
    ip = orderedMultiplyStep(steps, "timeStudy", ip, ipTimeStudyMult(), skipKey);
    ip = orderedMultiplyStep(steps, "achievement", ip, ipAchievementMult(), skipKey);
    ip = orderedMultiplyStep(steps, "infinityUpgrade", ip, ipInfinityUpgradeMult(), skipKey);
    ip = orderedMultiplyStep(steps, "dilationUpgrade", ip, ipDilationUpgradeMult(), skipKey);
    ip = orderedMultiplyStep(steps, "glyph", ip, ipGlyphMult(), skipKey);
    ip = orderedMultiplyStep(steps, "alchemy", ip, ipReplicantiMult(), skipKey);

    if (PelleCelestialUpgrade.raTeresa3.canBeApplied) {
      ip = orderedPowerStep(steps, "glyphPower", ip, getSecondaryGlyphEffect("infinityIP"), skipKey);
    }
    if (EndgameMastery(141).isBought) {
      ip = orderedPowerStep(steps, "endgameMastery141", ip, EndgameMastery(141).effectOrDefault(1), skipKey);
    }
    if (!player.disablePostReality) {
      ip = orderedPowerStep(steps, "alphaPower", ip, AlphaUnlocks.infinity.effects.buff.effectOrDefault(1), skipKey);
    }
    if (AlchemyResource.exponential.amount > 0 && ResurgenceUpgrade.repSurge.isBought && !player.disablePostReality) {
      ip = orderedPowerStep(steps, "replicantiSurge", ip, ReplicantiMultipliers.ipPow, skipKey);
    }
    if (Ascensions.ipA.isUnlocked) {
      ip = orderedPowerStep(steps, "ascensionIPPower", ip, InfinityUpgrade.ipMult.effectOrDefault(1), skipKey);
    }

    if (skipKey !== "floor") {
      const floored = ip.floor();
      if (steps) addOrderedTransform(steps, "floor", "floor", ip, floored);
      ip = floored;
    }
    return ip;
  }

  if (Effarig.isRunning && Effarig.currentStage === EFFARIG_STAGES.ETERNITY) {
    ip = orderedTransformStep(steps, "effarigCap", "hardcap", ip, ip.min(DC.E200), skipKey, {
      display: `Hardcap at ${format(DC.E200, 2, 2)}`
    });
  }

  const totalMultDisabled = Effarig.isRunning && Effarig.currentStage === EFFARIG_STAGES.INFINITY;
  if (!totalMultDisabled) {
    ip = orderedMultiplyStep(steps, "iap", ip, ShopPurchase.IPPurchases.currentMult, skipKey);
    ip = orderedMultiplyStep(steps, "timeStudy", ip, normalTimeStudyMult(), skipKey);
    ip = orderedMultiplyStep(steps, "achievement", ip, normalAchievementMult(), skipKey);
    ip = orderedMultiplyStep(steps, "dilationUpgrade", ip, DilationUpgrade.ipMultDT.effectOrDefault(1), skipKey);
    ip = orderedMultiplyStep(steps, "glyph", ip, getAdjustedGlyphEffect("infinityIP"), skipKey);
    if (!Ascensions.ipA.isUnlocked) {
      ip = orderedMultiplyStep(steps, "infinityUpgrade", ip, InfinityUpgrade.ipMult.effectOrDefault(1), skipKey);
    }
    if (Replicanti.areUnlocked) {
      ip = orderedMultiplyStep(steps, "alchemy", ip, ReplicantiMultipliers.ipMult, skipKey);
    }
    if (LHC.voidRunning) {
      ip = orderedMultiplyStep(steps, "nullUpgrade", ip, NullUpgrade.infinityPointMult.effectOrDefault(1), skipKey);
    }
  }

  if (Teresa.isRunning) {
    ip = orderedPowerStep(steps, "nerfTeresa", ip, 0.55, skipKey);
  } else if (V.isRunning) {
    ip = orderedPowerStep(steps, "nerfV", ip, 0.5, skipKey);
  } else if (Laitela.isRunning) {
    ip = orderedTransformStep(steps, "nerfLaitela", "softcap", ip, dilatedValueOf(ip), skipKey);
  }

  if (GlyphAlteration.isAdded("infinity")) {
    ip = orderedPowerStep(steps, "glyphPower", ip, getSecondaryGlyphEffect("infinityIP"), skipKey);
  }
  if (EndgameMastery(141).isBought) {
    ip = orderedPowerStep(steps, "endgameMastery141", ip, EndgameMastery(141).effectOrDefault(1), skipKey);
  }
  if (!player.disablePostReality) {
    ip = orderedPowerStep(steps, "alphaPower", ip, AlphaUnlocks.infinity.effects.buff.effectOrDefault(1), skipKey);
  }

  if (Alpha.isRunning && Alpha.currentStage < 12) {
    ip = orderedPowerStep(steps, "alphaStageNerf", ip,
      AlphaUnlocks.infinityDimensions.effects.nerf.effectOrDefault(1), skipKey);
  }

  const topTier = Alpha.currentStage >= 18 ? 1 : 0;
  if (Alpha.isRunning && player.challenge.eternity.current > topTier) {
    ip = orderedPowerStep(steps, "alphaECNerf", ip, Effects.min(
      1,
      AlphaUnlocks.eternityChallengeUnlock.effects.nerf,
      AlphaUnlocks.ecCompletion1.effects.nerf,
      AlphaUnlocks.ecCompletion5.effects.nerf
    ), skipKey);
  }

  if (AlchemyResource.exponential.amount > 0 && ResurgenceUpgrade.repSurge.isBought && !player.disablePostReality) {
    ip = orderedPowerStep(steps, "replicantiSurge", ip, ReplicantiMultipliers.ipPow, skipKey);
  }

  if (Ascensions.ipA.isUnlocked) {
    ip = orderedPowerStep(steps, "ascensionIPPower", ip, InfinityUpgrade.ipMult.effectOrDefault(1), skipKey);
  }

  if (ResurgenceUpgrade.ipSurge.isBought && !player.disablePostReality) {
    ip = orderedTransformStep(steps, "ipSurge", "hardcap", ip, ip.min(player.antimatter), skipKey, {
      display: `Capped to Antimatter (${format(player.antimatter, 2, 2)})`
    });
  }

  if (skipKey !== "floor") {
    const floored = ip.floor();
    if (steps) addOrderedTransform(steps, "floor", "floor", ip, floored);
    ip = floored;
  }
  return ip;
}

function buildInfinityPointBreakdown() {
  const steps = {};
  if (!Player.canCrunch) return steps;

  const finalWith = evaluateInfinityPoints(null, steps);
  addOrderedFinalImpacts(steps, evaluateInfinityPoints, finalWith);
  addOrderedTraceMismatch(
    steps,
    finalWith,
    gainedInfinityPoints(),
    "Breakdown differs from the current IP gain formula"
  );
  return steps;
}

const ipTransform = createOrderedTransformCache(buildInfinityPointBreakdown);

export const InfinityPointBreakdown = {
  transform: key => ipTransform(key),
  baseAt308: () => ipFromDivisor(308),
  divisors: () => ipDivisors(),
  timeStudyMult: () => ipTimeStudyMult(),
  achievementMult: () => ipAchievementMult(),
  dilationUpgradeMult: () => ipDilationUpgradeMult(),
  glyphMult: () => ipGlyphMult(),
  infinityUpgradeMult: () => ipInfinityUpgradeMult(),
  replicantiMult: () => ipReplicantiMult(),
};
