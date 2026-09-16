export function addOrderedTransform(steps, key, type, before, after, options = {}) {
  const transform = {
    type,
    before: new Decimal(before),
    after: new Decimal(after),
  };
  if (options.value !== undefined) transform.value = options.value;
  if (options.display !== undefined) transform.display = options.display;
  if (options.alwaysShow !== undefined) transform.alwaysShow = options.alwaysShow;
  steps[key] = transform;
  return transform.after;
}

export function orderedMultiplyStep(steps, key, current, multiplier, skipKey = null, display) {
  if (key === skipKey) return current;
  const value = new Decimal(multiplier);
  const after = current.times(value);
  return steps
    ? addOrderedTransform(steps, key, "multiply", current, after, { value, display })
    : after;
}

export function orderedPowerStep(steps, key, current, power, skipKey = null, display) {
  if (key === skipKey) return current;
  const value = new Decimal(power);
  const after = current.pow(value);
  return steps
    ? addOrderedTransform(steps, key, "power", current, after, { value, display })
    : after;
}

export function orderedTransformStep(steps, key, type, current, after, skipKey = null, options = {}) {
  if (key === skipKey) return current;
  return steps
    ? addOrderedTransform(steps, key, type, current, after, options)
    : new Decimal(after);
}

export function addOrderedFinalImpacts(steps, evaluate, finalWith, nonRemovableKeys = ["base"]) {
  const nonRemovable = new Set(nonRemovableKeys);
  for (const [key, transform] of Object.entries(steps)) {
    if (nonRemovable.has(key) || (transform.before.eq(transform.after) && !transform.alwaysShow)) continue;
    transform.finalWith = finalWith;
    // Final impact is a counterfactual replay of the entire formula. Direct-mode
    // pages must not pay for every source (and every dimension) on each refresh.
    // A trace snapshot owns its own one-shot lazy result, so Final mode and
    // expanded details still use the exact original calculation.
    Object.defineProperty(transform, "finalWithout", {
      configurable: true,
      enumerable: true,
      get() {
        const result = evaluate(key);
        Object.defineProperty(transform, "finalWithout", {
          configurable: true, enumerable: true, value: result
        });
        return result;
      }
    });
  }
}

export function orderedOoMDifference(first, second) {
  const left = new Decimal(first);
  const right = new Decimal(second);
  if (left.eq(right)) return DC.D0;
  // Formula outputs are non-negative. If exactly one side is zero, this is a real mismatch and log10 is undefined.
  if (left.lte(0) || right.lte(0)) return DC.D1;
  return left.log10().sub(right.log10()).abs();
}

export function addOrderedTraceMismatch(steps, finalWith, actual, display, tolerance = 1e-7) {
  if (orderedOoMDifference(finalWith, actual).lte(tolerance)) return null;
  return addOrderedTransform(steps, "traceMismatch", "override", finalWith, actual, { display });
}

export function aggregateOrderedTransforms(items, resourceLabel, includeFinal = true) {
  const active = items.filter(item => item.transform !== null && item.transform !== undefined);
  if (active.length === 0) return null;

  const impactLog = value => Decimal.max(value, DC.D1).log10();
  const directImpact = active.reduce((sum, item) => {
    const transform = item.transform;
    return sum.add(impactLog(transform.after).sub(impactLog(transform.before)));
  }, DC.D0);
  const finalImpact = active.reduce((sum, item) => {
    const transform = item.transform;
    if (includeFinal && transform.finalWithout !== undefined && transform.finalWithout !== null) {
      return sum.add(impactLog(transform.finalWith ?? transform.after).sub(impactLog(transform.finalWithout)));
    }
    return sum.add(impactLog(transform.after).sub(impactLog(transform.before)));
  }, DC.D0);

  const tiers = active.map(item => item.tier).filter(tier => tier !== undefined);
  const tierText = tiers.length === 1
    ? `${resourceLabel}${tiers[0]}`
    : `${tiers.length} producing ${resourceLabel} tiers`;

  // The UI clamps values below 1 before taking log10, so encode negative impacts as before > 1 -> after = 1
  // rather than as a synthetic value below 1. This preserves the sign in both Direct and Final modes.
  const directBefore = directImpact.lt(0) ? Decimal.pow10(directImpact.neg()) : DC.D1;
  const directAfter = directImpact.lt(0) ? DC.D1 : Decimal.pow10(directImpact);
  const finalWith = finalImpact.lt(0) ? DC.D1 : Decimal.pow10(finalImpact);
  const finalWithout = finalImpact.lt(0) ? Decimal.pow10(finalImpact.neg()) : DC.D1;

  return {
    type: "formula",
    before: directBefore,
    after: directAfter,
    // A direct-only aggregate must not present direct impact as a verified
    // counterfactual Final impact. Real Final impacts remain available in tier details.
    ...(includeFinal ? { finalWith, finalWithout } : {}),
    display: "",
    aggregateScope: `Overall across ${tierText}`,
    alwaysShow: active.some(item => item.transform.alwaysShow) || directImpact.neq(0) || finalImpact.neq(0),
    aggregate: true,
  };
}

export function createOrderedTransformCache(builder, maxAge = 120) {
  let cached;
  let cachedAt = -Infinity;
  return key => {
    // A single Vue update asks every visible entry for the same trace separately. Rebuilding on an exact millisecond
    // boundary can therefore replay the whole formula several times in one render and make diagnostic rows flicker.
    // Reuse one snapshot for a short window instead; this avoids redundant O(entries^2) impact replays.
    const now = Date.now();
    if (cached === undefined || now < cachedAt || now - cachedAt >= maxAge) {
      // Commit the timestamp ONLY after the builder succeeds. A thrown formula must never
      // leave an empty, apparently fresh cache behind for other entry updates to consume.
      const next = builder();
      cached = next;
      // Budget the next rebuild from completion, not from a potentially
      // expensive builder's start (which caused consecutive cache misses).
      cachedAt = Date.now();
    }
    if (key === undefined) return cached;
    return cached[key] ?? null;
  };
}
