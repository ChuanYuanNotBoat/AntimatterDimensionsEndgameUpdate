import { PlayerProgress } from "../../player-progress";

import { InfinityPointBreakdown } from "./infinity-point-breakdown";
import { MultiplierTabIcons } from "./icons";

// See index.js for documentation
export const IP = {
  total: {
    name: "Total IP Gained on Infinity",
    displayOverride: () => (Player.canCrunch
      ? format(gainedInfinityPoints(), 2, 2)
      : "Cannot Crunch"),
    // This effectively hides everything if the player can't actually gain any
    multValue: () => (Player.canCrunch ? gainedInfinityPoints() : 1),
    isActive: () => PlayerProgress.infinityUnlocked() || Player.canCrunch,
    isOrdered: true,
    overlay: ["∞", "<i class='fa-solid fa-layer-group' />"],
  },
  base: {
    name: "Base Infinity Points",
    isBase: true,
    fakeValue: DC.D5,
    multValue: () => InfinityPointBreakdown.baseAt308(),
    transformValue: () => InfinityPointBreakdown.transform("base"),
    isActive: () => player.break || Player.canCrunch,
    icon: MultiplierTabIcons.CONVERT_FROM("AM"),
  },
  antimatter: {
    name: "Infinity Points from Antimatter",
    displayOverride: () => `${format(player.records.thisInfinity.maxAM, 2, 2)} AM`,
    // Just needs to match the value in base and be larger than 1
    multValue: DC.D5,
    isActive: () => player.break,
    icon: MultiplierTabIcons.ANTIMATTER,
  },
  divisor: {
    name: "Formula Improvement",
    displayOverride: () => {
      const div = InfinityPointBreakdown.divisors().improved;
      return `log(AM)/${formatInt(308)} ➜ log(AM)/${format(div, 2, 1)}`;
    },
    powValue: () => new Decimal(308).div(InfinityPointBreakdown.divisors().improved),
    transformValue: () => InfinityPointBreakdown.transform("divisor"),
    isActive: true,
    icon: MultiplierTabIcons.DIVISOR("IP"),
  },
  powerCompensation: {
    name: "Power Scaling Compensation",
    transformValue: () => InfinityPointBreakdown.transform("powerCompensation"),
    isActive: true,
    icon: MultiplierTabIcons.DIVISOR("IP"),
  },
  effarigCap: {
    name: "Effarig Infinity Point Hardcap",
    transformValue: () => InfinityPointBreakdown.transform("effarigCap"),
    isActive: true,
    icon: MultiplierTabIcons.GENERIC_GLYPH,
  },
  infinityUpgrade: {
    name: () => `Infinity Upgrade - Repeatable ${formatX(2)} IP`,
    multValue: () => InfinityPointBreakdown.infinityUpgradeMult(),
    transformValue: () => InfinityPointBreakdown.transform("infinityUpgrade"),
    isActive: true,
    icon: MultiplierTabIcons.UPGRADE("infinity"),
  },
  achievement: {
    name: "Achievements",
    multValue: () => InfinityPointBreakdown.achievementMult(),
    transformValue: () => InfinityPointBreakdown.transform("achievement"),
    isActive: true,
    icon: MultiplierTabIcons.ACHIEVEMENT,
  },
  timeStudy: {
    name: "Time Studies",
    multValue: () => InfinityPointBreakdown.timeStudyMult(),
    transformValue: () => InfinityPointBreakdown.transform("timeStudy"),
    isActive: true,
    icon: MultiplierTabIcons.TIME_STUDY,
  },
  dilationUpgrade: {
    name: "Dilation Upgrade - IP multiplier based on DT",
    multValue: () => InfinityPointBreakdown.dilationUpgradeMult(),
    transformValue: () => InfinityPointBreakdown.transform("dilationUpgrade"),
    isActive: true,
    icon: MultiplierTabIcons.UPGRADE("dilation"),
  },
  glyph: {
    name: "Infinity Glyph Multiplier",
    multValue: () => InfinityPointBreakdown.glyphMult(),
    transformValue: () => InfinityPointBreakdown.transform("glyph"),
    isActive: true,
    icon: MultiplierTabIcons.GENERIC_GLYPH,
  },
  alchemy: {
    name: "Glyph Alchemy - Replicanti IP Multiplier",
    multValue: () => InfinityPointBreakdown.replicantiMult(),
    transformValue: () => InfinityPointBreakdown.transform("alchemy"),
    isActive: true,
    icon: MultiplierTabIcons.ALCHEMY,
  },
  nullUpgrade: {
    name: "LHC Null Upgrade - Infinity Point Multiplier",
    multValue: () => (LHC.voidRunning ? NullUpgrade.infinityPointMult.effectOrDefault(1) : 1),
    transformValue: () => InfinityPointBreakdown.transform("nullUpgrade"),
    isActive: true,
    icon: MultiplierTabIcons.GENERIC_LAITELA,
  },
  pelle: {
    name: "Pelle Strike - Vacuum Rift",
    multValue: () => DC.D1.timesEffectsOf(PelleRifts.vacuum),
    transformValue: () => InfinityPointBreakdown.transform("pelle"),
    isActive: true,
    icon: MultiplierTabIcons.PELLE,
  },
  pelleGlyph: {
    name: "Pelle Special Glyph Effect",
    multValue: () => Pelle.specialGlyphEffect.infinity,
    transformValue: () => InfinityPointBreakdown.transform("pelleGlyph"),
    isActive: true,
    icon: MultiplierTabIcons.PELLE,
  },
  iap: {
    name: "Shop Tab Purchases",
    multValue: () => ShopPurchase.IPPurchases.currentMult,
    transformValue: () => InfinityPointBreakdown.transform("iap"),
    isActive: true,
    icon: MultiplierTabIcons.IAP,
  },

  nerfTeresa: {
    name: "Teresa's Reality",
    powValue: () => 0.55,
    transformValue: () => InfinityPointBreakdown.transform("nerfTeresa"),
    isActive: true,
    icon: MultiplierTabIcons.GENERIC_TERESA,
  },
  nerfV: {
    name: "V's Reality",
    powValue: () => 0.5,
    transformValue: () => InfinityPointBreakdown.transform("nerfV"),
    isActive: true,
    icon: MultiplierTabIcons.GENERIC_V,
  },
  nerfLaitela: {
    name: "Lai'tela's Reality - Dilation",
    transformValue: () => InfinityPointBreakdown.transform("nerfLaitela"),
    isActive: true,
    icon: MultiplierTabIcons.GENERIC_LAITELA,
  },
  glyphPower: {
    name: "Infinity Glyph Secondary Effect",
    powValue: () => getSecondaryGlyphEffect("infinityIP"),
    transformValue: () => InfinityPointBreakdown.transform("glyphPower"),
    isActive: true,
    icon: MultiplierTabIcons.GENERIC_GLYPH,
  },
  endgameMastery141: {
    name: "Endgame Mastery 141",
    powValue: () => EndgameMastery(141).effectOrDefault(1),
    transformValue: () => InfinityPointBreakdown.transform("endgameMastery141"),
    isActive: true,
    icon: MultiplierTabIcons.TIME_STUDY,
  },
  alphaPower: {
    name: "Alpha Infinity Reward",
    powValue: () => AlphaUnlocks.infinity.effects.buff.effectOrDefault(1),
    transformValue: () => InfinityPointBreakdown.transform("alphaPower"),
    isActive: true,
    icon: MultiplierTabIcons.UPGRADE("reality"),
  },
  alphaStageNerf: {
    name: "Alpha Infinity Dimension Nerf",
    powValue: () => AlphaUnlocks.infinityDimensions.effects.nerf.effectOrDefault(1),
    transformValue: () => InfinityPointBreakdown.transform("alphaStageNerf"),
    isActive: true,
    icon: MultiplierTabIcons.CHALLENGE("infinity"),
  },
  alphaECNerf: {
    name: "Alpha Eternity Challenge Nerf",
    powValue: () => Effects.min(
      1,
      AlphaUnlocks.eternityChallengeUnlock.effects.nerf,
      AlphaUnlocks.ecCompletion1.effects.nerf,
      AlphaUnlocks.ecCompletion5.effects.nerf
    ),
    transformValue: () => InfinityPointBreakdown.transform("alphaECNerf"),
    isActive: true,
    icon: MultiplierTabIcons.CHALLENGE("eternity"),
  },
  replicantiSurge: {
    name: "Duplicated Surge - Replicanti IP Power",
    powValue: () => ReplicantiMultipliers.ipPow,
    transformValue: () => InfinityPointBreakdown.transform("replicantiSurge"),
    isActive: true,
    icon: MultiplierTabIcons.ALCHEMY,
  },
  ascensionIPPower: {
    name: "Ascension - Repeatable IP Power",
    powValue: () => InfinityUpgrade.ipMult.effectOrDefault(1),
    transformValue: () => InfinityPointBreakdown.transform("ascensionIPPower"),
    isActive: true,
    icon: MultiplierTabIcons.UPGRADE("infinity"),
  },
  ipSurge: {
    name: "Boundless Surge - IP equals Antimatter",
    transformValue: () => InfinityPointBreakdown.transform("ipSurge"),
    isActive: true,
    icon: MultiplierTabIcons.UPGRADE("reality"),
  },
  floor: {
    name: "Final Integer Rounding",
    transformValue: () => InfinityPointBreakdown.transform("floor"),
    isActive: true,
    icon: MultiplierTabIcons.DIVISOR("IP"),
  },
  traceMismatch: {
    name: "Untracked IP Formula Difference",
    transformValue: () => InfinityPointBreakdown.transform("traceMismatch"),
    isActive: true,
    icon: MultiplierTabIcons.DIVISOR("IP"),
  },
};
