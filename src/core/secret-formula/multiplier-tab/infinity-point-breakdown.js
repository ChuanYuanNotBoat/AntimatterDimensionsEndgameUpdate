function ipPositivePowers() {
  let value = DC.D1;
  if ((Pelle.isDoomed && PelleCelestialUpgrade.raTeresa3.canBeApplied) || GlyphAlteration.isAdded("infinity")) {
    value = value.times(getSecondaryGlyphEffect("infinityIP"));
  }
  if (EndgameMastery(141).isBought) value = value.timesEffectsOf(EndgameMastery(141));
  if (!player.disablePostReality) value = value.times(AlphaUnlocks.infinity.effects.buff.effectOrDefault(1));
  if (AlchemyResource.exponential.amount > 0 && ResurgenceUpgrade.repSurge.isBought && !player.disablePostReality) {
    value = value.times(ReplicantiMultipliers.ipPow);
  }
  if (Ascensions.ipA.isUnlocked) value = value.timesEffectOf(InfinityUpgrade.ipMult);
  return value;
}

function ipDivisors() {
  const improved = new Decimal(Effects.min(
    308,
    Achievement(103),
    TimeStudy(111),
    EndgameMastery(151)
  ));
  const final = Decimal.max(improved, ipPositivePowers().times(2));
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

function addTransform(steps, key, type, before, after, options = {}) {
  const transform = {
    type,
    before: new Decimal(before),
    after: new Decimal(after),
  };
  if (options.value !== undefined) transform.value = options.value;
  if (options.display !== undefined) transform.display = options.display;
  if (options.alwaysShow !== undefined) transform.alwaysShow = options.alwaysShow;
  steps[key] = transform;
  return transform.after;
}

function multiplyTransform(steps, key, current, multiplier, display) {
  const value = new Decimal(multiplier);
  return addTransform(steps, key, "multiply", current, current.times(value), { value, display });
}

function powerTransform(steps, key, current, power, display) {
  const value = new Decimal(power);
  return addTransform(steps, key, "power", current, current.pow(value), { value, display });
}

function buildInfinityPointBreakdown() {
  const steps = {};
  if (!Player.canCrunch) return steps;

  const divisors = ipDivisors();

  const baseAt308 = ipFromDivisor(308);
  let ip = addTransform(steps, "base", "formula", DC.D1, baseAt308, { alwaysShow: true });

  const improvedBase = ipFromDivisor(divisors.improved.toNumber());
  ip = addTransform(steps, "divisor", "formula", ip, improvedBase, {
    display: `Formula divisor ${format(308, 0)} ➜ ${format(divisors.improved, 2, 2)}`
  });

  const finalBase = ipFromDivisor(divisors.formulaFinal);
  ip = addTransform(steps, "powerCompensation", "softcap", ip, finalBase, {
    display: `Formula divisor ${format(divisors.improved, 2, 2)} ➜ ${format(divisors.final, 2, 2)}`
  });

  if (Pelle.isDisabled("IPMults")) {
    ip = multiplyTransform(steps, "pelle", ip, DC.D1.timesEffectsOf(PelleRifts.vacuum));
    ip = multiplyTransform(steps, "pelleGlyph", ip, Pelle.specialGlyphEffect.infinity);
    ip = multiplyTransform(steps, "timeStudy", ip, ipTimeStudyMult());
    ip = multiplyTransform(steps, "achievement", ip, ipAchievementMult());
    ip = multiplyTransform(steps, "infinityUpgrade", ip, ipInfinityUpgradeMult());
    ip = multiplyTransform(steps, "dilationUpgrade", ip, ipDilationUpgradeMult());
    ip = multiplyTransform(steps, "glyph", ip, ipGlyphMult());
    ip = multiplyTransform(steps, "alchemy", ip, ipReplicantiMult());

    if (PelleCelestialUpgrade.raTeresa3.canBeApplied) {
      ip = powerTransform(steps, "glyphPower", ip, getSecondaryGlyphEffect("infinityIP"));
    }
    if (EndgameMastery(141).isBought) {
      ip = powerTransform(steps, "endgameMastery141", ip, EndgameMastery(141).effectOrDefault(1));
    }
    if (!player.disablePostReality) {
      ip = powerTransform(steps, "alphaPower", ip, AlphaUnlocks.infinity.effects.buff.effectOrDefault(1));
    }
    if (AlchemyResource.exponential.amount > 0 && ResurgenceUpgrade.repSurge.isBought && !player.disablePostReality) {
      ip = powerTransform(steps, "replicantiSurge", ip, ReplicantiMultipliers.ipPow);
    }
    if (Ascensions.ipA.isUnlocked) {
      ip = powerTransform(steps, "ascensionIPPower", ip, InfinityUpgrade.ipMult.effectOrDefault(1));
    }

    ip = addTransform(steps, "floor", "floor", ip, ip.floor());
    addTransform(steps, "traceMismatch", "override", ip, gainedInfinityPoints(), {
      display: "Breakdown differs from the current IP gain formula"
    });
    return steps;
  }

  if (Effarig.isRunning && Effarig.currentStage === EFFARIG_STAGES.ETERNITY) {
    ip = addTransform(steps, "effarigCap", "hardcap", ip, ip.min(DC.E200), {
      display: `Hardcap at ${format(DC.E200, 2, 2)}`
    });
  }

  // totalIPMult() is overridden to 1 during Effarig Infinity, so none of its component multipliers are applied there.
  const totalMultDisabled = Effarig.isRunning && Effarig.currentStage === EFFARIG_STAGES.INFINITY;
  if (!totalMultDisabled) {
    ip = multiplyTransform(steps, "iap", ip, ShopPurchase.IPPurchases.currentMult);
    ip = multiplyTransform(steps, "timeStudy", ip, normalTimeStudyMult());
    ip = multiplyTransform(steps, "achievement", ip, normalAchievementMult());
    ip = multiplyTransform(steps, "dilationUpgrade", ip, DilationUpgrade.ipMultDT.effectOrDefault(1));
    ip = multiplyTransform(steps, "glyph", ip, getAdjustedGlyphEffect("infinityIP"));
    if (!Ascensions.ipA.isUnlocked) {
      ip = multiplyTransform(steps, "infinityUpgrade", ip, InfinityUpgrade.ipMult.effectOrDefault(1));
    }
    if (Replicanti.areUnlocked) {
      ip = multiplyTransform(steps, "alchemy", ip, ReplicantiMultipliers.ipMult);
    }
    if (LHC.voidRunning) {
      ip = multiplyTransform(steps, "nullUpgrade", ip, NullUpgrade.infinityPointMult.effectOrDefault(1));
    }
  }

  if (Teresa.isRunning) {
    ip = powerTransform(steps, "nerfTeresa", ip, 0.55);
  } else if (V.isRunning) {
    ip = powerTransform(steps, "nerfV", ip, 0.5);
  } else if (Laitela.isRunning) {
    ip = addTransform(steps, "nerfLaitela", "softcap", ip, dilatedValueOf(ip));
  }

  if (GlyphAlteration.isAdded("infinity")) {
    ip = powerTransform(steps, "glyphPower", ip, getSecondaryGlyphEffect("infinityIP"));
  }
  if (EndgameMastery(141).isBought) {
    ip = powerTransform(steps, "endgameMastery141", ip, EndgameMastery(141).effectOrDefault(1));
  }
  if (!player.disablePostReality) {
    ip = powerTransform(steps, "alphaPower", ip, AlphaUnlocks.infinity.effects.buff.effectOrDefault(1));
  }

  if (Alpha.isRunning && Alpha.currentStage < 12) {
    ip = powerTransform(steps, "alphaStageNerf", ip,
      AlphaUnlocks.infinityDimensions.effects.nerf.effectOrDefault(1));
  }

  const topTier = Alpha.currentStage >= 18 ? 1 : 0;
  if (Alpha.isRunning && player.challenge.eternity.current > topTier) {
    ip = powerTransform(steps, "alphaECNerf", ip, Effects.min(
      1,
      AlphaUnlocks.eternityChallengeUnlock.effects.nerf,
      AlphaUnlocks.ecCompletion1.effects.nerf,
      AlphaUnlocks.ecCompletion5.effects.nerf
    ));
  }

  if (AlchemyResource.exponential.amount > 0 && ResurgenceUpgrade.repSurge.isBought && !player.disablePostReality) {
    ip = powerTransform(steps, "replicantiSurge", ip, ReplicantiMultipliers.ipPow);
  }

  if (Ascensions.ipA.isUnlocked) {
    ip = powerTransform(steps, "ascensionIPPower", ip, InfinityUpgrade.ipMult.effectOrDefault(1));
  }

  if (ResurgenceUpgrade.ipSurge.isBought && !player.disablePostReality) {
    ip = addTransform(steps, "ipSurge", "hardcap", ip, ip.min(player.antimatter), {
      display: `Capped to Antimatter (${format(player.antimatter, 2, 2)})`
    });
  }

  ip = addTransform(steps, "floor", "floor", ip, ip.floor());
  addTransform(steps, "traceMismatch", "override", ip, gainedInfinityPoints(), {
    display: "Breakdown differs from the current IP gain formula"
  });
  return steps;
}

let cachedIPBreakdown = {};
let cachedIPBreakdownAt = -1;

function ipTransform(key) {
  // A single UI update requests every IP entry independently. Cache for the current millisecond so the full formula
  // is normally replayed once per render instead of once per row, without holding stale data across game ticks.
  const now = Date.now();
  if (cachedIPBreakdownAt !== now) {
    cachedIPBreakdownAt = now;
    cachedIPBreakdown = buildInfinityPointBreakdown();
  }
  return cachedIPBreakdown[key] ?? null;
}


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
