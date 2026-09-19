import { MultiplierTabIcons } from "./icons";
import { TickspeedBreakdown } from "./tickspeed-breakdown";

// One-source-at-a-time marginal *final* effects, recomputed using the gameplay's
// own galaxy count and multiplier functions. These are not additive and are never
// presented as independent galaxy production or as a second source of Galaxy Power.
export const galaxies = {
  antimatter: {
    name: "Antimatter Galaxies",
    transformValue: () => TickspeedBreakdown.galaxySource("antimatter"),
    isActive: true,
    icon: MultiplierTabIcons.ANTIMATTER,
  },
  generated: {
    name: "Galaxy Generator - generated AG",
    transformValue: () => TickspeedBreakdown.galaxySource("generated"),
    isActive: true,
    icon: MultiplierTabIcons.GALAXY,
  },
  replicanti: {
    name: "Replicanti Galaxies (including extra and studies)",
    transformValue: () => TickspeedBreakdown.galaxySource("replicanti"),
    isActive: () => Replicanti.areUnlocked,
    icon: MultiplierTabIcons.SPECIFIC_GLYPH("replication"),
  },
  tachyon: {
    name: "Tachyon Galaxies (with Alternation)",
    transformValue: () => TickspeedBreakdown.galaxySource("tachyon"),
    isActive: () => player.dilation.totalTachyonGalaxies.gt(0),
    icon: MultiplierTabIcons.SPECIFIC_GLYPH("dilation"),
  },
  galactic: {
    name: "Galactic Power - free galaxies",
    transformValue: () => TickspeedBreakdown.galaxySource("galactic"),
    isActive: () => GalacticPowers.freeGalaxies.isUnlocked,
    icon: MultiplierTabIcons.GALAXY,
  },
};
