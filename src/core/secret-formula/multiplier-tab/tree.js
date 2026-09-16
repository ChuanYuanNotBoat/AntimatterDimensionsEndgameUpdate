/* eslint-disable max-depth */
/* eslint-disable camelcase */
import { AD_ORDERED_GROUPS, AD_ORDERED_KEYS } from "./antimatter-dimension-breakdown";
import { MultiplierTabHelper } from "./helper-functions";
import { multiplierTabValues } from "./values";

const dynamicGenProps = ["TP", "DT", "infinities", "eternities", "gamespeed", "replicanti"];
const propList = {
  AD: ["purchase", "dimboost", "sacrifice", "achievementMult", "achievement", "infinityUpgrade",
    "breakInfinityUpgrade", "infinityPower", "infinityChallenge", "timeStudy", "eternityChallenge", "glyph", "v",
    "alchemy", "pelle", "iap", "nullUpgrade", "breakEternityPower", "achievementSurgePower", "alphaPower", "effectNC", "nerfIC", "nerfV", "nerfCursed", "nerfPelle"],
  ID: ["purchase", "achievementMult", "achievement", "replicanti", "infinityChallenge", "timeStudy", "eternityUpgrade",
    "eternityChallenge", "glyph", "alchemy", "imaginaryUpgrade", "pelle", "iap", "nerfV", "nerfCursed", "nerfPelle"],
  TD: ["purchase", "achievementMult", "achievement", "timeStudy", "eternityUpgrade", "eternityChallenge",
    "dilationUpgrade", "realityUpgrade", "glyph", "alchemy", "imaginaryUpgrade", "pelle", "iap", "nerfV", "nerfCursed"],
  IP: ["base", "divisor", "powerCompensation", "effarigCap", "pelle", "pelleGlyph", "iap", "timeStudy",
    "achievement", "infinityUpgrade", "dilationUpgrade", "glyph", "alchemy", "nullUpgrade", "nerfTeresa", "nerfV",
    "nerfLaitela", "glyphPower", "endgameMastery141", "alphaPower", "alphaStageNerf", "alphaECNerf",
    "replicantiSurge", "ascensionIPPower", "ipSurge", "floor", "traceMismatch"],
  EP: ["base", "divisor", "powerCompensation", "eternityUpgrade", "timeStudy", "glyph", "cursedGlyph",
    "pelleGlyph", "realityUpgrade", "pelle", "iap", "alphaTimeStudy", "nullUpgrade", "nerfTeresa", "nerfV",
    "nerfLaitela", "glyphPower", "endgameMastery142", "raPower", "achievement232", "alphaEC10Nerf",
    "alphaTD8Nerf", "ascensionEPPower", "alphaHardcap", "epSurge", "floor", "traceMismatch"],
};

// Some of the props above would contain every entry except "total" in their respective value GameDB entry, so we
// generate them dynamically instead
for (const prop of dynamicGenProps) {
  propList[prop] = [];
  for (const toCopy of Object.keys(multiplierTabValues[prop])) {
    if (toCopy !== "total") propList[prop].push(toCopy);
  }
}

// Used for individual dimension breakdowns of effects (eg. full achievement mult into its values on individual ADs)
// Results in an array of ["key_1", "key_2", ... , "key_8"]
function append8(key) {
  const props = [];
  for (let dim = 1; dim <= 8; dim++) props.push(`${key}_${dim}`);
  return props;
}

// Helper method to create very long lists of entries in the tree; format is "RESOURCE_SOURCE_DIMENSION"
function getProps(resource, tier) {
  const props = propList[resource].map(s => `${resource}_${s}`);
  if (!tier) return props;
  const newProps = [];
  for (const effect of props) newProps.push(`${effect}_${tier}`);
  return newProps;
}

