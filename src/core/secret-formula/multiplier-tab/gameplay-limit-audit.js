// Inspect the real gameplay production/multiplier methods, not the statistics
// shadow formula. No player state is mutated and results are gathered only by
// the statistics UI at its own low refresh rate.
import { stageReductionOoM } from "./antimatter-production-audit";

const SOURCES = {
  AD: { all: () => AntimatterDimensions.all, endpoint: "Per-tier AD production (NOT AD multipliers or AM/sec)" },
  ID: { all: () => InfinityDimensions.all, endpoint: "Per-tier ID multipliers (NOT current Infinity Power/sec)" },
  TD: { all: () => TimeDimensions.all, endpoint: "Per-tier TD multipliers (NOT current Time Shards/sec)" },
};

export function gameplayLimitSnapshot(resource) {
  const source = SOURCES[resource];
  if (!source) return { groups: [], endpoint: "" };
  const grouped = new Map();
  for (const dimension of source.all()) {
    if (!dimension.isProducing) continue;
    const checkpoints = [];
    if (resource === "AD") dimension.productionPerSecondWithMultiplier(undefined, checkpoints);
    else dimension.multiplierWithEtherealStar(undefined, null, checkpoints);
    for (const step of checkpoints) {
      if ((step.type !== "hardcap" && step.type !== "softcap") ||
          step.after === undefined || !step.before.gt(step.after)) continue;
      const loss = stageReductionOoM(step);
      let group = grouped.get(step.key);
      if (!group) {
        group = { key: step.key, type: step.type, label: step.display || (step.key === "overflow1" ? "First multiplier overflow" :
            step.key === "overflow2" ? "Second multiplier overflow" : step.key),
          threshold: step.threshold ?? null, combinedOoM: DC.D0, tiers: [], zero: false };
        grouped.set(step.key, group);
      }
      if (loss === null) group.zero = true;
      else group.combinedOoM = group.combinedOoM.add(loss);
      group.tiers.push({ tier: dimension.tier, before: step.before, after: step.after, loss });
    }
  }
  return { groups: [...grouped.values()], endpoint: source.endpoint };
}
