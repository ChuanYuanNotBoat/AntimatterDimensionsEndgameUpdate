import { ReplicantiBreakdown } from "./replicanti-breakdown";
import { MultiplierTabIcons } from "./icons";

// Gameplay calls this "external" speed: over-cap interval scaling and celestial
// time mechanics happen outside totalReplicantiSpeedMult(). Do not claim to
// decompose the actual number of replicanti generated per second.
export const replicanti = {
  total: {
    name: "Replicanti external speed multiplier",
    multValue: () => totalReplicantiSpeedMult(Replicanti.amount.gt(replicantiCap())),
    transformValue: () => ReplicantiBreakdown.summary(),
    isOrdered: true,
    isActive: () => PlayerProgress.eternityUnlocked(),
    overlay: ["Ξ"],
  },
  base: { name: "Base ×1", icon: MultiplierTabIcons.SPECIFIC_GLYPH("replication") },
  achievement1: { name: "Achievement 81", icon: MultiplierTabIcons.ACHIEVEMENT },
  achievement2: { name: "Achievement 134 (below cap)", icon: MultiplierTabIcons.ACHIEVEMENT },
  study62: { name: "Time Study 62", icon: MultiplierTabIcons.TIME_STUDY },
  study213: { name: "Time Study 213", icon: MultiplierTabIcons.TIME_STUDY },
  study132: { name: "Time Study 132 and Passive perk", icon: MultiplierTabIcons.TIME_STUDY },
  glyph: { name: "Replication speed Glyph", icon: MultiplierTabIcons.GENERIC_GLYPH },
  glyphAlteration: { name: "Replication Glyph alteration (DT multiplier)", icon: MultiplierTabIcons.GENERIC_GLYPH },
  pelleGlyph: { name: "Pelle special replication Glyph", icon: MultiplierTabIcons.PELLE },
  pelleAlteration: { name: "Pelle-restored Replication Glyph alteration", icon: MultiplierTabIcons.PELLE },
  amplifierRep: { name: "Reality Upgrade 2 - Replicative Amplifier", icon: MultiplierTabIcons.UPGRADE("reality") },
  realityUpgrade1: { name: "Reality Upgrade 6 - Cosmically Duplicate", icon: MultiplierTabIcons.UPGRADE("reality") },
  realityUpgrade2: { name: "Reality Upgrade 23 - Replicative Rapidity", icon: MultiplierTabIcons.UPGRADE("reality") },
  alchemy: { name: "Alchemy - Replication", icon: MultiplierTabIcons.ALCHEMY },
  ra: { name: "Ra - Time Theorem boost", icon: MultiplierTabIcons.GENERIC_RA },
  pelle: { name: "Pelle - Decay Rift", icon: MultiplierTabIcons.PELLE },
  iap: { name: "Shop - Replicanti purchases", icon: MultiplierTabIcons.IAP },
  nullUpgrade: { name: "Null Upgrade - Replicanti speed", icon: MultiplierTabIcons.GENERIC_GLYPH },
  traceMismatch: { name: "Untracked external speed difference", icon: MultiplierTabIcons.SPECIFIC_GLYPH("replication") },
};

// Every row uses the actual ordered transform. In particular, inactive Pelle
// restorations must not display the pre-Pelle multipliers from a stale formula.
for (const [key, entry] of Object.entries(replicanti)) {
  if (key === "total") continue;
  entry.transformValue = () => ReplicantiBreakdown.transform(key);
  entry.isActive = true;
  entry.multValue = 1;
}
