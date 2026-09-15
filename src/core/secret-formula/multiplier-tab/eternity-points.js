import { PlayerProgress } from "../../player-progress";

import { EternityPointBreakdown } from "./eternity-point-breakdown";
import { MultiplierTabIcons } from "./icons";

// See index.js for documentation
export const EP = {
  total: {
    name: "Total EP Gained on Eternity",
    displayOverride: () => (Player.canEternity
      ? format(gainedEternityPoints(), 2, 2)
      : "Cannot Eternity"),
    multValue: () => (Player.canEternity ? gainedEternityPoints() : 1),
    isActive: () => PlayerProgress.eternityUnlocked() || Player.canEternity,
    isOrdered: true,
    overlay: ["Δ", "<i class='fa-solid fa-layer-group' />"],
    icon: { symbol: "<b>Δ</b>", color: "var(--color-eternity)" },
  },
  base: {
    name: "Base Eternity Points",
    isBase: true,
    fakeValue: DC.D5,
    multValue: () => EternityPointBreakdown.baseAt308(),
    transformValue: () => EternityPointBreakdown.transform("base"),
    isActive: () => PlayerProgress.eternityUnlocked(),
    icon: MultiplierTabIcons.CONVERT_FROM("IP"),
  },
  IP: {
    name: "Eternity Points from Infinity Points",
    displayOverride: () => `${format(player.records.thisEternity.maxIP.plus(gainedInfinityPoints()), 2, 2)} IP`,
    multValue: DC.D5,
    isActive: () => PlayerProgress.eternityUnlocked(),
    icon: MultiplierTabIcons.SPECIFIC_GLYPH("infinity"),
  },
  divisor: {
    name: "Formula Improvement",
    displayOverride: () => {
      const div = EternityPointBreakdown.divisors().improved;
      return `log(IP)/${formatInt(308)} ➜ log(IP)/${format(div, 2, 2)}`;
    },
    powValue: () => new Decimal(308).div(EternityPointBreakdown.divisors().improved),
    transformValue: () => EternityPointBreakdown.transform("divisor"),
    isActive: true,
    icon: MultiplierTabIcons.DIVISOR("EP"),
  },
  powerCompensation: {
    name: "Power Scaling Compensation",
    transformValue: () => EternityPointBreakdown.transform("powerCompensation"),
    isActive: true,
    icon: MultiplierTabIcons.DIVISOR("EP"),
  },
  eternityUpgrade: {
    name: () => `Eternity Upgrade - Repeatable ${formatX(5)} EP`,
    multValue: () => EternityPointBreakdown.eternityUpgradeMult(),
    transformValue: () => EternityPointBreakdown.transform("eternityUpgrade"),
    isActive: true,
    icon: MultiplierTabIcons.UPGRADE("eternity"),
  },
  timeStudy: {
    name: "Time Studies",
    multValue: () => EternityPointBreakdown.timeStudyMult(),
    transformValue: () => EternityPointBreakdown.transform("timeStudy"),
    isActive: true,
    icon: MultiplierTabIcons.TIME_STUDY,
  },
  glyph: {
    name: "Time Glyph EP Multiplier",
    multValue: () => EternityPointBreakdown.glyphMult(),
    transformValue: () => EternityPointBreakdown.transform("glyph"),
    isActive: true,
    icon: MultiplierTabIcons.GENERIC_GLYPH,
  },
  cursedGlyph: {
    name: "Cursed Glyph EP Multiplier",
    multValue: () => EternityPointBreakdown.cursedGlyphMult(),
    transformValue: () => EternityPointBreakdown.transform("cursedGlyph"),
    isActive: true,
    icon: MultiplierTabIcons.SPECIFIC_GLYPH("cursed"),
  },
  pelleGlyph: {
    name: "Pelle Special Glyph Effect",
    multValue: () => EternityPointBreakdown.pelleGlyphMult(),
    transformValue: () => EternityPointBreakdown.transform("pelleGlyph"),
    isActive: true,
    icon: MultiplierTabIcons.PELLE,
  },
  realityUpgrade: {
    name: "Reality Upgrade - The Knowing Existence",
    multValue: () => EternityPointBreakdown.realityUpgradeMult(),
    transformValue: () => EternityPointBreakdown.transform("realityUpgrade"),
    isActive: true,
    icon: MultiplierTabIcons.UPGRADE("reality"),
  },
  pelle: {
    name: "Pelle Strike - Vacuum Rift",
    multValue: () => EternityPointBreakdown.pelleVacuumMult(),
    transformValue: () => EternityPointBreakdown.transform("pelle"),
    isActive: true,
    icon: MultiplierTabIcons.PELLE,
  },
  iap: {
    name: "Shop Tab Purchases",
    multValue: () => EternityPointBreakdown.iapMult(),
    transformValue: () => EternityPointBreakdown.transform("iap"),
    isActive: true,
    icon: MultiplierTabIcons.IAP,
  },
  alphaTimeStudy: {
    name: "Alpha Time Study 61 Reward",
    multValue: () => EternityPointBreakdown.alphaTimeStudyMult(),
    transformValue: () => EternityPointBreakdown.transform("alphaTimeStudy"),
    isActive: true,
    icon: MultiplierTabIcons.TIME_STUDY,
  },
  nullUpgrade: {
    name: "LHC Null Upgrade - Eternity Point Multiplier",
    multValue: () => EternityPointBreakdown.nullUpgradeMult(),
    transformValue: () => EternityPointBreakdown.transform("nullUpgrade"),
    isActive: true,
    icon: MultiplierTabIcons.GENERIC_LAITELA,
  },

  nerfTeresa: {
    name: "Teresa's Reality",
    powValue: () => 0.55,
    transformValue: () => EternityPointBreakdown.transform("nerfTeresa"),
    isActive: true,
    icon: MultiplierTabIcons.GENERIC_TERESA,
  },
  nerfV: {
    name: "V's Reality",
    powValue: () => 0.5,
    transformValue: () => EternityPointBreakdown.transform("nerfV"),
    isActive: true,
    icon: MultiplierTabIcons.GENERIC_V,
  },
  nerfLaitela: {
    name: "Lai'tela's Reality - Dilation",
    transformValue: () => EternityPointBreakdown.transform("nerfLaitela"),
    isActive: true,
    icon: MultiplierTabIcons.GENERIC_LAITELA,
  },
  glyphPower: {
    name: "Time Glyph Secondary Effect",
    powValue: () => getSecondaryGlyphEffect("timeEP"),
    transformValue: () => EternityPointBreakdown.transform("glyphPower"),
    isActive: true,
    icon: MultiplierTabIcons.GENERIC_GLYPH,
  },
  endgameMastery142: {
    name: "Endgame Mastery 142",
    powValue: () => EndgameMastery(142).effectOrDefault(1),
    transformValue: () => EternityPointBreakdown.transform("endgameMastery142"),
    isActive: true,
    icon: MultiplierTabIcons.TIME_STUDY,
  },
  raPower: {
    name: "Ra - Eternity Point Power",
    powValue: () => Ra.unlocks.eternityPointPower.effectOrDefault(1),
    transformValue: () => EternityPointBreakdown.transform("raPower"),
    isActive: true,
    icon: MultiplierTabIcons.GENERIC_RA,
  },
  achievement232: {
    name: "Achievement 232",
    powValue: () => Achievement(232).effectOrDefault(1),
    transformValue: () => EternityPointBreakdown.transform("achievement232"),
    isActive: true,
    icon: MultiplierTabIcons.ACHIEVEMENT,
  },
  alphaEC10Nerf: {
    name: "Alpha Eternity Challenge 10 Nerf",
    powValue: () => AlphaUnlocks.eternityChallenge10.effects.nerf.effectOrDefault(1),
    transformValue: () => EternityPointBreakdown.transform("alphaEC10Nerf"),
    isActive: true,
    icon: MultiplierTabIcons.CHALLENGE("eternity"),
  },
  alphaTD8Nerf: {
    name: "Alpha Time Dimension 8 Nerf",
    powValue: () => AlphaUnlocks.timeDimension8.effects.nerf.effectOrDefault(1),
    transformValue: () => EternityPointBreakdown.transform("alphaTD8Nerf"),
    isActive: true,
    icon: MultiplierTabIcons.CHALLENGE("eternity"),
  },
  ascensionEPPower: {
    name: "Ascension - Repeatable EP Power",
    powValue: () => EternityUpgrade.epMult.effectOrDefault(1),
    transformValue: () => EternityPointBreakdown.transform("ascensionEPPower"),
    isActive: true,
    icon: MultiplierTabIcons.UPGRADE("eternity"),
  },
  alphaHardcap: {
    name: "Alpha Eternity Point Hardcap",
    transformValue: () => EternityPointBreakdown.transform("alphaHardcap"),
    isActive: true,
    icon: MultiplierTabIcons.UPGRADE("reality"),
  },
  epSurge: {
    name: "Eternal Surge - EP equals Antimatter",
    transformValue: () => EternityPointBreakdown.transform("epSurge"),
    isActive: true,
    icon: MultiplierTabIcons.UPGRADE("reality"),
  },
  floor: {
    name: "Final Integer Rounding",
    transformValue: () => EternityPointBreakdown.transform("floor"),
    isActive: true,
    icon: MultiplierTabIcons.DIVISOR("EP"),
  },
  traceMismatch: {
    name: "Untracked EP Formula Difference",
    transformValue: () => EternityPointBreakdown.transform("traceMismatch"),
    isActive: true,
    icon: MultiplierTabIcons.DIVISOR("EP"),
  },
};
