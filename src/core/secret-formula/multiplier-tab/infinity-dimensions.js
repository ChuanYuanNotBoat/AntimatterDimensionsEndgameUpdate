import { PlayerProgress } from "../../player-progress";

import { MultiplierTabHelper } from "./helper-functions";
import { InfinityDimensionBreakdown } from "./infinity-dimension-breakdown";
import { MultiplierTabIcons } from "./icons";

function orderedIDEntry(name, key, icon, isOrdered = false) {
  const transform = dim => (dim
    ? InfinityDimensionBreakdown.transform(dim, key)
    : InfinityDimensionBreakdown.aggregateTransform(key));
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
    isActive: dim => (dim ? InfinityDimension(dim).isProducing : transform(dim) !== null),
    icon,
    isOrdered,
  };
}

// See index.js for documentation
export const ID = {
  total: {
    name: dim => {
      if (dim) return `ID ${dim} Production`;
      if (EternityChallenge(7).isRunning) return "AD7 Production";
      return "Infinity Power Production";
    },
    displayOverride: dim => `${format(InfinityDimension(dim ?? 1).productionPerSecond, 2)}/sec`,
    multValue: dim => (dim
      ? InfinityDimension(dim).multiplier
      : InfinityDimensions.all
        .filter(id => id.isProducing)
        .map(id => id.multiplier)
        .reduce((x, y) => x.times(y), DC.D1)),
    isActive: dim => (dim
      ? InfinityDimension(dim).isProducing
      : (PlayerProgress.eternityUnlocked() || InfinityDimension(1).isProducing)),
    dilationEffect: () => {
      const baseEff = player.dilation.active
        ? 0.75 * Effects.product(DilationUpgrade.dilationPenalty)
        : 1;
      return baseEff * (Effarig.isRunning ? Effarig.multDilation : 1);
    },
    isDilated: true,
    overlay: ["∞", "<i class='fa-solid fa-cube' />"],
    icon: dim => MultiplierTabIcons.DIMENSION("ID", dim),
    transformValue: dim => (dim
      ? InfinityDimensionBreakdown.summary(dim)
      : InfinityDimensionBreakdown.totalSummary()),
    isOrdered: true,
  },
  purchase: {
    name: dim => (dim ? `Purchased ID ${dim}` : "Purchases"),
    multValue: dim => {
      const getMult = id => Decimal.pow(InfinityDimension(id).powerMultiplier,
        InfinityDimension(id).baseAmount.div(10).floor());
      if (dim) return getMult(dim);
      return InfinityDimensions.all
        .filter(id => id.isProducing)
        .map(id => getMult(id.tier))
        .reduce((x, y) => x.times(y), DC.D1);
    },
    isActive: () => !EternityChallenge(2).isRunning && !EternityChallenge(10).isRunning,
    icon: dim => MultiplierTabIcons.PURCHASE("ID", dim),
  },
  highestDim: {
    name: () => `Amount of highest Dimension`,
    displayOverride: () => {
      const dim = MultiplierTabHelper.activeDimCount("ID");
      return `ID ${dim}, ${format(InfinityDimension(dim).amount, 2)}`;
    },
    multValue: () => InfinityDimension(MultiplierTabHelper.activeDimCount("ID")).amount,
    isActive: () => InfinityDimension(1).isProducing,
    icon: MultiplierTabIcons.DIMENSION("ID"),
  },

  basePurchase: {
    name: "Base purchases",
    multValue: dim => {
      const getMult = id => {
        const rawPurchases = InfinityDimension(id).baseAmount.div(10).floor();
        const purchases = id === 8
          ? rawPurchases
          : Decimal.min(InfinityDimensions.HARDCAP_PURCHASES, rawPurchases);
        const baseMult = InfinityDimension(id)._powerMultiplier;
        return Decimal.pow(baseMult, purchases);
      };
      if (dim) return getMult(dim);
      return InfinityDimensions.all
        .filter(id => id.isProducing)
        .map(id => getMult(id.tier))
        .reduce((x, y) => x.times(y), DC.D1);
    },
    isActive: true,
    icon: MultiplierTabIcons.PURCHASE("baseID"),
  },
  tesseractPurchase: {
    name: "Tesseracts",
    multValue: dim => {
      const getMult = id => {
        if (id === 8) return DC.D1;
        const purchases = InfinityDimension(id).baseAmount.div(10).floor();
        return Decimal.pow(InfinityDimension(id)._powerMultiplier,
          purchases.sub(InfinityDimensions.HARDCAP_PURCHASES).clampMin(0));
      };
      if (dim) return getMult(dim);
      return InfinityDimensions.all
        .filter(id => id.isProducing)
        .map(id => getMult(id.tier))
        .reduce((x, y) => x.times(y), DC.D1);
    },
    isActive: () => Tesseracts.bought > 0,
    icon: MultiplierTabIcons.PURCHASE("tesseractID"),
  },
  infinityGlyphSacrifice: {
    name: "Infinity Glyph sacrifice",
    multValue: () => (InfinityDimension(8).isProducing
      ? Decimal.pow(GlyphSacrifice.infinity.effectValue, InfinityDimension(8).baseAmount.div(10).floor())
      : DC.D1),
    isActive: () => GlyphSacrifice.infinity.effectValue.gt(1),
    icon: MultiplierTabIcons.SACRIFICE("infinity"),
  },
  powPurchase: {
    name: "Imaginary Upgrade - Recollection of Intrusion",
    powValue: () => ImaginaryUpgrade(14).effectOrDefault(1),
    isActive: () => ImaginaryUpgrade(14).canBeApplied,
    icon: MultiplierTabIcons.UPGRADE("imaginary"),
  },

  replicanti: {
    name: "Replicanti Multiplier",
    multValue: dim => Decimal.pow(replicantiMult(), dim ? 1 : MultiplierTabHelper.activeDimCount("ID")),
    isActive: () => Replicanti.areUnlocked,
    icon: MultiplierTabIcons.SPECIFIC_GLYPH("replication"),
  },
  achievementMult: {
    name: "Achievement Multiplier",
    multValue: dim => Decimal.pow(Achievements.power, dim ? 1 : MultiplierTabHelper.activeDimCount("ID")),
    isActive: () => Achievement(75).canBeApplied && !Pelle.isDoomed,
    icon: MultiplierTabIcons.ACHIEVEMENT,
  },
  achievement: {
    // Note: This only applies to ID1
    name: () => "Achievement 94",
    multValue: dim => ((dim ?? 1) === 1 ? Achievement(94).effectOrDefault(1) : 1),
    isActive: () => Achievement(94).canBeApplied,
    icon: MultiplierTabIcons.ACHIEVEMENT,
  },
  timeStudy: {
    name: dim => (dim ? `Time Studies (ID ${dim})` : "Time Studies"),
    multValue: dim => {
      const allMult = DC.D1.timesEffectsOf(
        TimeStudy(82),
        TimeStudy(92),
        TimeStudy(162)
      );
      if (dim) return dim === 4 ? allMult.times(TimeStudy(72).effectOrDefault(1)) : allMult;
      const maxActiveDim = MultiplierTabHelper.activeDimCount("ID");
      return Decimal.pow(allMult, maxActiveDim).times(maxActiveDim >= 4 ? TimeStudy(72).effectOrDefault(1) : DC.D1);
    },
    isActive: () => PlayerProgress.eternityUnlocked(),
    icon: MultiplierTabIcons.TIME_STUDY,
  },
  eternityUpgrade: {
    name: "Eternity Upgrades",
    multValue: dim => {
      const allMult = DC.D1.timesEffectsOf(
        EternityUpgrade.idMultEP,
        EternityUpgrade.idMultEternities,
        EternityUpgrade.idMultICRecords,
      );
      return Decimal.pow(allMult, dim ? 1 : MultiplierTabHelper.activeDimCount("ID"));
    },
    isActive: () => PlayerProgress.eternityUnlocked(),
    icon: MultiplierTabIcons.UPGRADE("eternity"),
  },

  eu1: {
    name: () => "Unspent Eternity Points",
    multValue: dim => Decimal.pow(EternityUpgrade.idMultEP.effectOrDefault(1),
      dim ? 1 : MultiplierTabHelper.activeDimCount("ID")),
    isActive: () => EternityUpgrade.idMultEP.canBeApplied,
    icon: MultiplierTabIcons.UPGRADE("eternity"),
  },
  eu2: {
    name: () => "Eternity Count",
    multValue: dim => Decimal.pow(EternityUpgrade.idMultEternities.effectOrDefault(1),
      dim ? 1 : MultiplierTabHelper.activeDimCount("ID")),
    isActive: () => EternityUpgrade.idMultEternities.canBeApplied,
    icon: MultiplierTabIcons.UPGRADE("eternity"),
  },
  eu3: {
    name: () => "Infinity Challenge Records",
    multValue: dim => Decimal.pow(EternityUpgrade.idMultICRecords.effectOrDefault(1),
      dim ? 1 : MultiplierTabHelper.activeDimCount("ID")),
    isActive: () => EternityUpgrade.idMultICRecords.canBeApplied,
    icon: MultiplierTabIcons.UPGRADE("eternity"),
  },

  infinityChallenge: {
    name: "Infinity Challenges",
    multValue: dim => {
      const allMult = DC.D1.timesEffectsOf(
        InfinityChallenge(1).reward,
        InfinityChallenge(6).reward,
      );
      return Decimal.pow(allMult, dim ? 1 : MultiplierTabHelper.activeDimCount("ID"));
    },
    isActive: () => InfinityChallenge(1).isCompleted,
    icon: MultiplierTabIcons.CHALLENGE("infinity"),
  },
  eternityChallenge: {
    name: dim => (dim ? `Eternity Challenges (ID ${dim})` : " Eternity Challenges"),
    multValue: dim => {
      const allMult = DC.D1.timesEffectsOf(
        EternityChallenge(4).reward,
        EternityChallenge(9).reward,
      ).times(EternityChallenge(7).isRunning ? Tickspeed.perSecond : DC.D1);
      if (dim) {
        if (dim === 1) return allMult.times(EternityChallenge(2).reward.effectOrDefault(1));
        return allMult;
      }
      const maxActiveDim = MultiplierTabHelper.activeDimCount("ID");
      return Decimal.pow(allMult, maxActiveDim)
        .times(maxActiveDim >= 1 ? EternityChallenge(2).reward.effectOrDefault(1) : DC.D1);
    },
    isActive: () => EternityChallenge(2).completions > 0,
    icon: MultiplierTabIcons.CHALLENGE("eternity"),
  },
  tickspeed: {
    name: () => "Tickspeed (EC7)",
    displayOverride: () => {
      const tickRate = Tickspeed.perSecond;
      const activeDims = MultiplierTabHelper.activeDimCount("ID");
      const dimString = MultiplierTabHelper.pluralizeDimensions(activeDims);
      return `${format(tickRate, 2, 2)}/sec on ${formatInt(activeDims)} ${dimString}
        ➜ ${formatX(tickRate.pow(activeDims), 2, 2)}`;
    },
    multValue: () => Tickspeed.perSecond.pow(8),
    isActive: () => EternityChallenge(7).isRunning,
    icon: MultiplierTabIcons.TICKSPEED,
  },
  glyph: {
    name: "Glyph Effects",
    multValue: () => 1,
    powValue: () => getAdjustedGlyphEffect("infinitypow") * getAdjustedGlyphEffect("effarigdimensions"),
    isActive: () => PlayerProgress.realityUnlocked(),
    icon: MultiplierTabIcons.GENERIC_GLYPH,
  },
  alchemy: {
    name: "Glyph Alchemy",
    multValue: dim => Decimal.pow(AlchemyResource.dimensionality.effectOrDefault(1),
      dim ? 1 : MultiplierTabHelper.activeDimCount("ID")),
    powValue: () => AlchemyResource.infinity.effectOrDefault(1) * Ra.momentumValue,
    isActive: () => Ra.unlocks.unlockGlyphAlchemy.canBeApplied,
    icon: MultiplierTabIcons.ALCHEMY,
  },
  imaginaryUpgrade: {
    name: "Imaginary Upgrade - Hyperbolic Apeirogon",
    multValue: dim => Decimal.pow(ImaginaryUpgrade(8).effectOrDefault(1),
      dim ? 1 : MultiplierTabHelper.activeDimCount("ID")),
    isActive: () => ImaginaryUpgrade(8).canBeApplied,
    icon: MultiplierTabIcons.UPGRADE("imaginary"),
  },
  pelle: {
    name: "Pelle Rift Effects",
    multValue: dim => {
      const mult = DC.D1.timesEffectsOf(PelleRifts.recursion.milestones[1]);
      const maxActiveDim = MultiplierTabHelper.activeDimCount("ID");
      // This only affects ID1
      const decayMult = ((dim ? dim === 1 : maxActiveDim >= 1)
        ? PelleRifts.decay.milestones[0].effectOrDefault(1)
        : DC.D1);
      return Decimal.pow(mult, dim ? 1 : maxActiveDim).times(decayMult);
    },
    powValue: () => PelleRifts.paradox.effectOrDefault(DC.D1).toNumber(),
    isActive: () => Pelle.isDoomed,
    icon: MultiplierTabIcons.PELLE,
  },
  iap: {
    name: "Shop Tab Purchases",
    multValue: dim => Decimal.pow(ShopPurchase.allDimPurchases.currentMult,
      dim ? 1 : MultiplierTabHelper.activeDimCount("ID")),
    isActive: () => ShopPurchaseData.totalSTD > 0,
    icon: MultiplierTabIcons.IAP,
  },

  powerConversion: {
    name: "Infinity Power Conversion",
    powValue: () => InfinityDimensions.powerConversionRate,
    isActive: () => Currency.infinityPower.value.gt(1) && !EternityChallenge(9).isRunning,
    icon: MultiplierTabIcons.IPOW_CONVERSION,
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
  nerfPelle: {
    name: "Doomed Reality",
    powValue: 0.5,
    isActive: () => PelleStrikes.powerGalaxies.hasStrike,
    icon: MultiplierTabIcons.PELLE,
  },

  // Ordered Infinity Dimension production trace. These entries intentionally coexist with the legacy entries above:
  // AD's Infinity Power breakdown still uses several legacy values, while the ID tab itself uses this exact
  // formula tree.
  baseAmount: orderedIDEntry(
    dim => `ID ${dim} Amount`,
    "base",
    dim => MultiplierTabIcons.DIMENSION("ID", dim)
  ),
  commonEffects: orderedIDEntry(
    "Common Multipliers",
    "common",
    MultiplierTabIcons.UPGRADE("infinity"),
    true
  ),
  commonIAP: orderedIDEntry("Shop Tab Purchases", "commonIAP", MultiplierTabIcons.IAP),
  commonAchievements: orderedIDEntry("Achievements", "commonAchievements", MultiplierTabIcons.ACHIEVEMENT, true),
  achievement63: orderedIDEntry("Achievement 63", "achievement63", MultiplierTabIcons.ACHIEVEMENT),
  achievement75: orderedIDEntry("Achievement 75", "achievement75", MultiplierTabIcons.ACHIEVEMENT),
  achievement77: orderedIDEntry("Achievement 77", "achievement77", MultiplierTabIcons.ACHIEVEMENT),
  commonTimeStudies: orderedIDEntry("Time Studies", "commonTimeStudies", MultiplierTabIcons.TIME_STUDY, true),
  timeStudy82: orderedIDEntry("Time Study 82", "timeStudy82", MultiplierTabIcons.TIME_STUDY),
  timeStudy92: orderedIDEntry("Time Study 92", "timeStudy92", MultiplierTabIcons.TIME_STUDY),
  timeStudy162: orderedIDEntry("Time Study 162", "timeStudy162", MultiplierTabIcons.TIME_STUDY),
  commonInfinityChallenges: orderedIDEntry(
    "Infinity Challenge Rewards",
    "commonInfinityChallenges",
    MultiplierTabIcons.CHALLENGE("infinity"),
    true
  ),
  infinityChallenge1: orderedIDEntry(
    "Infinity Challenge 1",
    "infinityChallenge1",
    MultiplierTabIcons.CHALLENGE("infinity")
  ),
  infinityChallenge6: orderedIDEntry(
    "Infinity Challenge 6",
    "infinityChallenge6",
    MultiplierTabIcons.CHALLENGE("infinity")
  ),
  commonEternityChallenges: orderedIDEntry(
    "Eternity Challenge Rewards",
    "commonEternityChallenges",
    MultiplierTabIcons.CHALLENGE("eternity"),
    true
  ),
  eternityChallenge4: orderedIDEntry(
    "Eternity Challenge 4",
    "eternityChallenge4",
    MultiplierTabIcons.CHALLENGE("eternity")
  ),
  eternityChallenge9: orderedIDEntry(
    "Eternity Challenge 9",
    "eternityChallenge9",
    MultiplierTabIcons.CHALLENGE("eternity")
  ),
  commonEternityUpgrades: orderedIDEntry(
    "Eternity Upgrades",
    "commonEternityUpgrades",
    MultiplierTabIcons.UPGRADE("eternity"),
    true
  ),
  eternityUpgradeEP: orderedIDEntry(
    "Unspent Eternity Points",
    "eternityUpgradeEP",
    MultiplierTabIcons.UPGRADE("eternity")
  ),
  eternityUpgradeEternities: orderedIDEntry(
    "Eternity Count",
    "eternityUpgradeEternities",
    MultiplierTabIcons.UPGRADE("eternity")
  ),
  eternityUpgradeICRecords: orderedIDEntry(
    "Infinity Challenge Records",
    "eternityUpgradeICRecords",
    MultiplierTabIcons.UPGRADE("eternity")
  ),
  commonAlchemy: orderedIDEntry("Dimensionality Alchemy", "commonAlchemy", MultiplierTabIcons.ALCHEMY),
  commonImaginary: orderedIDEntry(
    "Imaginary Upgrade - Hyperbolic Apeirogon",
    "commonImaginary",
    MultiplierTabIcons.UPGRADE("imaginary")
  ),
  commonPelle: orderedIDEntry("Pelle Recursion Rift", "commonPelle", MultiplierTabIcons.PELLE),
  commonReplicanti: orderedIDEntry(
    "Replicanti Multiplier",
    "commonReplicanti",
    MultiplierTabIcons.SPECIFIC_GLYPH("replication")
  ),
  commonNull: orderedIDEntry("Null Upgrade", "commonNull", MultiplierTabIcons.UPGRADE("imaginary")),

  tierEffects: orderedIDEntry("Tier-specific Multipliers", "tierEffects", MultiplierTabIcons.DIMENSION("ID"), true),
  tierAchievement94: orderedIDEntry("Achievement 94", "tierAchievement94", MultiplierTabIcons.ACHIEVEMENT),
  tierTimeStudy72: orderedIDEntry("Time Study 72", "tierTimeStudy72", MultiplierTabIcons.TIME_STUDY),
  tierEC2: orderedIDEntry("Eternity Challenge 2", "tierEC2", MultiplierTabIcons.CHALLENGE("eternity")),

  orderedPurchase: orderedIDEntry("Purchases / Continuum", "purchase", MultiplierTabIcons.PURCHASE("ID"), true),
  purchaseBaseOrdered: orderedIDEntry(
    "Base per-purchase Multiplier",
    "purchaseBase",
    MultiplierTabIcons.PURCHASE("baseID")
  ),
  purchaseGlyphSacrificeOrdered: orderedIDEntry(
    "Infinity Glyph Sacrifice",
    "purchaseGlyphSacrifice",
    MultiplierTabIcons.SACRIFICE("infinity")
  ),
  purchaseImaginaryPowerOrdered: orderedIDEntry(
    "Imaginary Upgrade - Recollection of Intrusion",
    "purchaseImaginaryPower",
    MultiplierTabIcons.UPGRADE("imaginary")
  ),
  purchaseSingularityPowerOrdered: orderedIDEntry(
    "Singularity per-purchase Power",
    "purchaseSingularityPower",
    MultiplierTabIcons.UPGRADE("imaginary")
  ),

  decayOrdered: orderedIDEntry("Pelle Decay Rift", "decay", MultiplierTabIcons.PELLE),
  preDilationPowers: orderedIDEntry(
    "Glyph and Global Powers", "preDilationPowers", MultiplierTabIcons.GENERIC_GLYPH, true
  ),
  glyphInfinityPower: orderedIDEntry("Infinity Glyph Power", "glyphInfinityPower", MultiplierTabIcons.GENERIC_GLYPH),
  glyphEffarigPower: orderedIDEntry(
    "Effarig Glyph Dimension Power", "glyphEffarigPower", MultiplierTabIcons.GENERIC_GLYPH
  ),
  glyphCursedPower: orderedIDEntry(
    "Cursed Glyph Dimension Power", "glyphCursedPower", MultiplierTabIcons.SPECIFIC_GLYPH("cursed")
  ),
  alchemyInfinityPower: orderedIDEntry("Infinity Alchemy Power", "alchemyInfinityPower", MultiplierTabIcons.ALCHEMY),
  raMomentumPower: orderedIDEntry("Ra Momentum", "raMomentumPower", MultiplierTabIcons.ALCHEMY),
  pelleParadoxPower: orderedIDEntry("Pelle Paradox Rift", "pelleParadoxPower", MultiplierTabIcons.PELLE),
  singularityDimensionPower: orderedIDEntry(
    "Singularity Dimension Power", "singularityDimensionPower", MultiplierTabIcons.UPGRADE("imaginary")
  ),
  raTimeTheoremPower: orderedIDEntry("Ra Time Theorem Power", "raTimeTheoremPower", MultiplierTabIcons.ALCHEMY),
  raInfinityDimensionPower: orderedIDEntry(
    "Ra Infinity Dimension Power", "raInfinityDimensionPower", MultiplierTabIcons.ALCHEMY
  ),
  pellePackPower: orderedIDEntry("Pelle Expansion Pack Power", "pellePackPower", MultiplierTabIcons.PELLE),

  dilationOrdered: orderedIDEntry("Dilation", "dilation", MultiplierTabIcons.UPGRADE("dilation")),
  effarigOrdered: orderedIDEntry("Effarig's Reality", "effarig", MultiplierTabIcons.GENERIC_GLYPH),
  vNerfOrdered: orderedIDEntry("V's Reality", "vNerf", MultiplierTabIcons.GENERIC_V),
  pelleStrikeOrdered: orderedIDEntry("Pelle Power Galaxies Strike", "pelleStrike", MultiplierTabIcons.PELLE),

  postDilationPowers: orderedIDEntry(
    "Post-Dilation Powers", "postDilationPowers", MultiplierTabIcons.UPGRADE("infinity"), true
  ),
  ascensionTimeStudy72Power: orderedIDEntry(
    "Ascended Time Study 72", "ascensionTimeStudy72Power", MultiplierTabIcons.TIME_STUDY
  ),
  breakEternityPower: orderedIDEntry(
    "Break Eternity ID Power", "breakEternityPower", MultiplierTabIcons.UPGRADE("infinity")
  ),
  alphaTier8Power: orderedIDEntry("Alpha ID8 Reward", "alphaTier8Power", MultiplierTabIcons.UPGRADE("infinity")),
  alphaTier1Power: orderedIDEntry(
    "Alpha Eternity Upgrade Reward", "alphaTier1Power", MultiplierTabIcons.UPGRADE("eternity")
  ),
  alphaNerfPower: orderedIDEntry("Alpha ID Nerf", "alphaNerfPower", MultiplierTabIcons.UPGRADE("infinity")),
  dualityPower: orderedIDEntry("Duality Upgrade 8", "dualityPower", MultiplierTabIcons.UPGRADE("imaginary")),
  replicantiSurgePower: orderedIDEntry(
    "Duplicated Surge", "replicantiSurgePower", MultiplierTabIcons.SPECIFIC_GLYPH("replication")
  ),
  achievementSurgePower: orderedIDEntry("Achievement Surge", "achievementSurgePower", MultiplierTabIcons.ACHIEVEMENT),

  etherealOrdered: orderedIDEntry("Ethereal Stars", "ethereal", MultiplierTabIcons.UPGRADE("imaginary")),
  overchargeOrdered: orderedIDEntry("Endgame Overcharge", "overcharge", MultiplierTabIcons.UPGRADE("imaginary")),
  overflow1Ordered: orderedIDEntry("Infinity Dimension Overflow", "overflow1", MultiplierTabIcons.DIMENSION("ID")),
  overflow2Ordered: orderedIDEntry(
    "Infinity Dimension Second Overflow", "overflow2", MultiplierTabIcons.DIMENSION("ID")
  ),
  tickspeedOrdered: orderedIDEntry("Tickspeed (EC7)", "tickspeed", MultiplierTabIcons.TICKSPEED),
  ec11OverrideOrdered: orderedIDEntry(
    "Eternity Challenge 11 Override", "ec11Override", MultiplierTabIcons.CHALLENGE("eternity")
  ),
  traceMismatchOrdered: orderedIDEntry(
    "Untracked ID Formula Difference", "traceMismatch", MultiplierTabIcons.DIMENSION("ID")
  ),

};
