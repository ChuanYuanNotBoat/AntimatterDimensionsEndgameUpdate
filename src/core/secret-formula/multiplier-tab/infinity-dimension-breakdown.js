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

function commonItems() {
  return [
    { key: "commonIAP", value: () => ShopPurchase.allDimPurchases.currentMult },
    {
      key: "commonAchievements",
      items: [
        { key: "achievement63", value: () => Achievement(63).effectOrDefault(1) },
        { key: "achievement75", value: () => Achievement(75).effectOrDefault(1) },
        { key: "achievement77", value: () => Achievement(77).effectOrDefault(1) },
      ]
    },
    {
      key: "commonTimeStudies",
      items: [
        { key: "timeStudy82", value: () => TimeStudy(82).effectOrDefault(1) },
        { key: "timeStudy92", value: () => TimeStudy(92).effectOrDefault(1) },
        { key: "timeStudy162", value: () => TimeStudy(162).effectOrDefault(1) },
      ]
    },
    {
      key: "commonInfinityChallenges",
      items: [
        { key: "infinityChallenge1", value: () => InfinityChallenge(1).reward.effectOrDefault(1) },
        { key: "infinityChallenge6", value: () => InfinityChallenge(6).reward.effectOrDefault(1) },
      ]
    },
    {
      key: "commonEternityChallenges",
      items: [
        { key: "eternityChallenge4", value: () => EternityChallenge(4).reward.effectOrDefault(1) },
        { key: "eternityChallenge9", value: () => EternityChallenge(9).reward.effectOrDefault(1) },
      ]
    },
    {
      key: "commonEternityUpgrades",
      items: [
        { key: "eternityUpgradeEP", value: () => EternityUpgrade.idMultEP.effectOrDefault(1) },
        { key: "eternityUpgradeEternities", value: () => EternityUpgrade.idMultEternities.effectOrDefault(1) },
        { key: "eternityUpgradeICRecords", value: () => EternityUpgrade.idMultICRecords.effectOrDefault(1) },
      ]
    },
    { key: "commonAlchemy", value: () => AlchemyResource.dimensionality.effectOrDefault(1) },
    { key: "commonImaginary", value: () => ImaginaryUpgrade(8).effectOrDefault(1) },
    { key: "commonPelle", value: () => PelleRifts.recursion.milestones[1].effectOrDefault(1) },
    {
      key: "commonReplicanti",
      value: () => (Replicanti.areUnlocked && Replicanti.amount.gt(1) ? ReplicantiMultipliers.idMult : DC.D1)
    },
    {
      key: "commonNull",
      value: () => (LHC.voidRunning ? NullUpgrade.infinityDimensionMult.effectOrDefault(1) : DC.D1)
    },
  ];
}

function tierItems(tier) {
  return [
    { key: "tierAchievement94", value: () => (tier === 1 ? Achievement(94).effectOrDefault(1) : DC.D1) },
    {
      key: "tierTimeStudy72",
      value: () => (tier === 4 && !Ascensions.sacA.isUnlocked ? TimeStudy(72).effectOrDefault(1) : DC.D1)
    },
    { key: "tierEC2", value: () => (tier === 1 ? EternityChallenge(2).reward.effectOrDefault(1) : DC.D1) },
  ];
}

function usesContinuum(tier) {
  return Laitela.continuumActive && !EternityChallenge(8).isRunning && Alpha.currentStage >= 9 &&
    !player.disablePostReality;
}

function purchaseValue(tier) {
  return usesContinuum(tier)
    ? InfinityDimension(tier).continuumValue
    : Decimal.floor(InfinityDimension(tier).baseAmount.div(10));
}

function purchaseDisplay(tier) {
  const count = purchaseValue(tier);
  return usesContinuum(tier)
    ? `Continuum: ${format(count, 2, 2)} effective purchases`
    : `${format(count, 2, 2)} purchases`;
}