// Everything in multiplierTabTree is associated with values in multiplierTabValues. The only explicitly
// initialized props here are the "root" props which are viewable on the tab with full breakdowns. After the initial
// specification, all children props are dynamically added based on the arrays in the helper functions above
export const multiplierTabTree = {
  AM_total: [
    ["AD_total_1", "AM_tickRate"]
  ],
  AM_tickRate: [["AM_tickBase", "AM_tickPurchased", "AM_tickFree", "AM_tickGalaxies",
    "AM_tickRaPower", "AM_tickDilationPower", "AM_tickEffarig", "AM_tickDilation",
    "AM_tickOvercharge", "AM_tickTraceMismatch"]],
  AD_total: [
    getProps("AD"),
    append8("AD_total")
  ],
  ID_total: [
    getProps("ID"),
    append8("ID_total")
  ],
  TD_total: [
    getProps("TD"),
    append8("TD_total")
  ],
  IP_total: [
    getProps("IP")
  ],
  IP_base: [
    ["IP_antimatter"]
  ],
  EP_total: [
    getProps("EP")
  ],
  EP_base: [
    ["EP_IP"]
  ],
  TP_total: [
    getProps("TP")
  ],
  DT_total: [
    getProps("DT")
  ],
  tickspeed_total: [
    ["tickspeed_base", "tickspeed_purchased", "tickspeed_free", "tickspeed_galaxies",
      "tickspeed_raPower", "tickspeed_dilationPower", "tickspeed_effarig", "tickspeed_dilation",
      "tickspeed_overcharge", "tickspeed_dimensionExponent", "tickspeed_traceMismatch"]
  ],
  tickspeed_upgrades: [
    ["tickspeedUpgrades_purchased", "tickspeedUpgrades_free"]
  ],
  tickspeed_galaxies: [
    ["galaxies_antimatter", "galaxies_generated", "galaxies_replicanti", "galaxies_tachyon", "galaxies_galactic"]
  ],
  infinities_total: [
    getProps("infinities")
  ],
  eternities_total: [
    getProps("eternities")
  ],
  gamespeed_total: [
    getProps("gamespeed")
  ],
  replicanti_total: [
    getProps("replicanti")
  ],
};

// Non-dimension resources have a single ordered calculation view. The old current/average
// Black Hole grouping was a UI comparison, not a separate dimension-tier breakdown.

// DT now has an ordered TP base step; do not double-count TP_total as an independent modifier.

// Additional data specification for dynamically-generated props
const dimTypes = ["AD", "ID", "TD"];
// Ordered DT/Infinities/Replicanti entries already have individually traced sources.
// The legacy general_* children would show stale, un-gated values (especially in Pelle),
// so do not attach those secondary approximations below the new exact rows.
const singleRes = ["IP", "EP"];
const targetedEffects = {
  achievement: {
    checkFn: MultiplierTabHelper.achievementDimCheck,
    AD: [23, 28, 31, 34, 43, 48, 56, 64, 65, 68, 71, 72, 73, 74, 76, 84, 91, 92, 183],
    TD: [105, 128],
    IP: [85, 93, 116, 125, 141],
    DT: [132, 137],
    infinities: [87, 131, 164],
  },
  timeStudy: {
    checkFn: MultiplierTabHelper.timeStudyDimCheck,
    AD: [71, 91, 101, 161, 193, 214, 234],
    ID: [72, 82, 92, 102, 162],
    TD: [11, 73, 93, 103, 151, 221, 227, 301],
    IP: [41, 51, 141, 142, 143],
    EP: [61, 121, 122, 123],
    replicanti: [62, 132, 213],
  },
  infinityChallenge: {
    checkFn: MultiplierTabHelper.ICDimCheck,
    AD: [3, 4, 8],
    ID: [1, 6],
  },
  eternityChallenge: {
    checkFn: MultiplierTabHelper.ECDimCheck,
    ID: [2, 4, 9],
    TD: [1, 10],
  },
};

// Highest actively-producing dimensions need a special case
for (const dim of dimTypes) {
  multiplierTabTree[`${dim}_total`][0].push(`${dim}_highestDim`);
  multiplierTabTree[`${dim}_total`][1].push(`${dim}_highestDim`);
}

