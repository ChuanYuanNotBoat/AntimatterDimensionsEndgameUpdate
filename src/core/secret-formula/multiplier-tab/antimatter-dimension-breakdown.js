import {
  addOrderedTraceMismatch,
  addOrderedTransform,
  aggregateOrderedTransforms,
  createOrderedTransformCache,
  orderedMultiplyStep,
  orderedPowerStep,
} from "./ordered-breakdown";
import { boundedPositivePower } from "../../finite-decimal";

// Keep this ordered source list in sync with src/core/dimensions/antimatter-dimension.js.
// The diagnostic never changes gameplay. It compares the resulting tier multiplier to the real cached multiplier.
// Overall is a product of producing tier multipliers, NOT AM/sec or the highest-tier production proxy.
const common = [
  ["achievementMultiplier", "Achievement power"],
  ["shopDimension", "Shop: AD purchases"],
  ["shopAll", "Shop: all dimensions"],
  ["infinityPower", "Infinity Power conversion"],
  ...["totalAMMult", "currentAMMult", "achievementMult", "slowestChallengeMult"].map(id =>
    [`break${id}`, `Break Infinity: ${id}`]),
  ...["totalTimeMult", "thisInfinityTimeMult"].map(id => [`infinity${id}`, `Infinity upgrade: ${id}`]),
  ...[18, 48, 56, 65, 72, 73, 74, 76, 84, 91, 92].map(id => [`achievement${id}`, `Achievement ${id}`]),
  ...[91, 101, 161, 193].map(id => [`timeStudy${id}`, `Time Study ${id}`]),
  ["infinityChallenge3", "Infinity Challenge 3"],
  ["infinityChallenge3Reward", "Infinity Challenge 3 reward"],
  ["infinityChallenge8", "Infinity Challenge 8 running effect"],
  ["eternityChallenge10", "Eternity Challenge 10"],
  ["alchemyDimensionality", "Alchemy: dimensionality"],
  ["pelleADUpgrade", "Pelle AD upgrade"],
  ["infinityChallenge6", "Infinity Challenge 6 division"],
  ["glyphMultiplier", "Power Glyph multiplier"],
  ["alchemyForce", "Alchemy: Reality Machine force"],
  ["pelleNerf", "Pelle AD penalty"],
  ["alphaNerf", "Alpha AD penalty"],
  ["nullUpgrade", "Null AD upgrade"],
];
const tierEffects = [
  ["tierInfinityUpgrade", "Tier Infinity upgrade"],
  ["breakInfinitiedMult", "Break Infinity: infinitied"],
  ["timeStudy31", "Time Study 31 (infinitied multiplier power)"],
  ["unspentIP", "Unspent IP (AD1)"],
  ["unspentIPCharged", "Charged unspent IP (AD1)"],
  ...[11, 28, 31, 68, 71, 12, 13, 14, 15, 16, 17, 23, 34, 64, 43].map(id =>
    [`achievementTier${id}`, `Achievement ${id}`]),
  ["timeStudy234Multiplier", "Time Study 234 (AD1 multiplier)"],
  ["sacrificeMultiplier", "Sacrifice (AD8 multiplier)"],
  ["timeStudy71Multiplier", "Time Study 71 (multiplier)"],
  ["timeStudy214Multiplier", "Time Study 214 (multiplier)"],
  ["infinityChallenge8Reward", "Infinity Challenge 8 reward"],
];
const powers = [
  ["ic4Nerf", "Infinity Challenge 4 running power"],
  ["ic4Reward", "Infinity Challenge 4 reward"],
  ["glyphPower", "Power Glyph exponent"],
  ["effarigGlyphPower", "Effarig Glyph exponent"],
  ["raMomentum", "Ra momentum"],
  ["tierInfinityCharged", "Charged tier Infinity upgrade"],
  ["infinityTotalTimeCharged", "Charged total-time Infinity upgrade"],
  ["infinityThisTimeCharged", "Charged this-Infinity-time upgrade"],
  ["alchemyPower", "Alchemy: power"],
  ["achievement183", "Achievement 183"],
  ["pelleParadoxPower", "Pelle Paradox"],
  ["singularityPower", "Singularity dimension power"],
  ["raTheoremPower", "Ra Time Theorem power"],
  ...["totalAMMult", "currentAMMult", "infinitiedMult", "achievementMult", "slowestChallengeMult"].map(id =>
    [`breakCharged${id}`, `Charged Break Infinity: ${id}`]),
  ["pellePackPower", "Pelle expansion pack"],
  ["cursedGlyphPower", "Cursed Glyph exponent"],
  ["vPower", "V AD power"],
  ["pelleVPower", "Pelle restored V power"],
  ["pelleStrikePower", "Pelle Infinity strike"],
  ["ascensionDimboostPower", "Ascended Dimboost power"],
  ["ascensionPurchasePower", "Ascended purchase power"],
  ["ascensionSacrificePower", "Ascended sacrifice power"],
  ["timeStudy71Power", "Ascended Time Study 71"],
  ["timeStudy214Power", "Ascended Time Study 214"],
  ["timeStudy234Power", "Ascended Time Study 234"],
];
const voidPowers = [
  ["voidPotency", "Accelerator potency"],
  ["voidEmptiness", "Accelerator emptiness"],
  ["voidEmptinessMilestone", "Emptiness milestone"],
  ["voidCelestialSurge", "Divinity celestial surge"],
  ["voidFinalRebirth", "Divinity final rebirth"],
  ["voidNullParticles", "Null particle power"],
];