function applyPurchase(steps, tier, current, skipKey) {
  if (skipKey === "purchase") return current;

  const dim = InfinityDimension(tier);
  const count = purchaseValue(tier);
  const rawBase = skipKey === "purchaseBase" ? DC.D1 : new Decimal(dim._powerMultiplier);
  const glyph = skipKey === "purchaseGlyphSacrifice" || tier !== 8
    ? DC.D1
    : GlyphSacrifice.infinity.effectValue;
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
    { key: "glyphInfinityPower", value: () => getAdjustedGlyphEffect("infinitypow") },
    { key: "glyphEffarigPower", value: () => getAdjustedGlyphEffect("effarigdimensions") },
    { key: "glyphCursedPower", value: () => getAdjustedGlyphEffect("curseddimensions") },
    { key: "alchemyInfinityPower", value: () => AlchemyResource.infinity.effectOrDefault(1) },
    { key: "raMomentumPower", value: () => Ra.momentumValue },
    { key: "pelleParadoxPower", value: () => PelleRifts.paradox.effectOrDefault(1) },
    { key: "singularityDimensionPower", value: () => SingularityMilestone.dimensionPow.effectOrDefault(1) },
    { key: "raTimeTheoremPower", value: () => Ra.unlocks.allDimPowTT.effectOrDefault(1) },
    { key: "raInfinityDimensionPower", value: () => Ra.unlocks.infinityDimPower.effectOrDefault(1) },
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
      key: "ascensionTimeStudy72Power",
      value: () => (tier === 4 && Ascensions.sacA.isUnlocked ? TimeStudy(72).effectOrDefault(1) : DC.D1)
    },
    { key: "breakEternityPower", value: () => BreakEternityUpgrade.infinityDimensionPow.effectOrDefault(1) },
    {
      key: "alphaTier8Power",
      value: () => (tier === 8 && !player.disablePostReality
        ? AlphaUnlocks.infinityDimensions.effects.buff.effectOrDefault(1)
        : DC.D1)
    },
    {
      key: "alphaTier1Power",
      value: () => (tier === 1 && !player.disablePostReality
        ? AlphaUnlocks.eternityUpgrades.effects.buff.effectOrDefault(1)
        : DC.D1)
    },
    {
      key: "alphaNerfPower",
      value: () => (Alpha.isRunning ? AlphaUnlocks.eternityUpgrades.effects.nerf.effectOrDefault(1) : DC.D1)
    },
    { key: "dualityPower", value: () => DualityUpgrade(8).effectOrDefault(1) },
    {
      key: "replicantiSurgePower",
      value: () => (Replicanti.areUnlocked && ResurgenceUpgrade.repSurge.isBought && !player.disablePostReality
        ? ReplicantiMultipliers.idPow
        : DC.D1)
    },
    {
      key: "achievementSurgePower",
      value: () => (ResurgenceUpgrade.achSurge.isBought && !player.disablePostReality
        ? Achievements.powerConv(Achievement(75).effectOrDefault(1))
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

function evaluateInfinityDimension(tier, skipKey = null, steps = null) {
  const dim = InfinityDimension(tier);
  if (!dim.isProducing) return DC.D0;

  const amount = dim.totalAmount;
  if (steps) addOrderedTransform(steps, "base", "formula", DC.D1, amount, {
    alwaysShow: true,
    display: `ID ${tier} amount: ${format(amount, 2, 2)}`
  });

  if (EternityChallenge(11).isRunning) {
    if (steps) addOrderedTransform(steps, "ec11Override", "override", amount, amount, {
      alwaysShow: true,
      display: "EC11 bypasses all ID multipliers"
    });
    return amount;
  }

  let mult = DC.D1;
  mult = multiplyGroup(steps, "common", mult, commonItems(), skipKey);
  mult = multiplyGroup(steps, "tierEffects", mult, tierItems(tier), skipKey);
  mult = applyPurchase(steps, tier, mult, skipKey);

  if (tier === 1) {
    mult = orderedMultiplyStep(
      steps,
      "decay",
      mult,
      PelleRifts.decay.milestones[0].effectOrDefault(1),
      skipKey
    );
  }

  mult = powerGroup(steps, "preDilationPowers", mult, preDilationPowers(), skipKey);

  if (player.dilation.active || (PelleStrikes.dilation.hasStrike && !PelleStrikes.dilation.isDestroyed())) {
    mult = orderedTransformStep(steps, "dilation", "softcap", mult, dilatedValueOf(mult), skipKey);
  }

  if (Effarig.isRunning) {
    mult = orderedTransformStep(steps, "effarig", "softcap", mult, Effarig.multiplier(mult), skipKey);
  } else if (V.isRunning) {
    mult = orderedPowerStep(steps, "vNerf", mult, 0.5, skipKey);
  }

  if (PelleStrikes.powerGalaxies.hasStrike && !PelleStrikes.powerGalaxies.isDestroyed()) {
    mult = orderedPowerStep(steps, "pelleStrike", mult, 0.5, skipKey);
  }

  mult = powerGroup(steps, "postDilationPowers", mult, postDilationPowers(tier), skipKey);

  mult = orderedTransformStep(
    steps,
    "ethereal",
    "softcap",
    mult,
    dilateMultiplier(mult, EtherealStars.orange.reward),
    skipKey,
    { display: `Ethereal Stars: ${format(EtherealStars.orange.reward, 3, 3)}` }
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

  const overflow1 = overflow(mult, InfinityDimensions.OVERFLOW, InfinityDimensions.compressionMagnitude);
  mult = orderedTransformStep(steps, "overflow1", "softcap", mult, overflow1, skipKey, {
    display: `Overflow at ${format(InfinityDimensions.OVERFLOW, 2, 2)}`
  });

  const overflow2 = overflow(mult, InfinityDimensions.OVERFLOW_SQUARED, InfinityDimensions.compressionMag2);
  mult = orderedTransformStep(steps, "overflow2", "softcap", mult, overflow2, skipKey, {
    display: `Second overflow at ${format(InfinityDimensions.OVERFLOW_SQUARED, 2, 2)}`
  });

  let production = amount.times(mult);
  if (EternityChallenge(7).isRunning) {
    production = orderedMultiplyStep(
      steps, "tickspeed", production, Tickspeed.perSecond, skipKey, "EC7 production rate"
    );
  }
  return production;
}

function buildInfinityDimensionBreakdown(tier) {
  const steps = {};
  const dim = InfinityDimension(tier);
  if (!dim.isProducing) return steps;
  const finalWith = evaluateInfinityDimension(tier, null, steps);
  addOrderedFinalImpacts(steps, key => evaluateInfinityDimension(tier, key), finalWith, ["base", "ec11Override"]);
  addOrderedTraceMismatch(
    steps,
    finalWith,
    dim.productionPerSecond,
    `Breakdown differs from ID ${tier} production`
  );
  return steps;
}

const caches = Array.from({ length: 9 }, (_, tier) => (tier === 0
  ? null
  : createOrderedTransformCache(() => buildInfinityDimensionBreakdown(tier))));

function buildAggregateBreakdown() {
  const traces = [];
  for (let tier = 1; tier <= 8; tier++) {
    const dim = InfinityDimension(tier);
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
    const direct = aggregateOrderedTransforms(items, "ID", false);
    if (!direct) continue;
    // Direct requires only the existing trace. The full cross-tier Final
    // counterfactual is computed once, and only when a visible row needs it.
    let final;
    const getFinal = () => {
      if (!final) final = aggregateOrderedTransforms(items, "ID", true);
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

export const InfinityDimensionBreakdown = {
  transform: (tier, key) => caches[tier]?.(key) ?? null,
  aggregateTransform: key => aggregateCache(key),
  summary: tier => {
    const dim = InfinityDimension(tier);
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
    const dim = InfinityDimension(1);
    const after = dim.isProducing ? dim.productionPerSecond : DC.D1;
    return { type: "formula", before: DC.D1, after, alwaysShow: true };
  },
  purchaseDisplay,
  usesContinuum,
};