// EC7 also needs a special case for tickspeed, since it doesn't appear on the multipliers themselves
for (const dim of ["ID", "TD"]) {
  multiplierTabTree[`${dim}_total`][0].push(`${dim}_tickspeed`);
  multiplierTabTree[`${dim}_total`][1].push(`${dim}_tickspeed`);
}

// Dynamically generate all values from existing values, but broken down by dimension
for (const res of dimTypes) {
  for (const prop of getProps(res)) multiplierTabTree[prop] = [append8(prop)];
  for (let dim = 1; dim <= 8; dim++) multiplierTabTree[`${res}_total_${dim}`] = [getProps(res, dim)];
}

// A few dynamically-generated props are largely useless in terms of what they connect to, in that they have very few
// entries or have 8 identical entries, so we explicitly remove those lists for a cleaner appearance on the UI
const removedRegexes = ["AD_sacrifice", "AD_breakInfinityUpgrade", "AD_nerfIC", "AD_infinityUpgrade", "AD_v",
  "ID_replicanti", "ID_infinityChallenge", "ID_eternityUpgrades",
  "TD_achievement", "TD_eternityUpgrade", "TD_dilationUpgrade", "TD_realityUpgrade",
  ".._achievementMult", ".._glyph", ".._alchemy", ".._imaginaryUpgrade", ".._iap",
  ".._nerfV", ".._nerfCursed", ".._nerfPelle", ".._pelle"
];
const removedProps = Object.keys(multiplierTabTree)
  .filter(key => removedRegexes.some(regex => key.match(regex)));
for (const prop of removedProps) {
  multiplierTabTree[prop] = undefined;
}

// We need to handle infinity power multiplier a bit differently; previous steps of dynamic generation fill it with
// 8 identical AD multipliers, but we want to replace it with ID mults and the conversion rate
multiplierTabTree.AD_infinityPower = [["ID_total", "ID_powerConversion"]];
for (let dim = 1; dim <= 8; dim++) {
  multiplierTabTree[`AD_infinityPower_${dim}`] = [["ID_total", "ID_powerConversion"]];
}

// Tesseracts are added one layer deep, but we don't want to override the existing ID_purchase entry
multiplierTabTree.ID_purchase.unshift(["ID_basePurchase", "ID_tesseractPurchase",
  "ID_infinityGlyphSacrifice", "ID_powPurchase"]);
for (let dim = 1; dim <= 7; dim++) {
  multiplierTabTree[`ID_purchase_${dim}`] = [[`ID_basePurchase_${dim}`, `ID_tesseractPurchase_${dim}`,
    "ID_powPurchase"]];
}
multiplierTabTree.ID_purchase_8 = [[`ID_basePurchase_8`, `ID_infinityGlyphSacrifice`, "ID_powPurchase"]];

// These are also added one layer deep
for (let dim = 1; dim <= 7; dim++) {
  multiplierTabTree[`TD_purchase_${dim}`] = [[`TD_basePurchase_${dim}`, `TD_powPurchase_${dim}`]];
}
multiplierTabTree.TD_purchase.push(["TD_basePurchase", "TD_timeGlyphSacrifice", "TD_powPurchase"]);
multiplierTabTree.TD_purchase_8 = [["TD_basePurchase_8", "TD_timeGlyphSacrifice", "TD_powPurchase"]];

// Dynamically fill effects which only affect certain dimensions, as noted in targetedEffects
for (const res of dimTypes) {
  for (const eff of Object.keys(targetedEffects)) {
    if (!targetedEffects[eff][res]) continue;
    multiplierTabTree[`${res}_${eff}`] = [[]];
    for (const id of targetedEffects[eff][res]) {
      for (let dim = 1; dim <= 8; dim++) {
        const propStr = `${res}_${eff}_${dim}`;
        const dimStr = `${res}${dim}`;
        if (targetedEffects[eff].checkFn(id, dimStr)) {
          if (!multiplierTabTree[propStr]) multiplierTabTree[propStr] = [[]];
          multiplierTabTree[propStr][0].push(`general_${eff}_${id}_${dimStr}`);
        }
      }
      multiplierTabTree[`${res}_${eff}`][0].push(`general_${eff}_${id}_${res}`);
    }
  }
}

