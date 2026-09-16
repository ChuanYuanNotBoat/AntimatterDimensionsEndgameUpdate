import { InfinitiesBreakdown } from "./infinities-breakdown";
import { MultiplierTabIcons } from "./icons";

export const infinities = {
  total: {
    name: "Infinities gained per Crunch",
    isBase: true,
    multValue: () => gainedInfinities(),
    transformValue: () => InfinitiesBreakdown.summary(),
    isOrdered: true,
    isActive: () => Achievement(87).isUnlocked || PlayerProgress.eternityUnlocked(),
    overlay: ["∞", "<i class='fa-solid fa-arrows-rotate' />"],
  },
  base: { name: "Base / EC4 fixed gain", icon: MultiplierTabIcons.SINGULARITY },
  achievement87: { name: "Achievement 87 (minimum ×1)", icon: MultiplierTabIcons.ACHIEVEMENT },
  achievement131: { name: "Achievement 131 - Infinities gain", icon: MultiplierTabIcons.ACHIEVEMENT },
  achievement164: { name: "Achievement 164", icon: MultiplierTabIcons.ACHIEVEMENT },
  study32: { name: "Time Study 32", icon: MultiplierTabIcons.TIME_STUDY },
  study191: { name: "Time Study 191 - Infinities gain", icon: MultiplierTabIcons.TIME_STUDY },
  reality5: { name: "Reality Upgrade 5 - Boundless Amplifier", icon: MultiplierTabIcons.UPGRADE("reality") },
  reality7: { name: "Reality Upgrade 7 - Innumerably Construct", icon: MultiplierTabIcons.UPGRADE("reality") },
  glyph: { name: "Infinity-gain Glyph effects", icon: MultiplierTabIcons.GENERIC_GLYPH },
  ra: { name: "Ra - Time Theorem boost", icon: MultiplierTabIcons.GENERIC_RA },
  nullUpgrade: { name: "Null Upgrade - Infinity gain", icon: MultiplierTabIcons.GENERIC_GLYPH },
  singularity: { name: "Singularity Milestone - Infinity gain power", icon: MultiplierTabIcons.SINGULARITY },
  alphaEC10: { name: "Alpha - EC10 power", icon: MultiplierTabIcons.TIME_STUDY },
  currencySurge: { name: "Resurgence - Infinities currency power", icon: MultiplierTabIcons.SINGULARITY },
  chargedInfinityGen: { name: "Charged Infinity generator power", icon: MultiplierTabIcons.UPGRADE("infinity") },
  traceMismatch: { name: "Untracked Infinity gain difference", icon: MultiplierTabIcons.SINGULARITY },
};
for (const [key, entry] of Object.entries(infinities)) {
  if (key === "total") continue;
  entry.transformValue = () => InfinitiesBreakdown.transform(key);
  entry.isActive = true;
  entry.multValue = 1;
  entry.powValue = 1;
}
