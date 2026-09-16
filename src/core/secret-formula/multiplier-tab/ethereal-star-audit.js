import { getDimensionFinalMultiplierUncached } from "../../dimensions/antimatter-dimension";

// These measurements intentionally use the real gameplay multipliers/production
// and NEVER the statistics trace or its synthetic aggregate factors.
// A counterfactual changes one star exponent to its neutral value, 1, without
// altering player state, caches, any other star, or the active challenges.
const STAR_BY_RESOURCE = {
  AD: { color: "red", producer: tier => AntimatterDimension(tier), all: () => AntimatterDimensions.all },
  ID: { color: "orange", producer: tier => InfinityDimension(tier), all: () => InfinityDimensions.all },
  TD: { color: "purple", producer: tier => TimeDimension(tier), all: () => TimeDimensions.all },
};

export function starResourceForEntry(key) {
  const match = /^(AD_etherealStars|ID_etherealOrdered|TD_etherealOrdered)(?:_([1-8]))?$/.exec(key);
  if (!match) return null;
  return { resource: match[1].slice(0, 2), tier: match[2] ? Number(match[2]) : null };
}

function withoutStarMultiplier(resource, tier) {
  if (resource === "AD") return getDimensionFinalMultiplierUncached(tier, DC.D1);
  if (resource === "ID") return InfinityDimension(tier).multiplierWithEtherealStar(DC.D1);
  return TimeDimension(tier).multiplierWithEtherealStar(DC.D1);
}

function logDifference(withValue, withoutValue) {
  if (withValue.eq(withoutValue)) return DC.D0;
  if (withValue.lte(0) || withoutValue.lte(0)) return null;
  return withValue.log10().sub(withoutValue.log10());
}

function endpoint(resource, overrideMultiplier) {
  const realSeconds = new Decimal(getGameSpeedupForDisplay());
  if (resource === "AD") {
    const first = AntimatterDimension(1);
    const firstProduction = overrideMultiplier
      ? first.productionPerSecondWithMultiplier(overrideMultiplier(1))
      : first.productionPerSecond;
    const secondProduction = NormalChallenge(12).isRunning
      ? (overrideMultiplier
        ? AntimatterDimension(2).productionPerSecondWithMultiplier(overrideMultiplier(2))
        : AntimatterDimension(2).productionPerSecond)
      : DC.D0;
    return {
      label: LHC.voidRunning ? "Displayed AM/sec (Void tick gain differs)" : "AM/sec",
      value: firstProduction.plus(secondProduction).times(realSeconds),
    };
  }
  const first = resource === "ID" ? InfinityDimension(1) : TimeDimension(1);
  const production = overrideMultiplier
    ? first.productionPerSecondWithMultiplier(overrideMultiplier(1))
    : first.productionPerSecond;
  return {
    label: resource === "ID"
      ? (EternityChallenge(7).isRunning ? "AD7 production/sec (EC7)" : "Infinity Power/sec")
      : (EternityChallenge(7).isRunning ? "ID8 production/sec (EC7)" : "Time Shards/sec"),
    value: production.times(realSeconds),
  };
}

export function auditEtherealStar(resource, tier = null) {
  const star = STAR_BY_RESOURCE[resource];
  if (!star) return null;
  const power = EtherealStars[star.color].reward;
  const all = star.all().filter(dimension => dimension.isProducing && (tier === null || dimension.tier === tier));
  let directStarOoM = DC.D0;
  let combinedMultiplierOoM = DC.D0;
  let mismatch = false;
  for (const dimension of all) {
    const live = dimension.multiplier;
    const checkpoint = { before: DC.D1, after: DC.D1 };
    const replayed = resource === "AD"
      ? getDimensionFinalMultiplierUncached(dimension.tier, power, checkpoint)
      : dimension.multiplierWithEtherealStar(power, checkpoint);
    const direct = logDifference(checkpoint.after, checkpoint.before);
    if (direct !== null) directStarOoM = directStarOoM.add(direct);
    const discrepancy = logDifference(live, replayed);
    if (discrepancy === null || discrepancy.abs().gt(1e-7)) mismatch = true;
    const without = withoutStarMultiplier(resource, dimension.tier);
    const delta = logDifference(live, without);
    if (delta !== null) combinedMultiplierOoM = combinedMultiplierOoM.add(delta);
  }
  // Actual resource production comes from the FIRST tier only. Upper-tier
  // production feeds lower tiers over future ticks; multiplying all eight
  // tier impacts does not measure an instantaneous currency production gain.
  const current = endpoint(resource);
  const without = endpoint(resource, n => (tier !== null && tier !== n
    ? star.producer(n).multiplier
    : withoutStarMultiplier(resource, n)));
  return {
    color: star.color,
    count: player.endgame.ethereal.stars[star.color],
    grayBoost: Ethereal.starBoost,
    exponent: power,
    tierCount: all.length,
    scope: tier === null ? "All producing tiers (multiplier product only)" : `${resource}${tier} multiplier`,
    directStarOoM,
    multiplierOoM: combinedMultiplierOoM,
    propagation: resource === "AD"
      ? "Red Star → AD multipliers → AD1 production → AM (NC12 also adds AD2). Higher AD tiers feed lower tiers over later ticks."
      : resource === "ID"
        ? "Orange Star → ID multipliers → ID1 → Infinity Power (EC7: AD7). Infinity Power changes AD multipliers after it accumulates."
        : "Purple Star → TD multipliers → TD1 → Time Shards (EC7: ID8). Time Shards affect Tickspeed after accumulation; TD1 also has a Time Shard Glyph power.",
    endpointLabel: current.label,
    currentProduction: current.value,
    withoutProduction: without.value,
    productionOoM: logDifference(current.value, without.value),
    mismatch,
  };
}