// Dynamically fill effects which affect single resources as well
for (const res of singleRes) {
  for (const eff of Object.keys(targetedEffects)) {
    if (!targetedEffects[eff][res]) continue;
    multiplierTabTree[`${res}_${eff}`] = [[]];
    for (const ach of targetedEffects[eff][res]) {
      multiplierTabTree[`${res}_${eff}`][0].push(`general_${eff}_${ach}`);
    }
  }
}

// Fill in eternity upgrade entries
multiplierTabTree.ID_eternityUpgrade = [[`ID_eu1`, `ID_eu2`, `ID_eu3`]];
multiplierTabTree.TD_eternityUpgrade = [[`TD_eu1`, `TD_eu2`]];
for (let dim = 1; dim <= 8; dim++) {
  multiplierTabTree[`ID_eternityUpgrade_${dim}`] = [[`ID_eu1_${dim}`, `ID_eu2_${dim}`, `ID_eu3_${dim}`]];
  multiplierTabTree[`TD_eternityUpgrade_${dim}`] = [[`TD_eu1_${dim}`, `TD_eu2_${dim}`]];
}

// ID and TD use exact ordered production traces. Their root view aggregates the same source across all producing
// tiers (matching the original overall/individual-dimension UX), while the tier selector opens the exact sequential
// formula for one dimension. Aggregate rows sum signed OoM impact across tiers instead of inventing a global order.

const idOrderedParents = [
  "baseAmount",
  "ec11OverrideOrdered",
  "commonEffects",
  "tierEffects",
  "orderedPurchase",
  "decayOrdered",
  "preDilationPowers",
  "dilationOrdered",
  "effarigOrdered",
  "vNerfOrdered",
  "pelleStrikeOrdered",
  "postDilationPowers",
  "etherealOrdered",
  "overchargeOrdered",
  "overflow1Ordered",
  "overflow2Ordered",
  "tickspeedOrdered",
  "traceMismatchOrdered",
];

const tdOrderedParents = [
  "baseAmount",
  "ec11OverrideOrdered",
  "alphaProductionBypassOrdered",
  "commonEffects",
  "tierEffects",
  "orderedPurchase",
  "preDilationPowers",
  "dilationOrdered",
  "effarigOrdered",
  "vNerfOrdered",
  "postDilationPowers",
  "etherealOrdered",
  "overchargeOrdered",
  "overflow1Ordered",
  "overflow2Ordered",
  "tickspeedOrdered",
  "timeShardGlyphPowerOrdered",
  "traceMismatchOrdered",
];

function orderedKeys(resource, props) {
  return props.map(prop => `${resource}_${prop}`);
}

function orderedDimKeys(resource, props, dim) {
  return props.map(prop => `${resource}_${prop}_${dim}`);
}

const idOverallParents = idOrderedParents.filter(prop => prop !== "baseAmount");
const tdOverallParents = tdOrderedParents.filter(prop => prop !== "baseAmount");
// Match the original grouping control: the SAME root can be displayed by source or
// by dimension, and each tier can be expanded inline. These are not separate tabs.
multiplierTabTree.ID_total = [orderedKeys("ID", idOverallParents), append8("ID_total")];
multiplierTabTree.TD_total = [orderedKeys("TD", tdOverallParents), append8("TD_total")];

