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
    if (nonRemovable.has(key)) continue;
    transform.finalWith = finalWith;
    transform.finalWithout = evaluate(key);
  }
}

export function addOrderedTraceMismatch(steps, finalWith, actual, display) {
  return addOrderedTransform(steps, "traceMismatch", "override", finalWith, actual, { display });
}

export function createOrderedTransformCache(builder) {
  let cached = {};
  let cachedAt = -1;
  return key => {
    // One UI update asks every entry separately. This keeps a full formula replay to roughly once per render
    // while still allowing the cache to expire naturally between game ticks.
    const now = Date.now();
    if (cachedAt !== now) {
      cachedAt = now;
      cached = builder();
    }
    return cached[key] ?? null;
  };
}
