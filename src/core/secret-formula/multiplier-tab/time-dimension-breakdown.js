import {
  addOrderedFinalImpacts,
  addOrderedTraceMismatch,
  addOrderedTransform,
  aggregateOrderedTransforms,
  createOrderedTransformCache,
  orderedMultiplyStep,
  orderedPowerStep,
  orderedTransformStep,
} from "./ordered-breakdown";

function valueOf(effect) {
  return new Decimal(typeof effect === "function" ? effect() : effect);
}

function multiplyGroup(steps, key, current, items, skipKey, display = undefined) {
  if (skipKey === key) return current;
  const before = current;
  let value = current;
  for (const item of items) {
    if (item.items) {
      value = multiplyGroup(steps, item.key, value, item.items, skipKey, item.display);
      continue;
    }
    if (skipKey === item.key) continue;
    const mult = valueOf(item.value);
    const after = value.times(mult);
    if (steps) addOrderedTransform(steps, item.key, "multiply", value, after, { value: mult, display: item.display });
    value = after;
  }
  if (steps) {
    const factor = before.eq(0) ? DC.D1 : value.div(before);
    addOrderedTransform(steps, key, "multiply", before, value, { value: factor, display });
  }
  return value;
}

function powerGroup(steps, key, current, items, skipKey, display = undefined) {
  if (skipKey === key) return current;
  const before = current;
  let value = current;
  let combinedPower = DC.D1;
  for (const item of items) {
    if (skipKey === item.key) continue;
    const power = valueOf(item.value);
    const after = value.pow(power);
    if (steps) addOrderedTransform(steps, item.key, "power", value, after, { value: power, display: item.display });
    value = after;
    combinedPower = combinedPower.times(power);
  }
  if (steps) addOrderedTransform(steps, key, "power", before, value, { value: combinedPower, display });
  return value;
}

function ec9InfinityPowerMult() {
  if (!EternityChallenge(9).isRunning) return DC.D1;
  return Decimal.pow(
    Decimal.clampMin(
      Currency.infinityPower.value.pow(InfinityDimensions.powerConversionRate / 7).add(1).log2(),
      1
    ),
    4
  ).clampMin(1);
}

function commonItems() {
  return [
    { key: "commonIAP", value: () => ShopPurchase.allDimPurchases.currentMult },
    {
      key: "commonAchievements",
      items: [
        { key: "achievement105", value: () => Achievement(105).effectOrDefault(1) },
        { key: "achievement128", value: () => Achievement(128).effectOrDefault(1) },
      ]
    },
    {
      key: "commonTimeStudies",
      items: [
        { key: "timeStudy93", value: () => TimeStudy(93).effectOrDefault(1) },
        { key: "timeStudy103", value: () => TimeStudy(103).effectOrDefault(1) },
        { key: "timeStudy151", value: () => TimeStudy(151).effectOrDefault(1) },
        { key: "timeStudy221", value: () => TimeStudy(221).effectOrDefault(1) },
        { key: "timeStudy301", value: () => TimeStudy(301).effectOrDefault(1) },
      ]
    },
    {
      key: "commonEternityChallenges",
      items: [
        { key: "eternityChallenge1", value: () => EternityChallenge(1).reward.effectOrDefault(1) },
        { key: "eternityChallenge10", value: () => EternityChallenge(10).reward.effectOrDefault(1) },
      ]
    },
    {
      key: "commonEternityUpgrades",
      items: [
        { key: "eternityUpgradeAchievements", value: () => EternityUpgrade.tdMultAchs.effectOrDefault(1) },
        { key: "eternityUpgradeTheorems", value: () => EternityUpgrade.tdMultTheorems.effectOrDefault(1) },
        { key: "eternityUpgradeRealTime", value: () => EternityUpgrade.tdMultRealTime.effectOrDefault(1) },
      ]
    },
    {
      key: "commonRealityUpgrade",
      value: () => (Pelle.isDoomed && !PelleRealityUpgrade.temporalTranscendence.canBeApplied
        ? DC.D1
        : RealityUpgrade(22).effectOrDefault(1))
    },
    { key: "commonAlchemy", value: () => AlchemyResource.dimensionality.effectOrDefault(1) },
    { key: "commonPelle", value: () => PelleRifts.chaos.effectOrDefault(1) },
    { key: "commonReplicanti", value: () => ReplicantiMultipliers.tdMult },
    { key: "ec9InfinityPower", value: ec9InfinityPowerMult },
    { key: "commonNull", value: () => (LHC.voidRunning ? NullUpgrade.timeDimensionMult.effectOrDefault(1) : DC.D1) },
  ];
}

