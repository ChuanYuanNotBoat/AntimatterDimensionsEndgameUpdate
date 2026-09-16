import { PlayerProgress } from "../../player-progress";

import { MultiplierTabHelper } from "./helper-functions";
import { MultiplierTabIcons } from "./icons";
import { TimeDimensionBreakdown } from "./time-dimension-breakdown";

function orderedTDEntry(name, key, icon, isOrdered = false) {
  const transform = dim => (dim
    ? TimeDimensionBreakdown.transform(dim, key)
    : TimeDimensionBreakdown.aggregateTransform(key));
  return {
    name,
    transformValue: transform,
    displayOverride: dim => {
      const data = transform(dim);
      if (!data) return "";
      if (data.aggregate) return "";
      if (data.display) return data.display;
      if (data.type === "multiply" && data.value !== undefined) return formatX(data.value, 2, 2);
      if (data.type === "power" && data.value !== undefined) return formatPow(data.value, 2, 3);
      return `${format(data.before, 2, 2)} ➜ ${format(data.after, 2, 2)}`;
    },
    isActive: dim => (dim ? TimeDimension(dim).isProducing : transform(dim) !== null),
    icon,
    isOrdered,
  };
}

// See index.js for documentation
export const TD = {
  total: {
    name: dim => {
      if (dim) return `TD ${dim} Production`;
      if (EternityChallenge(7).isRunning) return "ID8 Production";
      return "Time Shard Production";
    },
    displayOverride: dim => `${format(TimeDimension(dim ?? 1).productionPerSecond, 2)}/sec`,
    multValue: dim => (dim
      ? TimeDimension(dim).multiplier
      : TimeDimensions.all
        .filter(td => td.isProducing)
        .map(td => td.multiplier)
        .reduce((x, y) => x.times(y), DC.D1)),
    isActive: dim => (dim
      ? TimeDimension(dim).isProducing
      : (PlayerProgress.realityUnlocked() || TimeDimension(1).isProducing)),
    dilationEffect: () => {
      const baseEff = player.dilation.active
        ? 0.75 * Effects.product(DilationUpgrade.dilationPenalty)
        : 1;
      return baseEff * (Effarig.isRunning ? Effarig.multDilation : 1);
    },
    isDilated: true,
    overlay: ["Δ", "<i class='fa-solid fa-cube' />"],
    icon: dim => MultiplierTabIcons.DIMENSION("TD", dim),
    transformValue: dim => (dim
      ? TimeDimensionBreakdown.summary(dim)
      : TimeDimensionBreakdown.totalSummary()),
    isOrdered: true,
  },
  purchase: {
    name: dim => (dim ? `Purchased TD ${dim}` : "Purchases"),
    multValue: dim => {
      const getMult = td => {
        const d = TimeDimension(td);
        const bought = td === 8 ? Decimal.min(d.bought, 1e8) : d.bought;
        return Decimal.pow(d.powerMultiplier, bought);
      };
      if (dim) return getMult(dim);
      return TimeDimensions.all
        .filter(td => td.isProducing)
        .map(td => getMult(td.tier))
        .reduce((x, y) => x.times(y), DC.D1);
    },
    isActive: () => !EternityChallenge(2).isRunning && !EternityChallenge(10).isRunning,
    icon: dim => MultiplierTabIcons.PURCHASE("TD", dim),
  },
  highestDim: {
    name: () => `Amount of highest Dimension`,
    displayOverride: () => {
      const dim = MultiplierTabHelper.activeDimCount("TD");
      return `TD ${dim}, ${formatInt(TimeDimension(dim).amount)}`;
    },
    multValue: () => TimeDimension(MultiplierTabHelper.activeDimCount("TD")).amount,
    isActive: () => TimeDimension(1).isProducing,
    icon: MultiplierTabIcons.DIMENSION("TD"),
  },

  basePurchase: {
    name: "Base purchases",
    multValue: dim => {
      const getMult = td => Decimal.pow(4,
        td === 8 ? Decimal.min(TimeDimension(td).bought, 1e8) : TimeDimension(td).bought);
      if (dim) return getMult(dim);
      return TimeDimensions.all
        .filter(td => td.isProducing)
        .map(td => getMult(td.tier))
        .reduce((x, y) => x.times(y), DC.D1);
    },
    isActive: dim => (dim
      ? ImaginaryUpgrade(14).canBeApplied || (dim === 8 && GlyphSacrifice.time.effectValue.gt(1))
      : TimeDimension(1).isProducing),
    icon: dim => MultiplierTabIcons.PURCHASE("TD", dim),
  },
  timeGlyphSacrifice: {
    name: "Time Glyph Sacrifice",
    multValue: () => (TimeDimension(8).isProducing
      ? Decimal.pow(GlyphSacrifice.time.effectValue, Decimal.min(TimeDimension(8).bought, 1e8))
      : DC.D1),
    isActive: () => GlyphSacrifice.time.effectValue.gt(1),
    icon: MultiplierTabIcons.SACRIFICE("time"),
  },
  powPurchase: {
    name: "Imaginary Upgrade - Recollection of Intrusion",
    powValue: () => ImaginaryUpgrade(14).effectOrDefault(1),
    isActive: () => ImaginaryUpgrade(14).canBeApplied,
    icon: MultiplierTabIcons.UPGRADE("imaginary"),
  },

  achievementMult: {
    name: "Eternity Upgrade - Achievement Multiplier",
    multValue: dim => Decimal.pow(EternityUpgrade.tdMultAchs.effectOrDefault(1),
      dim ? 1 : MultiplierTabHelper.activeDimCount("TD")),
    isActive: () => EternityUpgrade.tdMultAchs.canBeApplied && !Pelle.isDoomed,
    icon: MultiplierTabIcons.ACHIEVEMENT,
  },
  achievement: {
    name: "Achievement Rewards",
    multValue: dim => {
      const baseMult = DC.D1.timesEffectsOf(Achievement(105), Achievement(128));
      return Decimal.pow(baseMult, dim ? 1 : MultiplierTabHelper.activeDimCount("TD"));
    },
    isActive: () => Achievement(105).canBeApplied || Achievement(128).canBeApplied,
    icon: MultiplierTabIcons.ACHIEVEMENT,
  },
  timeStudy: {
    name: dim => (dim ? `Time Studies (TD ${dim})` : "Time Studies"),
    multValue: dim => {
      const allMult = DC.D1.timesEffectsOf(
        TimeStudy(93),
        TimeStudy(103),
        TimeStudy(151),
        TimeStudy(221),
        TimeStudy(301),
      );

      const dimMults = Array.repeat(DC.D1, 9);
      for (let tier = 1; tier <= 8; tier++) {
        dimMults[tier] = dimMults[tier].timesEffectsOf(
          tier === 1 ? TimeStudy(11) : null,
          tier === 3 ? TimeStudy(73) : null,
          tier === 4 ? TimeStudy(227) : null
        );
      }

      if (dim) return allMult.times(dimMults[dim]);
      let totalMult = DC.D1;
      for (let tier = 1; tier <= MultiplierTabHelper.activeDimCount("TD"); tier++) {
        totalMult = totalMult.times(dimMults[tier]).times(allMult);
      }
      return totalMult;
    },
    isActive: () => TimeDimension(1).isProducing,
    icon: MultiplierTabIcons.TIME_STUDY
  },
  eternityUpgrade: {
    name: dim => (dim ? `Other Eternity Upgrades (TD ${dim})` : "Other Eternity Upgrades"),
    multValue: dim => {
      const allMult = DC.D1.timesEffectsOf(
        EternityUpgrade.tdMultTheorems,
        EternityUpgrade.tdMultRealTime,
      );
      return Decimal.pow(allMult, dim ? 1 : MultiplierTabHelper.activeDimCount("TD"));
    },
    isActive: () => TimeDimension(1).isProducing,
    icon: MultiplierTabIcons.UPGRADE("eternity"),
  },

  eu1: {
    name: () => "Unspent Time Theorems",
    multValue: dim => Decimal.pow(EternityUpgrade.tdMultTheorems.effectOrDefault(1),
      dim ? 1 : MultiplierTabHelper.activeDimCount("TD")),
    isActive: () => EternityUpgrade.tdMultTheorems.canBeApplied,
    icon: MultiplierTabIcons.UPGRADE("eternity"),
  },
  eu2: {
    name: () => "Days played",
    multValue: dim => Decimal.pow(EternityUpgrade.tdMultRealTime.effectOrDefault(1),
      dim ? 1 : MultiplierTabHelper.activeDimCount("TD")),
    isActive: () => EternityUpgrade.tdMultRealTime.canBeApplied,
    icon: MultiplierTabIcons.UPGRADE("eternity"),
  },

  eternityChallenge: {
    name: dim => (dim ? `Eternity Challenges (TD ${dim})` : "Eternity Challenges"),
    multValue: dim => {
      let allMult = DC.D1.timesEffectsOf(
        EternityChallenge(1).reward,
        EternityChallenge(10).reward,
      ).times(EternityChallenge(7).isRunning ? Tickspeed.perSecond : DC.D1);
      if (EternityChallenge(9).isRunning) {
        allMult = allMult.times(
          Decimal.pow(Decimal.clampMin(Currency.infinityPower.value.pow(InfinityDimensions.powerConversionRate / 7)
            .log2(), 1), 4).clampMin(1));
      }
      return Decimal.pow(allMult, dim ? 1 : MultiplierTabHelper.activeDimCount("TD"));
    },
    isActive: () => EternityChallenge(1).completions > 0,
    icon: MultiplierTabIcons.CHALLENGE("eternity")
  },
  tickspeed: {
    name: () => "Tickspeed (EC7)",
    displayOverride: () => {
      const tickRate = Tickspeed.perSecond;
      const activeDims = MultiplierTabHelper.activeDimCount("TD");
      const dimString = MultiplierTabHelper.pluralizeDimensions(activeDims);
      return `${format(tickRate, 2, 2)}/sec on ${formatInt(activeDims)} ${dimString}
        ➜ ${formatX(tickRate.pow(activeDims), 2, 2)}`;
    },
    multValue: () => Tickspeed.perSecond.pow(MultiplierTabHelper.activeDimCount("TD")),
    isActive: () => EternityChallenge(7).isRunning,
    icon: MultiplierTabIcons.TICKSPEED,
  },
  dilationUpgrade: {
    name: "Dilation Upgrade - Replicanti Multiplier",
    multValue: dim => {
      const mult = Replicanti.areUnlocked && Replicanti.amount.gt(1)
        ? DilationUpgrade.tdMultReplicanti.effectValue
        : DC.D1;
      return Decimal.pow(mult, dim ? 1 : MultiplierTabHelper.activeDimCount("TD"));
    },
    isActive: () => DilationUpgrade.tdMultReplicanti.canBeApplied,
    icon: MultiplierTabIcons.UPGRADE("dilation"),
  },
  realityUpgrade: {
    name: "Reality Upgrade - Temporal Transcendence",
    multValue: dim => Decimal.pow(RealityUpgrade(22).effectOrDefault(1),
      dim ? 1 : MultiplierTabHelper.activeDimCount("TD")),
    isActive: () => !Pelle.isDoomed && RealityUpgrade(22).canBeApplied,
    icon: MultiplierTabIcons.UPGRADE("reality"),
  },
  glyph: {
    name: "Glyph Effects",
    powValue: () => getAdjustedGlyphEffect("timepow") * getAdjustedGlyphEffect("effarigdimensions"),
    isActive: () => PlayerProgress.realityUnlocked(),
    icon: MultiplierTabIcons.GENERIC_GLYPH
  },
  alchemy: {
    name: "Glyph Alchemy",
    multValue: dim => Decimal.pow(AlchemyResource.dimensionality.effectOrDefault(1),
      dim ? 1 : MultiplierTabHelper.activeDimCount("TD")),
    powValue: () => AlchemyResource.time.effectOrDefault(1) * Ra.momentumValue,
    isActive: () => Ra.unlocks.unlockGlyphAlchemy.canBeApplied,
    icon: MultiplierTabIcons.ALCHEMY,
  },
  imaginaryUpgrade: {
    name: "Imaginary Upgrade - Suspicion of Interference",
    powValue: () => ImaginaryUpgrade(11).effectOrDefault(1),
    isActive: () => ImaginaryUpgrade(11).canBeApplied,
    icon: MultiplierTabIcons.UPGRADE("imaginary"),
  },
  pelle: {
    name: "Pelle Rift Effects",
    multValue: dim => Decimal.pow(PelleRifts.chaos.effectOrDefault(1),
      dim ? 1 : MultiplierTabHelper.activeDimCount("TD")),
    powValue: () => PelleRifts.paradox.effectOrDefault(DC.D1).toNumber(),
    isActive: () => Pelle.isDoomed,
    icon: MultiplierTabIcons.PELLE,
  },
  iap: {
    name: "Shop Tab Purchases",
    multValue: dim => Decimal.pow(ShopPurchase.allDimPurchases.currentMult,
      dim ? 1 : MultiplierTabHelper.activeDimCount("TD")),
    isActive: () => ShopPurchaseData.totalSTD > 0,
    icon: MultiplierTabIcons.IAP,
  },

  nerfV: {
    name: "V's Reality",
    powValue: () => 0.5,
    isActive: () => V.isRunning,
    icon: MultiplierTabIcons.GENERIC_V,
  },
  nerfCursed: {
    name: "Cursed Glyphs",
    powValue: () => getAdjustedGlyphEffect("curseddimensions"),
    isActive: () => getAdjustedGlyphEffect("curseddimensions") !== 1,
    icon: MultiplierTabIcons.SPECIFIC_GLYPH("cursed"),
  },

  // Ordered Time Dimension production trace. The legacy entries remain available for other nested breakdowns, but
  // the TD tab uses the exact multiplier/production order from TimeDimensionState.
  baseAmount: orderedTDEntry(
    dim => `TD ${dim} Amount`,
    "base",
    dim => MultiplierTabIcons.DIMENSION("TD", dim)
  ),
  commonEffects: orderedTDEntry(
    "Common Multipliers",
    "common",
    MultiplierTabIcons.UPGRADE("eternity"),
    true
  ),
  commonIAP: orderedTDEntry("Shop Tab Purchases", "commonIAP", MultiplierTabIcons.IAP),
  commonAchievements: orderedTDEntry("Achievements", "commonAchievements", MultiplierTabIcons.ACHIEVEMENT, true),
  achievement105: orderedTDEntry("Achievement 105", "achievement105", MultiplierTabIcons.ACHIEVEMENT),
  achievement128: orderedTDEntry("Achievement 128", "achievement128", MultiplierTabIcons.ACHIEVEMENT),
  commonTimeStudies: orderedTDEntry("Time Studies", "commonTimeStudies", MultiplierTabIcons.TIME_STUDY, true),
  timeStudy93: orderedTDEntry("Time Study 93", "timeStudy93", MultiplierTabIcons.TIME_STUDY),
  timeStudy103: orderedTDEntry("Time Study 103", "timeStudy103", MultiplierTabIcons.TIME_STUDY),
  timeStudy151: orderedTDEntry("Time Study 151", "timeStudy151", MultiplierTabIcons.TIME_STUDY),
  timeStudy221: orderedTDEntry("Time Study 221", "timeStudy221", MultiplierTabIcons.TIME_STUDY),
  timeStudy301: orderedTDEntry("Time Study 301", "timeStudy301", MultiplierTabIcons.TIME_STUDY),
  commonEternityChallenges: orderedTDEntry(
    "Eternity Challenge Rewards",
    "commonEternityChallenges",
    MultiplierTabIcons.CHALLENGE("eternity"),
    true
  ),
  eternityChallenge1: orderedTDEntry(
    "Eternity Challenge 1",
    "eternityChallenge1",
    MultiplierTabIcons.CHALLENGE("eternity")
  ),
  eternityChallenge10: orderedTDEntry(
    "Eternity Challenge 10",
    "eternityChallenge10",
    MultiplierTabIcons.CHALLENGE("eternity")
  ),
  commonEternityUpgrades: orderedTDEntry(
    "Eternity Upgrades",
    "commonEternityUpgrades",
    MultiplierTabIcons.UPGRADE("eternity"),
    true
  ),
  eternityUpgradeAchievements: orderedTDEntry(
    "Achievement Multiplier Upgrade",
    "eternityUpgradeAchievements",
    MultiplierTabIcons.UPGRADE("eternity")
  ),
  eternityUpgradeTheorems: orderedTDEntry(
    "Unspent Time Theorems",
    "eternityUpgradeTheorems",
    MultiplierTabIcons.UPGRADE("eternity")
  ),
  eternityUpgradeRealTime: orderedTDEntry(
    "Days Played",
    "eternityUpgradeRealTime",
    MultiplierTabIcons.UPGRADE("eternity")
  ),
  commonRealityUpgrade: orderedTDEntry(
    "Reality Upgrade - Temporal Transcendence",
    "commonRealityUpgrade",
    MultiplierTabIcons.UPGRADE("reality")
  ),
  commonAlchemy: orderedTDEntry("Dimensionality Alchemy", "commonAlchemy", MultiplierTabIcons.ALCHEMY),
  commonPelle: orderedTDEntry("Pelle Chaos Rift", "commonPelle", MultiplierTabIcons.PELLE),
  commonReplicanti: orderedTDEntry(
    "Replicanti Multiplier",
    "commonReplicanti",
    MultiplierTabIcons.SPECIFIC_GLYPH("replication")
  ),
  ec9InfinityPower: orderedTDEntry(
    "Eternity Challenge 9 Infinity Power Effect",
    "ec9InfinityPower",
    MultiplierTabIcons.CHALLENGE("eternity")
  ),
  commonNull: orderedTDEntry("Null Upgrade", "commonNull", MultiplierTabIcons.UPGRADE("imaginary")),

  tierEffects: orderedTDEntry("Tier-specific Time Studies", "tierEffects", MultiplierTabIcons.TIME_STUDY, true),
  tierTimeStudy11: orderedTDEntry("Time Study 11", "tierTimeStudy11", MultiplierTabIcons.TIME_STUDY),
  tierTimeStudy73: orderedTDEntry("Time Study 73", "tierTimeStudy73", MultiplierTabIcons.TIME_STUDY),
  tierTimeStudy227: orderedTDEntry("Time Study 227", "tierTimeStudy227", MultiplierTabIcons.TIME_STUDY),

  orderedPurchase: orderedTDEntry("Purchases / Continuum", "purchase", MultiplierTabIcons.PURCHASE("TD"), true),
  purchaseBaseOrdered: orderedTDEntry(
    "Base per-purchase Multiplier", "purchaseBase", MultiplierTabIcons.PURCHASE("TD")
  ),
  purchaseGlyphSacrificeOrdered: orderedTDEntry(
    "Time Glyph Sacrifice",
    "purchaseGlyphSacrifice",
    MultiplierTabIcons.SACRIFICE("time")
  ),
  purchaseImaginaryPowerOrdered: orderedTDEntry(
    "Imaginary Upgrade - Recollection of Intrusion",
    "purchaseImaginaryPower",
    MultiplierTabIcons.UPGRADE("imaginary")
  ),
  purchaseSingularityPowerOrdered: orderedTDEntry(
    "Singularity per-purchase Power",
    "purchaseSingularityPower",
    MultiplierTabIcons.UPGRADE("imaginary")
  ),

  preDilationPowers: orderedTDEntry(
    "Glyph and Global Powers", "preDilationPowers", MultiplierTabIcons.GENERIC_GLYPH, true
  ),
  glyphTimePower: orderedTDEntry("Time Glyph Power", "glyphTimePower", MultiplierTabIcons.GENERIC_GLYPH),
  glyphEffarigPower: orderedTDEntry(
    "Effarig Glyph Dimension Power", "glyphEffarigPower", MultiplierTabIcons.GENERIC_GLYPH
  ),
  glyphCursedPower: orderedTDEntry(
    "Cursed Glyph Dimension Power", "glyphCursedPower", MultiplierTabIcons.SPECIFIC_GLYPH("cursed")
  ),
  alchemyTimePower: orderedTDEntry("Time Alchemy Power", "alchemyTimePower", MultiplierTabIcons.ALCHEMY),
  raMomentumPower: orderedTDEntry("Ra Momentum", "raMomentumPower", MultiplierTabIcons.ALCHEMY),
  imaginaryPower: orderedTDEntry(
    "Imaginary Upgrade - Suspicion of Interference",
    "imaginaryPower",
    MultiplierTabIcons.UPGRADE("imaginary")
  ),
  pelleParadoxPower: orderedTDEntry("Pelle Paradox Rift", "pelleParadoxPower", MultiplierTabIcons.PELLE),
  singularityDimensionPower: orderedTDEntry(
    "Singularity Dimension Power", "singularityDimensionPower", MultiplierTabIcons.UPGRADE("imaginary")
  ),
  raTimeTheoremPower: orderedTDEntry("Ra Time Theorem Power", "raTimeTheoremPower", MultiplierTabIcons.ALCHEMY),
  pellePackPower: orderedTDEntry("Pelle Expansion Pack Power", "pellePackPower", MultiplierTabIcons.PELLE),

  dilationOrdered: orderedTDEntry("Dilation", "dilation", MultiplierTabIcons.UPGRADE("dilation")),
  effarigOrdered: orderedTDEntry("Effarig's Reality", "effarig", MultiplierTabIcons.GENERIC_GLYPH),
  vNerfOrdered: orderedTDEntry("V's Reality", "vNerf", MultiplierTabIcons.GENERIC_V),

  postDilationPowers: orderedTDEntry(
    "Post-Dilation Powers", "postDilationPowers", MultiplierTabIcons.UPGRADE("eternity"), true
  ),
  ascensionTimeStudy73Power: orderedTDEntry(
    "Ascended Time Study 73", "ascensionTimeStudy73Power", MultiplierTabIcons.TIME_STUDY
  ),
  breakEternityPower: orderedTDEntry(
    "Break Eternity TD Power", "breakEternityPower", MultiplierTabIcons.UPGRADE("infinity")
  ),
  alphaEC5Power: orderedTDEntry(
    "Alpha EC Completion Reward", "alphaEC5Power", MultiplierTabIcons.CHALLENGE("eternity")
  ),
  alphaTier8Power: orderedTDEntry("Alpha TD8 Reward", "alphaTier8Power", MultiplierTabIcons.DIMENSION("TD", 8)),
  replicantiSurgePower: orderedTDEntry(
    "Duplicated Surge", "replicantiSurgePower", MultiplierTabIcons.SPECIFIC_GLYPH("replication")
  ),
  achievementSurgePower: orderedTDEntry("Achievement Surge", "achievementSurgePower", MultiplierTabIcons.ACHIEVEMENT),

  etherealOrdered: orderedTDEntry("Ethereal Stars", "ethereal", MultiplierTabIcons.UPGRADE("imaginary")),
  overchargeOrdered: orderedTDEntry("Endgame Overcharge", "overcharge", MultiplierTabIcons.UPGRADE("imaginary")),
  overflow1Ordered: orderedTDEntry("Time Dimension Overflow", "overflow1", MultiplierTabIcons.DIMENSION("TD")),
  overflow2Ordered: orderedTDEntry("Time Dimension Second Overflow", "overflow2", MultiplierTabIcons.DIMENSION("TD")),
  tickspeedOrdered: orderedTDEntry("Tickspeed (EC7)", "tickspeed", MultiplierTabIcons.TICKSPEED),
  timeShardGlyphPowerOrdered: orderedTDEntry(
    "Time Shard Glyph Power", "timeShardGlyphPower", MultiplierTabIcons.GENERIC_GLYPH
  ),
  ec11OverrideOrdered: orderedTDEntry(
    "Eternity Challenge 11 Override", "ec11Override", MultiplierTabIcons.CHALLENGE("eternity")
  ),
  alphaProductionBypassOrdered: orderedTDEntry(
    "Alpha Production Override", "alphaProductionBypass", MultiplierTabIcons.DIMENSION("TD")
  ),
  traceMismatchOrdered: orderedTDEntry(
    "Untracked TD Formula Difference", "traceMismatch", MultiplierTabIcons.DIMENSION("TD")
  ),

};