export const AD_ORDERED_GROUPS = [
  ["ec11InfinityPower", "EC11 Infinity Power conversion", []],
  ["ec11Dimboost", "EC11 Dimboost", []],
  ["commonEffects", "Common AD multipliers", common],
  ["purchases", "Purchases", []],
  ["dimboost", "Dimboost", []],
  ["tierEffects", "Tier-specific effects", tierEffects],
  ["minimum", "Minimum multiplier", []],
  ["powers", "Pre-dilation powers", powers],
  ["dilationGlyphPower", "Dilation Glyph power", []],
  ["dilation", "Dilation", []],
  ["dilationUpgrade", "Dilation upgrade: AD × DT", []],
  ["effarig", "Effarig reality", []],
  ["vNerf", "V reality", []],
  ["inflation", "Alchemy inflation", []],
  ["breakEternityPower", "Break Eternity AD power", []],
  ["alphaPowerNerf", "Alpha AD exponent nerf", []],
  ["alphaPower", "Alpha AD exponent buff", []],
  ["voidPowers", "Void powers", voidPowers],
  ["achievementSurgePower", "Achievement resurgence", []],
  ["achievement231", "Achievement 231 dilation", []],
  ["etherealStars", "Ethereal Stars: red", []],
  ["overcharge", "Endgame overcharge", []],
  ["traceMismatch", "Untracked AD formula difference", []],
];

export const AD_ORDERED_KEYS = AD_ORDERED_GROUPS.map(group => group[0]);
export const AD_ORDERED_LABELS = Object.fromEntries(AD_ORDERED_GROUPS.flatMap(([key, label, children]) =>
  [[key, label], ...children]));

