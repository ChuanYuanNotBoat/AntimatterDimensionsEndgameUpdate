// Diagnostic-only safety check: do not cap a failed calculation or rewrite a save.
// Keep raw Decimal components: calling toNumber() or format() here loses the evidence.
function dimensionNumberDetails(value) {
  if (value instanceof Decimal) {
    return `Decimal(sign=${value.sign}, layer=${value.layer}, mag=${value.mag})`;
  }
  return String(value);
}

export function assertDimensionFinite(value, dimension, step, diff, destination = null) {
  const valid = value instanceof Decimal
    ? Number.isFinite(value.sign) && Number.isFinite(value.layer) && Number.isFinite(value.mag)
    : typeof value === "number" && Number.isFinite(value);
  if (valid) return value;
  const sourceName = `${dimension.constructor.name}(${dimension.tier})`;
  const targetName = destination ? ` -> ${destination.constructor.name}(${destination.tier})` : "";
  // Getters can fail while producing the bad value; a diagnostic must never replace the original failure.
  const describe = getter => {
    try { return dimensionNumberDetails(getter()); } catch (error) { return `getter failed: ${error.message}`; }
  };
  throw new Error(
    `Dimension non-finite at ${sourceName}${targetName}, step=${step}; ` +
    `value=${dimensionNumberDetails(value)}; diff=${dimensionNumberDetails(diff)}; ` +
    `sourceAmount=${describe(() => dimension.amount)}; ` +
    `sourceMultiplier=${describe(() => dimension.multiplier)}`
  );
}

export class DimensionState {
  constructor(getData, tier) {
    this._tier = tier;
    this._getData = getData;
    const DISPLAY_NAMES = [null, "First", "Second", "Third", "Fourth", "Fifth", "Sixth", "Seventh", "Eighth"];
    this._displayName = DISPLAY_NAMES[tier];
    const SHORT_DISPLAY_NAMES = [null, "1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th"];
    this._shortDisplayName = SHORT_DISPLAY_NAMES[tier];
  }

  get tier() { return this._tier; }

  get displayName() { return this._displayName; }
  get shortDisplayName() { return this._shortDisplayName; }

  get data() { return this._getData()[this.tier - 1]; }

  /** @returns {Decimal} */
  get amount() { return this.data.amount; }
  /** @param {Decimal} value */
  set amount(value) { this.data.amount = value; }

  /** @returns {number} */
  get bought() { return this.data.bought; }
  /** @param {number} value */
  set bought(value) { this.data.bought = value; }

  /** @abstract */
  get productionPerSecond() { throw new NotImplementedError(); }

  get productionPerRealSecond() {
    return this.productionPerSecond.times(getGameSpeedupForDisplay());
  }

  productionForDiff(diff) {
    const rate = assertDimensionFinite(this.productionPerSecond, this, "productionPerSecond", diff);
    assertDimensionFinite(diff, this, "diff", diff);
    const product = assertDimensionFinite(rate.times(diff), this, "rate * diff", diff);
    return assertDimensionFinite(product.div(1000), this, "rate * diff / 1000", diff);
  }

  produceCurrency(currency, diff) {
    currency.add(this.productionForDiff(diff));
  }

  produceDimensions(dimension, diff) {
    const gain = this.productionForDiff(diff);
    const before = assertDimensionFinite(dimension.amount, this, "destination amount before production", diff, dimension);
    const after = assertDimensionFinite(before.plus(gain), this, "destination amount + gain", diff, dimension);
    dimension.amount = after;
  }

  static get dimensionCount() { return 8; }

  static createAccessor() {
    const index = Array.range(1, this.dimensionCount).map(tier => new this(tier));
    index.unshift(null);
    const accessor = tier => index[tier];
    accessor.index = index;
    return accessor;
  }
}
