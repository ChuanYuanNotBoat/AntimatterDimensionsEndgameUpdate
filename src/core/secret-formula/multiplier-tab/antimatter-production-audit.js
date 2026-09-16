// Antimatter production diagnostics read checkpoints recorded by the gameplay
// getter itself. These values are not inferred from multiplier-tab weights.
import { orderedOoMDifference } from "./ordered-breakdown";

export function antimatterProductionSnapshot() {
  const ad1 = AntimatterDimension(1);
  const steps = [];
  const perGameSecond = ad1.productionPerSecondWithMultiplier(undefined, steps);
  const speed = new Decimal(getGameSpeedupForDisplay());
  const nc12 = NormalChallenge(12).isRunning;
  const ad2PerGameSecond = nc12 ? AntimatterDimension(2).productionPerSecond : DC.D0;
  // Currency.antimatter.productionPerSecond first converts each producer to real seconds,
  // then adds NC12 AD2; preserve this ordering for extreme-value precision.
  const ad1Real = perGameSecond.times(speed);
  const ad2Real = ad2PerGameSecond.times(speed);
  const calculated = nc12 ? ad1Real.plus(ad2Real) : ad1Real;
  const actual = Currency.antimatter.productionPerSecond;
  const amount = ad1.totalAmount;
  const multiplier = ad1.multiplier;
  const raw = steps.find(step => step.key === "raw")?.after ?? DC.D0;
  const finalHardcap = steps.find(step => step.key === "challengeCap");
  const activeStages = steps.filter(step => step.key !== "raw" &&
    (step.before.neq(step.after) || step.key === "challengeCap"));
  return {
    actual, calculated, mismatch: orderedOoMDifference(actual, calculated).gt(1e-7),
    amount, multiplier, tickRate: Tickspeed.perSecond, raw,
    perGameSecond, speed, ad1Real,
    nc12, ad2Real, activeStages,
    finalHardcap, voidRunning: LHC.voidRunning,
  };
}

// A reduction must be expressed at the same stage, never relative to the
// product of all eight AD multipliers or to a different production endpoint.
export function stageReductionOoM(step) {
  if (!step.before.gt(step.after)) return DC.D0;
  if (step.after.lte(0)) return null;
  return step.before.log10().sub(step.after.log10());
}