function tierItems(tier) {
  return [
    { key: "tierTimeStudy11", value: () => (tier === 1 ? TimeStudy(11).effectOrDefault(1) : DC.D1) },
    {
      key: "tierTimeStudy73",
      value: () => (tier === 3 && !Ascensions.sacA.isUnlocked ? TimeStudy(73).effectOrDefault(1) : DC.D1)
    },
    { key: "tierTimeStudy227", value: () => (tier === 4 ? TimeStudy(227).effectOrDefault(1) : DC.D1) },
  ];
}

function usesContinuum() {
  return Laitela.continuumActive && Alpha.currentStage >= 17 && !player.disablePostReality;
}

function purchaseValue(tier) {
  const dim = TimeDimension(tier);
  let bought = usesContinuum() ? dim.continuumValue : new Decimal(dim.bought);
  if (tier === 8 && (player.disablePostReality || Alpha.currentStage < 12)) {
    bought = Decimal.clampMax(bought, 1e8).times(Laitela.matterExtraPurchaseFactor);
  }
  return bought;
}

function purchaseDisplay(tier) {
  const count = purchaseValue(tier);
  return usesContinuum()
    ? `Continuum: ${format(count, 2, 2)} effective purchases`
    : `${format(count, 2, 2)} purchases`;
}

function basePowerMultiplier(tier) {
  if (Alpha.isRunning) return new Decimal(AlphaUnlocks.eternity.effects.nerf.effectOrDefault(4));
  if (!player.disablePostReality) return new Decimal(AlphaUnlocks.timeDimension4.effects.buff.effectOrDefault(4));
  return DC.D4;
}

function applyPurchase(steps, tier, current, skipKey) {
  if (skipKey === "purchase") return current;

  const count = purchaseValue(tier);
  const rawBase = skipKey === "purchaseBase" ? DC.D1 : basePowerMultiplier(tier);
  const glyph = skipKey === "purchaseGlyphSacrifice" || tier !== 8
    ? DC.D1
    : GlyphSacrifice.time.effectValue;
  const imaginaryPow = skipKey === "purchaseImaginaryPower" ? DC.D1 : ImaginaryUpgrade(14).effectOrDefault(1);
  const singularityPow = skipKey === "purchaseSingularityPower"
    ? DC.D1
    : SingularityMilestone.perPurchaseDimMult.effectOrDefault(1);

  let factor = DC.D1;
  const baseAfter = factor.times(Decimal.pow(rawBase, count));
  if (steps) addOrderedTransform(steps, "purchaseBase", "multiply", factor, baseAfter, {
    value: Decimal.pow(rawBase, count),
    display: `${format(count, 2, 2)} × ${formatX(rawBase, 2, 2)} per purchase`
  });
  factor = baseAfter;

  const glyphAfter = factor.times(Decimal.pow(glyph, count));
  if (steps) addOrderedTransform(steps, "purchaseGlyphSacrifice", "multiply", factor, glyphAfter, {
    value: Decimal.pow(glyph, count)
  });
  factor = glyphAfter;

  const imaginaryAfter = factor.pow(imaginaryPow);
  if (steps) addOrderedTransform(steps, "purchaseImaginaryPower", "power", factor, imaginaryAfter, {
    value: imaginaryPow
  });
  factor = imaginaryAfter;

  const singularityAfter = factor.pow(singularityPow);
  if (steps) addOrderedTransform(steps, "purchaseSingularityPower", "power", factor, singularityAfter, {
    value: singularityPow
  });
  factor = singularityAfter;

  const after = current.times(factor);
  if (steps) addOrderedTransform(steps, "purchase", "multiply", current, after, {
    value: factor,
    display: purchaseDisplay(tier)
  });
  return after;
}

function preDilationPowers() {
  return [
    { key: "glyphTimePower", value: () => getAdjustedGlyphEffect("timepow") },
    { key: "glyphEffarigPower", value: () => getAdjustedGlyphEffect("effarigdimensions") },
    { key: "glyphCursedPower", value: () => getAdjustedGlyphEffect("curseddimensions") },
    { key: "alchemyTimePower", value: () => AlchemyResource.time.effectOrDefault(1) },
    { key: "raMomentumPower", value: () => Ra.momentumValue },
    { key: "imaginaryPower", value: () => ImaginaryUpgrade(11).effectOrDefault(1) },
    { key: "pelleParadoxPower", value: () => PelleRifts.paradox.effectOrDefault(1) },
    { key: "singularityDimensionPower", value: () => SingularityMilestone.dimensionPow.effectOrDefault(1) },
    { key: "raTimeTheoremPower", value: () => Ra.unlocks.allDimPowTT.effectOrDefault(1) },
    {
      key: "pellePackPower",
      value: () => (ExpansionPack.pellePack.isBought && !player.disablePostReality
        ? Decimal.pow(Decimal.log10(player.records.bestEndgame.galaxies).div(100), 1.5).add(1)
        : DC.D1)
    },
  ];
}

