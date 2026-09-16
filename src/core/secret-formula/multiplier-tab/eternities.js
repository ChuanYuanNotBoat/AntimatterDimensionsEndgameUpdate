import { EternitiesBreakdown } from "./eternities-breakdown";
import { MultiplierTabIcons } from "./icons";

export const eternities = {
  total: {
    name: "Eternities gained per Eternity",
    isBase: true,
    multValue: () => gainedEternities(),
    transformValue: () => EternitiesBreakdown.summary(),
    isOrdered: true,
    isActive: () => PlayerProgress.realityUnlocked() || Achievement(113).isUnlocked,
    overlay: ["Δ", "<i class='fa-solid fa-arrows-rotate' />"],
  },
  base: { name: "Base ×1", icon: MultiplierTabIcons.ACHIEVEMENT },
  achievement102: { name: "Achievement 102", icon: MultiplierTabIcons.ACHIEVEMENT },
  achievement113: { name: "Achievement 113", icon: MultiplierTabIcons.ACHIEVEMENT },
  reality3: { name: "Reality Upgrade 3 - Eternal Amplifier", icon: MultiplierTabIcons.UPGRADE("reality") },
  glyph: { name: "Eternity-gain Glyph effects", icon: MultiplierTabIcons.GENERIC_GLYPH },
  alchemy: { name: "Alchemy Resource - Eternity power", icon: MultiplierTabIcons.ALCHEMY },
  nullUpgrade: { name: "Null Upgrade - Eternity gain", icon: MultiplierTabIcons.ALCHEMY },
  currencySurge: { name: "Resurgence - Eternities currency power", icon: MultiplierTabIcons.ALCHEMY },
  traceMismatch: { name: "Untracked Eternity gain difference", icon: MultiplierTabIcons.ALCHEMY },
};
for (const [key, entry] of Object.entries(eternities)) {
  if (key === "total") continue;
  entry.transformValue = () => EternitiesBreakdown.transform(key);
  entry.isActive = true;
  entry.multValue = 1;
  entry.powValue = 1;
}
