import { GameSpeedBreakdown } from "./game-speed-breakdown";
import { MultiplierTabIcons } from "./icons";

export const gamespeed = {
  total: {
    name: "Game speed",
    displayOverride: () => Enslaved.isStoringRealTime
      ? `Simulation paused (real time stored); computed multiplier ${formatX(getGameSpeedupForDisplay(), 2, 2)}`
      : `${formatX(getGameSpeedupForDisplay(), 2, 2)} (current display speed)`,
    multValue: () => getGameSpeedupForDisplay(),
    isActive: () => PlayerProgress.seenAlteredSpeed(),
    isOrdered: true,
    overlay: ["Δ", `<i class="fas fa-clock" />`, `<i class="fas fa-circle" />`],
    icon: MultiplierTabIcons.GAMESPEED,
  },
  base: {
    name: "Base speed (×1)",
    transformValue: () => GameSpeedBreakdown.transform("base"),
    isActive: true,
    icon: MultiplierTabIcons.GAMESPEED,
  },
  fixed: {
    name: "EC12 / Overcharge: fixed speed",
    transformValue: () => GameSpeedBreakdown.transform("fixed"),
    isActive: true,
    icon: MultiplierTabIcons.CHALLENGE("eternity"),
  },
  blackHole: {
    name: "Black Holes / inverted BH / V / Resurgence",
    transformValue: () => GameSpeedBreakdown.transform("blackHole"),
    isActive: true,
    icon: MultiplierTabIcons.BLACK_HOLE,
  },
  singularity: {
    name: "Singularity milestone",
    transformValue: () => GameSpeedBreakdown.transform("singularity"),
    isActive: true,
    icon: MultiplierTabIcons.SINGULARITY,
  },
  timeGlyph: {
    name: "Time Glyph - speed multiplier",
    transformValue: () => GameSpeedBreakdown.transform("timeGlyph"),
    isActive: true,
    icon: MultiplierTabIcons.GENERIC_GLYPH,
  },
  effarigGlyphPower: {
    name: "Effarig Glyph - speed power",
    transformValue: () => GameSpeedBreakdown.transform("effarigGlyphPower"),
    isActive: true,
    icon: MultiplierTabIcons.GENERIC_GLYPH,
  },
  celestialMatter: {
    name: "Celestial Matter - CM ^ conversion exponent",
    transformValue: () => GameSpeedBreakdown.transform("celestialMatter"),
    isActive: true,
    icon: MultiplierTabIcons.GAMESPEED,
  },
  celestialIP: {
    name: "Celestial Infinity Upgrade - game speed",
    transformValue: () => GameSpeedBreakdown.transform("celestialIP"),
    isActive: true,
    icon: MultiplierTabIcons.UPGRADE("infinity"),
  },
  raTesseract: {
    name: "Ra - Tesseract speed boost",
    transformValue: () => GameSpeedBreakdown.transform("raTesseract"),
    isActive: true,
    icon: MultiplierTabIcons.UPGRADE("reality"),
  },
  raPower: {
    name: "Ra - Game speed improvement power",
    transformValue: () => GameSpeedBreakdown.transform("raPower"),
    isActive: true,
    icon: MultiplierTabIcons.UPGRADE("reality"),
  },
  timeStorage: {
    name: "Enslaved - time storage affine transform",
    transformValue: () => GameSpeedBreakdown.transform("timeStorage"),
    isActive: true,
    icon: MultiplierTabIcons.BH_PULSE,
  },
  celestialNerf: {
    name: "Effarig / Lai'tela game-speed transformations",
    transformValue: () => GameSpeedBreakdown.transform("celestialNerf"),
    isActive: true,
    icon: MultiplierTabIcons.GENERIC_LAITELA,
  },
  pelle: {
    name: "Pelle - repeatable game speed",
    transformValue: () => GameSpeedBreakdown.transform("pelle"),
    isActive: true,
    icon: MultiplierTabIcons.PELLE,
  },
  peak: {
    name: "Endgame upgrade - speed floor at historical peak",
    transformValue: () => GameSpeedBreakdown.transform("peak"),
    isActive: true,
    icon: MultiplierTabIcons.GAMESPEED,
  },
  clamp: {
    name: "Final game-speed limits / uncap milestone",
    transformValue: () => GameSpeedBreakdown.transform("clamp"),
    isActive: true,
    icon: MultiplierTabIcons.GAMESPEED,
  },
  autoRelease: {
    name: "Enslaved - automatic time pulse",
    transformValue: () => GameSpeedBreakdown.transform("autoRelease"),
    isActive: true,
    icon: MultiplierTabIcons.BH_PULSE,
  },
  traceMismatch: {
    name: "Untracked game-speed formula difference",
    transformValue: () => GameSpeedBreakdown.transform("traceMismatch"),
    isActive: true,
    icon: MultiplierTabIcons.GAMESPEED,
  },
};