function postDilationPowers(tier) {
  return [
    {
      key: "ascensionTimeStudy73Power",
      value: () => (tier === 3 && Ascensions.sacA.isUnlocked ? TimeStudy(73).effectOrDefault(1) : DC.D1)
    },
    { key: "breakEternityPower", value: () => BreakEternityUpgrade.infinityDimensionPow.effectOrDefault(1) },
    {
      key: "alphaEC5Power",
      value: () => (!player.disablePostReality ? AlphaUnlocks.ecCompletion5.effects.buff.effectOrDefault(1) : DC.D1)
    },
    {
      key: "alphaTier8Power",
      value: () => (tier === 8 && !player.disablePostReality
        ? AlphaUnlocks.timeDimension8.effects.buff.effectOrDefault(1)
        : DC.D1)
    },
    {
      key: "replicantiSurgePower",
      value: () => (DilationUpgrade.tdMultReplicanti.isBought && ResurgenceUpgrade.repSurge.isBought &&
        !player.disablePostReality ? ReplicantiMultipliers.tdPow : DC.D1)
    },
    {
      key: "achievementSurgePower",
      value: () => (ResurgenceUpgrade.achSurge.isBought && !player.disablePostReality
        ? Achievements.powerConv(EternityUpgrade.tdMultAchs.effectOrDefault(1))
        : DC.D1)
    },
  ];
}

function overflow(value, threshold, magnitude) {
  if (value.lt(threshold)) return value;
  const thresholdLog = Decimal.log10(threshold);
  return Decimal.pow10(
    Decimal.pow(value.log10().div(thresholdLog), new Decimal(1).div(magnitude)).times(thresholdLog)
  );
}

function hasAlphaProductionBypass(tier) {
  const dim = TimeDimension(tier);
  return tier === dim.highestProducingDimension && Alpha.isRunning && Alpha.currentStage >= 14 &&
    Alpha.currentStage < 23;
}

function evaluateTimeDimension(tier, skipKey = null, steps = null) {
  const dim = TimeDimension(tier);
  if (!dim.isProducing) return DC.D0;

  const amount = dim.totalAmount;
  if (steps) addOrderedTransform(steps, "base", "formula", DC.D1, amount, {
    alwaysShow: true,
    display: `TD ${tier} amount: ${format(amount, 2, 2)}`
  });

  if (EternityChallenge(11).isRunning) {
    if (steps) addOrderedTransform(steps, "ec11Override", "override", amount, amount, {
      alwaysShow: true,
      display: "EC11 bypasses all TD multipliers"
    });
    return amount;
  }

  if (hasAlphaProductionBypass(tier)) {
    if (steps) addOrderedTransform(steps, "alphaProductionBypass", "override", amount, amount, {
      alwaysShow: true,
      display: "Alpha stage bypasses the highest TD multiplier"
    });
    return amount;
  }

  let mult = DC.D1;
  mult = multiplyGroup(steps, "common", mult, commonItems(), skipKey);
  mult = multiplyGroup(steps, "tierEffects", mult, tierItems(tier), skipKey);
  mult = applyPurchase(steps, tier, mult, skipKey);
  mult = powerGroup(steps, "preDilationPowers", mult, preDilationPowers(), skipKey);

  if (player.dilation.active || (PelleStrikes.dilation.hasStrike && !PelleStrikes.dilation.isDestroyed())) {
    mult = orderedTransformStep(steps, "dilation", "softcap", mult, dilatedValueOf(mult), skipKey);
  }

  if (Effarig.isRunning) {
    mult = orderedTransformStep(steps, "effarig", "softcap", mult, Effarig.multiplier(mult), skipKey);
  } else if (V.isRunning) {
    mult = orderedPowerStep(steps, "vNerf", mult, 0.5, skipKey);
  }

  mult = powerGroup(steps, "postDilationPowers", mult, postDilationPowers(tier), skipKey);

  mult = orderedTransformStep(
    steps,
    "ethereal",
    "softcap",
    mult,
    dilateMultiplier(mult, EtherealStars.purple.reward),
    skipKey,
    { display: `Ethereal Stars: ${format(EtherealStars.purple.reward, 3, 3)}` }
  );

  if (player.endgame.overcharge.isRunning) {
    const overchargePower = Math.pow(0.72, player.endgame.overcharge.level);
    mult = orderedTransformStep(
      steps,
      "overcharge",
      "softcap",
      mult,
      dilateMultiplier(mult, overchargePower),
      skipKey,
      { display: `Overcharge level ${formatInt(player.endgame.overcharge.level)}` }
    );
  }

  const overflow1 = overflow(mult, TimeDimensions.OVERFLOW, TimeDimensions.compressionMagnitude);
  mult = orderedTransformStep(steps, "overflow1", "softcap", mult, overflow1, skipKey, {
    display: `Overflow at ${format(TimeDimensions.OVERFLOW, 2, 2)}`
  });

  const overflow2 = overflow(mult, TimeDimensions.OVERFLOW_SQUARED, TimeDimensions.compressionMag2);
  mult = orderedTransformStep(steps, "overflow2", "softcap", mult, overflow2, skipKey, {
    display: `Second overflow at ${format(TimeDimensions.OVERFLOW_SQUARED, 2, 2)}`
  });

  let production = amount.times(mult);
  if (EternityChallenge(7).isRunning) {
    production = orderedMultiplyStep(
      steps, "tickspeed", production, Tickspeed.perSecond, skipKey, "EC7 production rate"
    );
  }
  if (tier === 1 && !EternityChallenge(7).isRunning) {
    production = orderedPowerStep(
      steps,
      "timeShardGlyphPower",
      production,
      getAdjustedGlyphEffect("timeshardpow"),
      skipKey
    );
  }
  return production;
}