multiplierTabTree.ID_commonEffects = [[
  "ID_commonIAP",
  "ID_commonAchievements",
  "ID_commonTimeStudies",
  "ID_commonInfinityChallenges",
  "ID_commonEternityChallenges",
  "ID_commonEternityUpgrades",
  "ID_commonAlchemy",
  "ID_commonImaginary",
  "ID_commonPelle",
  "ID_commonReplicanti",
  "ID_commonNull",
]];
multiplierTabTree.ID_commonAchievements = [["ID_achievement63", "ID_achievement75", "ID_achievement77"]];
multiplierTabTree.ID_commonTimeStudies = [["ID_timeStudy82", "ID_timeStudy92", "ID_timeStudy162"]];
multiplierTabTree.ID_commonInfinityChallenges = [["ID_infinityChallenge1", "ID_infinityChallenge6"]];
multiplierTabTree.ID_commonEternityChallenges = [["ID_eternityChallenge4", "ID_eternityChallenge9"]];
multiplierTabTree.ID_commonEternityUpgrades = [[
  "ID_eternityUpgradeEP",
  "ID_eternityUpgradeEternities",
  "ID_eternityUpgradeICRecords",
]];
multiplierTabTree.ID_tierEffects = [["ID_tierAchievement94", "ID_tierTimeStudy72", "ID_tierEC2"]];
multiplierTabTree.ID_orderedPurchase = [[
  "ID_purchaseBaseOrdered",
  "ID_purchaseGlyphSacrificeOrdered",
  "ID_purchaseImaginaryPowerOrdered",
  "ID_purchaseSingularityPowerOrdered",
]];
multiplierTabTree.ID_preDilationPowers = [[
  "ID_glyphInfinityPower",
  "ID_glyphEffarigPower",
  "ID_glyphCursedPower",
  "ID_alchemyInfinityPower",
  "ID_raMomentumPower",
  "ID_pelleParadoxPower",
  "ID_singularityDimensionPower",
  "ID_raTimeTheoremPower",
  "ID_raInfinityDimensionPower",
  "ID_pellePackPower",
]];
multiplierTabTree.ID_postDilationPowers = [[
  "ID_ascensionTimeStudy72Power",
  "ID_breakEternityPower",
  "ID_alphaTier8Power",
  "ID_alphaTier1Power",
  "ID_alphaNerfPower",
  "ID_dualityPower",
  "ID_replicantiSurgePower",
  "ID_achievementSurgePower",
]];

multiplierTabTree.TD_commonEffects = [[
  "TD_commonIAP",
  "TD_commonAchievements",
  "TD_commonTimeStudies",
  "TD_commonEternityChallenges",
  "TD_commonEternityUpgrades",
  "TD_commonRealityUpgrade",
  "TD_commonAlchemy",
  "TD_commonPelle",
  "TD_commonReplicanti",
  "TD_ec9InfinityPower",
  "TD_commonNull",
]];
multiplierTabTree.TD_commonAchievements = [["TD_achievement105", "TD_achievement128"]];
multiplierTabTree.TD_commonTimeStudies = [[
  "TD_timeStudy93",
  "TD_timeStudy103",
  "TD_timeStudy151",
  "TD_timeStudy221",
  "TD_timeStudy301",
]];
multiplierTabTree.TD_commonEternityChallenges = [["TD_eternityChallenge1", "TD_eternityChallenge10"]];
multiplierTabTree.TD_commonEternityUpgrades = [[
  "TD_eternityUpgradeAchievements",
  "TD_eternityUpgradeTheorems",
  "TD_eternityUpgradeRealTime",
]];
multiplierTabTree.TD_tierEffects = [["TD_tierTimeStudy11", "TD_tierTimeStudy73", "TD_tierTimeStudy227"]];
multiplierTabTree.TD_orderedPurchase = [[
  "TD_purchaseBaseOrdered",
  "TD_purchaseGlyphSacrificeOrdered",
  "TD_purchaseImaginaryPowerOrdered",
  "TD_purchaseSingularityPowerOrdered",
]];
multiplierTabTree.TD_preDilationPowers = [[
  "TD_glyphTimePower",
  "TD_glyphEffarigPower",
  "TD_glyphCursedPower",
  "TD_alchemyTimePower",
  "TD_raMomentumPower",
  "TD_imaginaryPower",
  "TD_pelleParadoxPower",
  "TD_singularityDimensionPower",
  "TD_raTimeTheoremPower",
  "TD_pellePackPower",
]];
multiplierTabTree.TD_postDilationPowers = [[
  "TD_ascensionTimeStudy73Power",
  "TD_breakEternityPower",
  "TD_alphaEC5Power",
  "TD_alphaTier8Power",
  "TD_replicantiSurgePower",
  "TD_achievementSurgePower",
]];