function trace(tier, skipKey = null, steps = null) {
  if (tier < 1 || tier > 8) return DC.D1;
  let value = DC.D1;
  if (steps) addOrderedTransform(steps, "base", "formula", DC.D1, value, { alwaysShow: true });
  const mul = (key, factor) => { value = orderedMultiplyStep(steps, key, value, factor, skipKey); };
  const pow = (key, exponent) => {
    if (key !== "dilationGlyphPower") {
      value = orderedPowerStep(steps, key, value, exponent, skipKey);
      return;
    }
    // Match the guarded gameplay D-glyph power instead of overflowing the
    // diagnostic trace while the game itself remains representable.
    if (key === skipKey) return;
    const before = value;
    const after = boundedPositivePower(value, exponent);
    value = steps ? addOrderedTransform(steps, key, "power", before, after,
      { value: new Decimal(exponent) }) : after;
  };
  const transform = (key, type, fn, display) => {
    if (skipKey === key) return;
    const before = value;
    const after = fn(before);
    value = steps ? addOrderedTransform(steps, key, type, before, after, { display }) : after;
  };
  const group = (key, fn) => {
    if (skipKey === key) return;
    const before = value;
    fn();
    if (steps) addOrderedTransform(steps, key, "formula", before, value);
  };
  const effect = item => item?.effectOrDefault(1) ?? DC.D1;

  if (NormalChallenge(10).isRunning && tier > 6) return value;
  if (EternityChallenge(11).isRunning) {
    mul("ec11InfinityPower", Currency.infinityPower.value.pow(InfinityDimensions.powerConversionRate).max(1));
    mul("ec11Dimboost", DimBoost.multiplierToNDTier(tier));
    return value;
  }

  group("commonEffects", () => {
    mul("achievementMultiplier", Achievements.power);
    mul("shopDimension", ShopPurchase.dimPurchases.currentMult);
    mul("shopAll", ShopPurchase.allDimPurchases.currentMult);
    if (!EternityChallenge(9).isRunning) {
      mul("infinityPower", Currency.infinityPower.value.pow(InfinityDimensions.powerConversionRate).max(1));
    }
    for (const id of ["totalAMMult", "currentAMMult", "achievementMult", "slowestChallengeMult"]) {
      mul(`break${id}`, effect(BreakInfinityUpgrade[id]));
    }
    for (const id of ["totalTimeMult", "thisInfinityTimeMult"]) mul(`infinity${id}`, effect(InfinityUpgrade[id]));
    for (const id of [18, 48, 56, 65, 72, 73, 74, 76, 84, 91, 92]) {
      mul(`achievement${id}`, effect(Achievement(id)));
    }
    for (const id of [91, 101, 161, 193]) mul(`timeStudy${id}`, effect(TimeStudy(id)));
    mul("infinityChallenge3", effect(InfinityChallenge(3)));
    mul("infinityChallenge3Reward", effect(InfinityChallenge(3).reward));
    mul("infinityChallenge8", effect(InfinityChallenge(8)));
    mul("eternityChallenge10", effect(EternityChallenge(10)));
    mul("alchemyDimensionality", effect(AlchemyResource.dimensionality));
    mul("pelleADUpgrade", effect(PelleUpgrade.antimatterDimensionMult));
    mul("infinityChallenge6", DC.D1.dividedByEffectOf(InfinityChallenge(6)));
    mul("glyphMultiplier", getAdjustedGlyphEffect("powermult"));
    mul("alchemyForce", Currency.realityMachines.value.powEffectOf(AlchemyResource.force));
    if (Pelle.isDoomed && !PelleDestructionUpgrade.disableADNerf.canBeApplied) {
      mul("pelleNerf", DC.D1.div(Currency.antimatter.value.add(1).log10().times(50).max(1)));
    }
    if (Alpha.isRunning) mul("alphaNerf", DC.D1.div(Currency.antimatter.value.add(1).log10().times(125).max(1)));
    if (LHC.voidRunning) mul("nullUpgrade", effect(NullUpgrade.antimatterDimensionMult));
  });

  const purchases = Laitela.continuumActive ? AntimatterDimension(tier).continuumValue
    : Decimal.floor(AntimatterDimension(tier).bought.div(10));
  if (!Ascensions.b10mA.isUnlocked) mul("purchases", Decimal.pow(AntimatterDimensions.buyTenMultiplier, purchases));
  mul("dimboost", DimBoost.multiplierToNDTier(tier));

  group("tierEffects", () => {
    // effectOrDefault() may legitimately return a primitive number when an upgrade is inactive.
    // Gameplay starts this product from DC.D1; normalize the individual factors too, because
    // the analysis needs to recompute the product for TS31 counterfactual attribution.
    const rawTier = new Decimal(effect(AntimatterDimension(tier).infinityUpgrade));
    const rawBreak = new Decimal(effect(BreakInfinityUpgrade.infinitiedMult));
    const tierFactor = skipKey === "tierInfinityUpgrade" ? DC.D1 : rawTier;
    const breakFactor = skipKey === "breakInfinitiedMult" ? DC.D1 : rawBreak;
    mul("tierInfinityUpgrade", rawTier);
    mul("breakInfinitiedMult", rawBreak);
    // The gameplay powers the PRODUCT of the above two multipliers by TS31; only the extra
    // (power - 1) belongs to TS31. Recompute its factor when either source is removed.
    const ts31 = new Decimal(effect(TimeStudy(31)));
    mul("timeStudy31", tierFactor.times(breakFactor).pow(ts31.sub(1)));

    if (tier === 1) {
      mul("unspentIP", effect(InfinityUpgrade.unspentIPMult));
      mul("unspentIPCharged", effect(InfinityUpgrade.unspentIPMult.chargedEffect));
      for (const id of [11, 28, 31, 68, 71]) mul(`achievementTier${id}`, effect(Achievement(id)));
      if (!Ascensions.sacA.isUnlocked) mul("timeStudy234Multiplier", effect(TimeStudy(234)));
    }
    if (tier === 8 && !Ascensions.sacA.isUnlocked) mul("sacrificeMultiplier", Sacrifice.totalBoost);
    for (const [id, applies] of [
      [12, tier === 2], [13, tier >= 3 && tier <= 8], [14, tier === 4],
      [15, tier >= 5 && tier <= 8], [16, tier === 6], [17, tier === 7],
      [23, tier === 8], [34, tier < 8], [64, tier <= 4]
    ]) {
      if (applies) mul(`achievementTier${id}`, effect(Achievement(id)));
    }
    if (tier < 8 && !Ascensions.sacA.isUnlocked) mul("timeStudy71Multiplier", effect(TimeStudy(71)));
    if (tier === 8 && !Ascensions.sacA.isUnlocked) mul("timeStudy214Multiplier", effect(TimeStudy(214)));
    if (tier > 1 && tier < 8) mul("infinityChallenge8Reward", effect(InfinityChallenge(8).reward));
    if (Achievement(43).isUnlocked) mul("achievementTier43", 1 + tier / 100);
  });
  transform("minimum", "hardcap", current => current.clampMin(1));

  group("powers", () => {
    if (InfinityChallenge(4).isRunning && player.postC4Tier !== tier) pow("ic4Nerf", InfinityChallenge(4).effectValue);
    if (InfinityChallenge(4).isCompleted) pow("ic4Reward", InfinityChallenge(4).reward.effectValue);
    pow("glyphPower", getAdjustedGlyphEffect("powerpow"));
    pow("effarigGlyphPower", getAdjustedGlyphEffect("effarigdimensions"));
    pow("raMomentum", Ra.momentumValue);
    pow("tierInfinityCharged", effect(AntimatterDimension(tier).infinityUpgrade.chargedEffect));
    pow("infinityTotalTimeCharged", effect(InfinityUpgrade.totalTimeMult.chargedEffect));
    pow("infinityThisTimeCharged", effect(InfinityUpgrade.thisInfinityTimeMult.chargedEffect));
    pow("alchemyPower", effect(AlchemyResource.power));
    pow("achievement183", effect(Achievement(183)));
    pow("pelleParadoxPower", effect(PelleRifts.paradox));
    pow("singularityPower", effect(SingularityMilestone.dimensionPow));
    pow("raTheoremPower", effect(Ra.unlocks.allDimPowTT));
    for (const id of ["totalAMMult", "currentAMMult", "infinitiedMult", "achievementMult", "slowestChallengeMult"]) {
      pow(`breakCharged${id}`, effect(BreakInfinityUpgrade[id].chargedEffect));
    }
    if (ExpansionPack.pellePack.isBought && !player.disablePostReality) {
      pow("pellePackPower", Decimal.pow(Decimal.log10(player.records.bestEndgame.galaxies).div(100), 1.5).add(1));
    }
    pow("cursedGlyphPower", getAdjustedGlyphEffect("curseddimensions"));
    pow("vPower", effect(VUnlocks.adPow));
    if (Pelle.isDoomed && PelleCelestialUpgrade.vMilestones1.canBeApplied) pow("pelleVPower", VUnlocks.adPow.effectValue);
    if (PelleStrikes.infinity.hasStrike && !PelleStrikes.infinity.isDestroyed()) pow("pelleStrikePower", 0.5);
    if (Ascensions.dbA.isUnlocked) pow("ascensionDimboostPower", DimBoost.powerToND);
    if (Ascensions.b10mA.isUnlocked) {
      const oom = (Laitela.continuumActive ? AntimatterDimension(tier).continuumValue :
        Decimal.floor(AntimatterDimension(tier).bought.div(10))).max(1).log10();
      pow("ascensionPurchasePower", AntimatterDimensions.buyOoMPower.times(oom).add(1));
    }
    if (Ascensions.sacA.isUnlocked && tier === 8) pow("ascensionSacrificePower", Sacrifice.totalPower);
    if (tier < 8 && Ascensions.sacA.isUnlocked) pow("timeStudy71Power", effect(TimeStudy(71)));
    if (tier === 8 && Ascensions.sacA.isUnlocked) pow("timeStudy214Power", effect(TimeStudy(214)));
    if (tier === 1 && Ascensions.sacA.isUnlocked) pow("timeStudy234Power", effect(TimeStudy(234)));
  });

  if (player.dilation.active || (PelleStrikes.dilation.hasStrike && !PelleStrikes.dilation.isDestroyed())) {
    pow("dilationGlyphPower", getAdjustedGlyphEffect("dilationpow"));
    transform("dilation", "softcap", current => dilatedValueOf(current));
  } else if (Enslaved.isRunning) {
    transform("dilation", "softcap", current => dilatedValueOf(current));
  }
  mul("dilationUpgrade", effect(DilationUpgrade.ndMultDT));
  if (Effarig.isRunning) transform("effarig", "formula", current => Effarig.multiplier(current));
  else if (V.isRunning) pow("vNerf", 0.5);
  if (AlchemyResource.inflation.isUnlocked && value.gte(AlchemyResource.inflation.effectValue)) pow("inflation", 1.05);
  pow("breakEternityPower", effect(BreakEternityUpgrade.antimatterDimensionPow));
  if (Alpha.isRunning) pow("alphaPowerNerf", effect(AlphaUnlocks.timestudy181.effects.nerf));
  if (!player.disablePostReality) pow("alphaPower", effect(AlphaUnlocks.timestudy181.effects.buff));

  if (LHC.voidRunning) group("voidPowers", () => {
    pow("voidPotency", effect(Accelerators.potency._milestones[0]));
    pow("voidEmptiness", Accelerators.emptiness.effectValue1);
    pow("voidEmptinessMilestone", effect(Accelerators.emptiness._milestones[0]));
    if (DivinityMilestone.celestialSurge.isReached) pow("voidCelestialSurge", 2);
    if (DivinityMilestone.finalRebirth.isReached) {
      pow("voidFinalRebirth", Time.thisEndgameRealTime.totalSeconds.max(1).log10().div(5).pow(3).add(1));
    }
    pow("voidNullParticles", Currency.nullParticles.value.max(1).log10().div(5).add(1).pow(5));
  });
  if (ResurgenceUpgrade.achSurge.isBought && !player.disablePostReality) {
    pow("achievementSurgePower", Achievements.powerConv(Achievements.power));
  }
  transform("achievement231", "softcap", current => dilateMultiplier(current, effect(Achievement(231))));
  transform("etherealStars", "softcap", current => dilateMultiplier(current, EtherealStars.red.reward));
  if (player.endgame.overcharge.isRunning) {
    transform("overcharge", "softcap", current => dilateMultiplier(current, Math.pow(0.72, player.endgame.overcharge.level)));
  }
  return value;
}

