import { PlayerProgress } from "../../player-progress";
import { DilatedTimeBreakdown } from "./dilated-time-breakdown";

import { MultiplierTabIcons } from "./icons";

// See index.js for documentation
// Note most of the isActive entries in here have redundant-looking DT/s != 0 checks because DT is treated as a
// special case due to not being a prestige currency but still needing to be treated like one in the UI. This
// is because it requires dilation to be unlocked, which isn't a given, and we want the tab continuously visible
// after the first ever dilation unlock on the 0th reality
export const DT = {
  total: {
    name: "Dilated Time gain",
    displayOverride: () => `${format(getDilationGainPerSecond(), 2, 2)}/sec`,
    multValue: () => getDilationGainPerSecond(),
    transformValue: () => DilatedTimeBreakdown.summary(),
    isOrdered: true,
    isActive: () => PlayerProgress.realityUnlocked() ||
      (PlayerProgress.dilationUnlocked() && getDilationGainPerSecond().gt(0)),
    dilationEffect: () => (Enslaved.isRunning ? 0.85 : 1),
    isDilated: true,
    overlay: ["Ψ"],
  },
  achievement: {
    name: "Achievements",
    multValue: () => Achievement(132).effectOrDefault(1) * Achievement(137).effectOrDefault(1),
    isActive: () => (Achievement(132).canBeApplied || Achievement(137).canBeApplied) &&
      getDilationGainPerSecond().neq(0),
    icon: MultiplierTabIcons.ACHIEVEMENT,
  },
  dilation: {
    name: "Repeatable Dilation Upgrades",
    multValue: () => DC.D1.timesEffectsOf(
      DilationUpgrade.dtGain,
      DilationUpgrade.dtGainPelle,
      DilationUpgrade.flatDilationMult
    ),
    isActive: () => DC.D1.timesEffectsOf(
      DilationUpgrade.dtGain,
      DilationUpgrade.dtGainPelle,
      DilationUpgrade.flatDilationMult
    ).gt(1),
    icon: MultiplierTabIcons.UPGRADE("dilation"),
  },
  amplifierDT: {
    name: "Reality Upgrade - Temporal Amplifier",
    multValue: () => RealityUpgrade(1).effectOrDefault(1),
    isActive: () => RealityUpgrade(1).canBeApplied && getDilationGainPerSecond().neq(0) && !Pelle.isDoomed,
    icon: MultiplierTabIcons.UPGRADE("reality"),
  },
  glyph: {
    name: "Glyph Effects",
    multValue: () => {
      const dtMult = getAdjustedGlyphEffect("dilationDT").times(Pelle.specialGlyphEffect.dilation);
      const repliDT = Replicanti.areUnlocked
        ? Decimal.clampMin(Decimal.log10(Replicanti.amount).times(getAdjustedGlyphEffect("replicationdtgain")), 1)
        : DC.D1;
      return dtMult.times(repliDT);
    },
    isActive: () => PlayerProgress.realityUnlocked() && getDilationGainPerSecond().neq(0),
    icon: MultiplierTabIcons.GENERIC_GLYPH
  },
  ra1: {
    name: "Ra Upgrade - Multiplier based on TT",
    multValue: () => DC.D1.timesEffectsOf(Ra.unlocks.continuousTTBoost.effects.dilatedTime),
    isActive: () => Ra.unlocks.autoTP.canBeApplied && getDilationGainPerSecond().neq(0),
    icon: MultiplierTabIcons.GENERIC_RA,
  },
  ra2: {
    name: "Ra Upgrade - Multiplier based on peak game speed",
    multValue: () => DC.D1.timesEffectsOf(Ra.unlocks.peakGamespeedDT),
    isActive: () => Ra.unlocks.autoTP.canBeApplied && getDilationGainPerSecond().neq(0),
    icon: MultiplierTabIcons.GENERIC_RA,
  },
  alchemy: {
    name: "Glyph Alchemy",
    multValue: () => AlchemyResource.dilation.effectOrDefault(1),
    isActive: () => Ra.unlocks.unlockGlyphAlchemy.canBeApplied && getDilationGainPerSecond().neq(0),
    icon: MultiplierTabIcons.ALCHEMY,
  },
  iap: {
    name: "Shop Tab Purchases",
    multValue: () => new Decimal(ShopPurchase.dilatedTimePurchases.currentMult ** (Pelle.isDoomed ? 0.5 : 1)),
    isActive: () => ShopPurchaseData.totalSTD > 0 && getDilationGainPerSecond().neq(0),
    icon: MultiplierTabIcons.IAP,
  },

  nerfV: {
    name: "V's Reality",
    powValue: () => 0.5,
    isActive: () => V.isRunning && getDilationGainPerSecond().neq(0),
    icon: MultiplierTabIcons.GENERIC_V,
  },
  nerfPelle: {
    name: "Doomed Reality",
    multValue: 1e-5,
    isActive: () => Pelle.isDoomed && getDilationGainPerSecond().neq(0),
    icon: MultiplierTabIcons.PELLE,
  },
  gamespeed: {
    name: "Game speed (Alpha Reality applies ^0.01)",
    multValue: () => Alpha.isRunning ? getGameSpeedupForDisplay().pow(0.01) : getGameSpeedupForDisplay(),
    isActive: () => getGameSpeedupForDisplay().neq(1) && getDilationGainPerSecond().neq(0),
    ignoresNerfPowers: true,
    icon: MultiplierTabIcons.GAMESPEED,
  },
};

// Additional sources introduced after the legacy multiplier table was written.
// Display their exact ordered effects, including non-multiplicative transformations.
Object.assign(DT, {
  base: { name: "Tachyon Particle base (including Pelle Paradox)", icon: MultiplierTabIcons.TACHYON_PARTICLES },
  pelleGlyph: { name: "Pelle special Dilation Glyph", icon: MultiplierTabIcons.PELLE },
  replicantiGlyph: { name: "Replicanti Glyph - DT multiplier", icon: MultiplierTabIcons.GENERIC_GLYPH },
  nullUpgrade: { name: "Null Upgrade - Dilated Time", icon: MultiplierTabIcons.ALCHEMY },
  enslaved: { name: "Nameless reality - nonlinear DT reduction", icon: MultiplierTabIcons.GENERIC_ENSLAVED },
  endgameMastery: { name: "Endgame Mastery 112", icon: MultiplierTabIcons.TIME_STUDY },
  replicantiSurge: { name: "Resurgence - Replicanti DT power", icon: MultiplierTabIcons.GENERIC_GLYPH },
  currencySurge: { name: "Resurgence - DT currency power", icon: MultiplierTabIcons.GENERIC_GLYPH },
  primarySoftcap: { name: "Primary DT gain softcap", icon: MultiplierTabIcons.TACHYON_PARTICLES },
  traceMismatch: { name: "Untracked DT formula difference", icon: MultiplierTabIcons.TACHYON_PARTICLES },
});

// Override stale legacy calculations/gates. All row visibility and numerical
// contributions now come from the same ordered trace used by the root.
for (const [key, entry] of Object.entries(DT)) {
  if (key === "total") continue;
  entry.transformValue = () => DilatedTimeBreakdown.transform(key);
  entry.isActive = true;
  entry.multValue = 1;
  entry.powValue = 1;
}