for (let dim = 1; dim <= 8; dim++) {
  multiplierTabTree[`ID_total_${dim}`] = [orderedDimKeys("ID", idOrderedParents, dim)];
  multiplierTabTree[`TD_total_${dim}`] = [orderedDimKeys("TD", tdOrderedParents, dim)];

  multiplierTabTree[`ID_commonEffects_${dim}`] = [[
    `ID_commonIAP_${dim}`,
    `ID_commonAchievements_${dim}`,
    `ID_commonTimeStudies_${dim}`,
    `ID_commonInfinityChallenges_${dim}`,
    `ID_commonEternityChallenges_${dim}`,
    `ID_commonEternityUpgrades_${dim}`,
    `ID_commonAlchemy_${dim}`,
    `ID_commonImaginary_${dim}`,
    `ID_commonPelle_${dim}`,
    `ID_commonReplicanti_${dim}`,
    `ID_commonNull_${dim}`,
  ]];
  multiplierTabTree[`ID_commonAchievements_${dim}`] = [[
    `ID_achievement63_${dim}`,
    `ID_achievement75_${dim}`,
    `ID_achievement77_${dim}`,
  ]];
  multiplierTabTree[`ID_commonTimeStudies_${dim}`] = [[
    `ID_timeStudy82_${dim}`,
    `ID_timeStudy92_${dim}`,
    `ID_timeStudy162_${dim}`,
  ]];
  multiplierTabTree[`ID_commonInfinityChallenges_${dim}`] = [[
    `ID_infinityChallenge1_${dim}`,
    `ID_infinityChallenge6_${dim}`,
  ]];
  multiplierTabTree[`ID_commonEternityChallenges_${dim}`] = [[
    `ID_eternityChallenge4_${dim}`,
    `ID_eternityChallenge9_${dim}`,
  ]];
  multiplierTabTree[`ID_commonEternityUpgrades_${dim}`] = [[
    `ID_eternityUpgradeEP_${dim}`,
    `ID_eternityUpgradeEternities_${dim}`,
    `ID_eternityUpgradeICRecords_${dim}`,
  ]];
  multiplierTabTree[`ID_tierEffects_${dim}`] = [[
    `ID_tierAchievement94_${dim}`,
    `ID_tierTimeStudy72_${dim}`,
    `ID_tierEC2_${dim}`,
  ]];
  multiplierTabTree[`ID_orderedPurchase_${dim}`] = [[
    `ID_purchaseBaseOrdered_${dim}`,
    `ID_purchaseGlyphSacrificeOrdered_${dim}`,
    `ID_purchaseImaginaryPowerOrdered_${dim}`,
    `ID_purchaseSingularityPowerOrdered_${dim}`,
  ]];
  multiplierTabTree[`ID_preDilationPowers_${dim}`] = [[
    `ID_glyphInfinityPower_${dim}`,
    `ID_glyphEffarigPower_${dim}`,
    `ID_glyphCursedPower_${dim}`,
    `ID_alchemyInfinityPower_${dim}`,
    `ID_raMomentumPower_${dim}`,
    `ID_pelleParadoxPower_${dim}`,
    `ID_singularityDimensionPower_${dim}`,
    `ID_raTimeTheoremPower_${dim}`,
    `ID_raInfinityDimensionPower_${dim}`,
    `ID_pellePackPower_${dim}`,
  ]];
  multiplierTabTree[`ID_postDilationPowers_${dim}`] = [[
    `ID_ascensionTimeStudy72Power_${dim}`,
    `ID_breakEternityPower_${dim}`,
    `ID_alphaTier8Power_${dim}`,
    `ID_alphaTier1Power_${dim}`,
    `ID_alphaNerfPower_${dim}`,
    `ID_dualityPower_${dim}`,
    `ID_replicantiSurgePower_${dim}`,
    `ID_achievementSurgePower_${dim}`,
  ]];

  multiplierTabTree[`TD_commonEffects_${dim}`] = [[
    `TD_commonIAP_${dim}`,
    `TD_commonAchievements_${dim}`,
    `TD_commonTimeStudies_${dim}`,
    `TD_commonEternityChallenges_${dim}`,
    `TD_commonEternityUpgrades_${dim}`,
    `TD_commonRealityUpgrade_${dim}`,
    `TD_commonAlchemy_${dim}`,
    `TD_commonPelle_${dim}`,
    `TD_commonReplicanti_${dim}`,
    `TD_ec9InfinityPower_${dim}`,
    `TD_commonNull_${dim}`,
  ]];
  multiplierTabTree[`TD_commonAchievements_${dim}`] = [[
    `TD_achievement105_${dim}`,
    `TD_achievement128_${dim}`,
  ]];
  multiplierTabTree[`TD_commonTimeStudies_${dim}`] = [[
    `TD_timeStudy93_${dim}`,
    `TD_timeStudy103_${dim}`,
    `TD_timeStudy151_${dim}`,
    `TD_timeStudy221_${dim}`,
    `TD_timeStudy301_${dim}`,
  ]];
  multiplierTabTree[`TD_commonEternityChallenges_${dim}`] = [[
    `TD_eternityChallenge1_${dim}`,
    `TD_eternityChallenge10_${dim}`,
  ]];
  multiplierTabTree[`TD_commonEternityUpgrades_${dim}`] = [[
    `TD_eternityUpgradeAchievements_${dim}`,
    `TD_eternityUpgradeTheorems_${dim}`,
    `TD_eternityUpgradeRealTime_${dim}`,
  ]];
  multiplierTabTree[`TD_tierEffects_${dim}`] = [[
    `TD_tierTimeStudy11_${dim}`,
    `TD_tierTimeStudy73_${dim}`,
    `TD_tierTimeStudy227_${dim}`,
  ]];
  multiplierTabTree[`TD_orderedPurchase_${dim}`] = [[
    `TD_purchaseBaseOrdered_${dim}`,
    `TD_purchaseGlyphSacrificeOrdered_${dim}`,
    `TD_purchaseImaginaryPowerOrdered_${dim}`,
    `TD_purchaseSingularityPowerOrdered_${dim}`,
  ]];
  multiplierTabTree[`TD_preDilationPowers_${dim}`] = [[
    `TD_glyphTimePower_${dim}`,
    `TD_glyphEffarigPower_${dim}`,
    `TD_glyphCursedPower_${dim}`,
    `TD_alchemyTimePower_${dim}`,
    `TD_raMomentumPower_${dim}`,
    `TD_imaginaryPower_${dim}`,
    `TD_pelleParadoxPower_${dim}`,
    `TD_singularityDimensionPower_${dim}`,
    `TD_raTimeTheoremPower_${dim}`,
    `TD_pellePackPower_${dim}`,
  ]];
  multiplierTabTree[`TD_postDilationPowers_${dim}`] = [[
    `TD_ascensionTimeStudy73Power_${dim}`,
    `TD_breakEternityPower_${dim}`,
    `TD_alphaEC5Power_${dim}`,
    `TD_alphaTier8Power_${dim}`,
    `TD_replicantiSurgePower_${dim}`,
    `TD_achievementSurgePower_${dim}`,
  ]];
}

// Replace the legacy AD graph with the tier-accurate formula tree. In particular, do not
// mix amount/production with dimension multipliers or display the old duplicated sources.
multiplierTabTree.AD_total = [AD_ORDERED_KEYS.map(key => `AD_${key}`), append8("AD_total")];
for (let tier = 1; tier <= 8; tier++) {
  multiplierTabTree[`AD_total_${tier}`] = [AD_ORDERED_KEYS.map(key => `AD_${key}_${tier}`)];
}
for (const [key, , children] of AD_ORDERED_GROUPS) {
  if (children.length === 0) continue;
  multiplierTabTree[`AD_${key}`] = [children.map(([child]) => `AD_${child}`)];
  for (let tier = 1; tier <= 8; tier++) {
    multiplierTabTree[`AD_${key}_${tier}`] = [children.map(([child]) => `AD_${child}_${tier}`)];
  }
}