function buildTimeDimensionBreakdown(tier) {
  const steps = {};
  const dim = TimeDimension(tier);
  if (!dim.isProducing) return steps;
  const finalWith = evaluateTimeDimension(tier, null, steps);
  addOrderedFinalImpacts(
    steps,
    key => evaluateTimeDimension(tier, key),
    finalWith,
    ["base", "ec11Override", "alphaProductionBypass"]
  );
  addOrderedTraceMismatch(
    steps,
    finalWith,
    dim.productionPerSecond,
    `Breakdown differs from TD ${tier} production`
  );
  return steps;
}

const caches = Array.from({ length: 9 }, (_, tier) => (tier === 0
  ? null
  : createOrderedTransformCache(() => buildTimeDimensionBreakdown(tier))));

function buildAggregateBreakdown() {
  const traces = [];
  for (let tier = 1; tier <= 8; tier++) {
    const dim = TimeDimension(tier);
    if (!dim.isProducing) continue;
    traces.push({ tier, trace: caches[tier]() });
  }

  const keys = new Set();
  for (const { trace } of traces) {
    for (const key of Object.keys(trace)) keys.add(key);
  }

  const aggregate = {};
  for (const key of keys) {
    const items = traces.map(item => ({ tier: item.tier, transform: item.trace[key] ?? null }));
    const direct = aggregateOrderedTransforms(items, "TD", false);
    if (!direct) continue;
    // Direct requires only the existing trace. The full cross-tier Final
    // counterfactual is computed once, and only when a visible row needs it.
    let final;
    const getFinal = () => {
      if (!final) final = aggregateOrderedTransforms(items, "TD", true);
      return final;
    };
    Object.defineProperties(direct, {
      finalWith: { enumerable: true, get: () => getFinal().finalWith },
      finalWithout: { enumerable: true, get: () => getFinal().finalWithout }
    });
    aggregate[key] = direct;
  }
  return aggregate;
}

const aggregateCache = createOrderedTransformCache(buildAggregateBreakdown);

export const TimeDimensionBreakdown = {
  transform: (tier, key) => caches[tier]?.(key) ?? null,
  aggregateTransform: key => aggregateCache(key),
  summary: tier => {
    const dim = TimeDimension(tier);
    if (!dim.isProducing) return null;
    return {
      type: "formula",
      before: DC.D1,
      after: dim.productionPerSecond,
      display: `${format(dim.productionPerSecond, 2, 2)}/sec`,
      alwaysShow: true,
    };
  },
  totalSummary: () => {
    const dim = TimeDimension(1);
    const after = dim.isProducing ? dim.productionPerSecond : DC.D1;
    return { type: "formula", before: DC.D1, after, alwaysShow: true };
  },
  purchaseDisplay,
  usesContinuum,
};