function build(tier) {
  const steps = {};
  const dim = AntimatterDimension(tier);
  if (!dim.isProducing) return steps;
  const finalWith = trace(tier, null, steps);
  // Store the final result outside the enumerable step list. In particular, DO NOT replay
  // every source when the overall page asks only for top-level group entries; ADE can have
  // 100+ AD sources and replaying all of them across eight tiers every render is expensive.
  Object.defineProperty(steps, "finalWithMultiplier", { value: finalWith });
  addOrderedTraceMismatch(steps, finalWith, dim.multiplier, `AD ${tier} formula differs from gameplay`);
  return steps;
}

const caches = Array.from({ length: 9 }, (_, tier) => tier === 0
  ? null : createOrderedTransformCache(() => build(tier), 100));

function attachTierCounterfactual(tier, steps, key) {
  const transform = steps[key];
  if (!transform) return null;
  // Source removal is calculated only if the UI asks for this row. Expanding a category
  // calculates its children on demand, while collapsed categories stay O(visible sources).
  if (key !== "base" && key !== "traceMismatch" && !Object.hasOwn(transform, "finalWithout") &&
      (transform.alwaysShow || transform.before.neq(transform.after))) {
    transform.finalWith = steps.finalWithMultiplier;
    Object.defineProperty(transform, "finalWithout", {
      configurable: true,
      enumerable: true,
      get() {
        const result = trace(tier, key);
        Object.defineProperty(transform, "finalWithout", {
          configurable: true, enumerable: true, value: result
        });
        return result;
      }
    });
  }
  return transform;
}

function tierTransform(tier, key) {
  if (tier < 1 || tier > 8) return null;
  return attachTierCounterfactual(tier, caches[tier](), key);
}

const aggregateCache = createOrderedTransformCache(() => ({
  tiers: AntimatterDimensions.all.filter(ad => ad.isProducing).map(ad => ({
    tier: ad.tier, trace: caches[ad.tier]()
  })),
  results: new Map(),
}), 100);

function aggregateTransform(key) {
  const snapshot = aggregateCache();
  if (snapshot.results.has(key)) return snapshot.results.get(key);
  const relevant = snapshot.tiers.filter(item => Object.hasOwn(item.trace, key));
  const items = relevant.map(item => ({
    // Attach the lazy getter to the SAME trace snapshot used for Direct.
    // Previously unopened AD tiers had no finalWithout, so Final silently
    // fell back to Direct in the aggregate view.
    tier: item.tier, transform: attachTierCounterfactual(item.tier, item.trace, key)
  }));
  const direct = aggregateOrderedTransforms(items, "AD", false);
  if (!direct) {
    snapshot.results.set(key, direct);
    return direct;
  }
  let final;
  const getFinal = () => {
    if (!final) final = aggregateOrderedTransforms(items, "AD", true);
    return final;
  };
  Object.defineProperties(direct, {
    finalWith: { enumerable: true, get: () => getFinal().finalWith },
    finalWithout: { enumerable: true, get: () => getFinal().finalWithout }
  });
  snapshot.results.set(key, direct);
  return direct;
}

export const AntimatterDimensionBreakdown = {
  transform: tierTransform,
  aggregateTransform,
  summary: tier => ({ type: "formula", before: DC.D1, after: AntimatterDimension(tier).multiplier,
    alwaysShow: true, display: formatX(AntimatterDimension(tier).multiplier, 2, 2) }),
  totalSummary: () => ({ type: "formula", before: DC.D1,
    after: AntimatterDimensions.all.filter(ad => ad.isProducing)
      .reduce((product, ad) => product.times(ad.multiplier), DC.D1),
    alwaysShow: true, display: "Product of producing AD multipliers; not AM/sec" }),
};
