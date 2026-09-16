import Vue from "vue";

export class BreakdownEntryInfo {
  constructor(key) {
    this.key = key;
    const keyArgs = this.key.split("_");
    const dbEntry = GameDatabase.multiplierTabValues[keyArgs[0]][keyArgs[1]];
    const args = keyArgs.length >= 3
      ? keyArgs.slice(2).map(a => (a.match("^\\d+$") ? Number(a) : a))
      : [];
    this._name = createGetter(dbEntry.name, args);
    this._multValue = createGetter(dbEntry.multValue, args);
    this._powValue = createGetter(dbEntry.powValue, args);
    this._transformValue = createGetter(dbEntry.transformValue, args);
    this._dilationEffect = createGetter(dbEntry.dilationEffect, args);
    this._isActive = createGetter(dbEntry.isActive, args);
    this._fakeValue = createGetter(dbEntry.fakeValue, args);
    this._icon = createGetter(dbEntry.icon, args);
    this._displayOverride = createGetter(dbEntry.displayOverride, args);
    this._isDilated = createGetter(dbEntry.isDilated, args);
    this._isBase = createGetter(dbEntry.isBase, args);
    this._isOrdered = createGetter(dbEntry.isOrdered, args);
    this._ignoresNerfPowers = createGetter(dbEntry.ignoresNerfPowers, args);
    this._hasTransform = dbEntry.transformValue !== undefined;
    this.data = Vue.observable({
      mult: new Decimal(0),
      pow: 0,
      isVisible: false,
      lastVisibleAt: 0,
      hasTransform: false,
      transformType: "",
      transformBefore: new Decimal(1),
      transformAfter: new Decimal(1),
      transformValue: new Decimal(1),
      transformHasValue: false,
      transformDisplay: "",
      transformFinalWith: new Decimal(1),
      transformFinalWithout: new Decimal(1),
      transformHasFinalWithout: false,
      transformAggregate: false,
      transformAggregateScope: ""
    });
  }

  update(includeFinal = false) {
    const active = this.isActive;
    const transform = active ? this.getTransform(includeFinal) : null;
    // Cache the values locally. The old code evaluated both the multiplier and power
    // once for visibility and again when writing the observed data, multiplied across
    // every expanded row on each UI update.
    let mult = DC.D1;
    let pow = 1;
    let isVisible = false;
    if (active) {
      if (this._hasTransform) {
        isVisible = transform !== null && (transform.alwaysShow || transform.before.neq(transform.after));
        // Legacy consumers can still read mult/pow from transform-backed entries.
        // Keep their previous behavior while avoiding evaluation for invisible entries.
        if (isVisible) {
          mult = this.mult;
          pow = this.pow;
        }
      } else {
        mult = this.mult;
        pow = this.pow;
        isVisible = pow !== 1 || mult.neq(1);
      }
    }
    this.data.mult.fromDecimal(isVisible ? mult : DC.D1);
    this.data.pow = isVisible ? pow : 1;
    this.data.isVisible = isVisible;

    this.data.hasTransform = transform !== null;
    if (transform) {
      this.data.transformType = transform.type;
      this.data.transformBefore.fromDecimal(transform.before);
      this.data.transformAfter.fromDecimal(transform.after);
      this.data.transformHasValue = transform.value !== null;
      this.data.transformValue.fromDecimal(transform.value ?? DC.D1);
      this.data.transformDisplay = transform.display;
      this.data.transformFinalWith.fromDecimal(transform.finalWith ?? transform.after);
      this.data.transformHasFinalWithout = transform.finalWithout !== null;
      this.data.transformFinalWithout.fromDecimal(transform.finalWithout ?? transform.after);
      this.data.transformAggregate = transform.aggregate;
      this.data.transformAggregateScope = transform.aggregateScope;
    } else {
      this.data.transformType = "";
      this.data.transformBefore.fromDecimal(DC.D1);
      this.data.transformAfter.fromDecimal(DC.D1);
      this.data.transformHasValue = false;
      this.data.transformValue.fromDecimal(DC.D1);
      this.data.transformDisplay = "";
      this.data.transformFinalWith.fromDecimal(DC.D1);
      this.data.transformFinalWithout.fromDecimal(DC.D1);
      this.data.transformHasFinalWithout = false;
      this.data.transformAggregate = false;
      this.data.transformAggregateScope = "";
    }

    if (isVisible) this.data.lastVisibleAt = Date.now();
  }

  get name() {
    return this._name();
  }

  get mult() {
    return new Decimal(this._multValue() ?? 1);
  }

  get pow() {
    return this._powValue() ?? 1;
  }

  get transform() {
    return this.getTransform(false);
  }

  getTransform(includeFinal = false) {
    if (!this._hasTransform) return null;
    const raw = this._transformValue();
    if (raw === undefined || raw === null) return null;

    const before = new Decimal(raw.before ?? 1);
    const after = new Decimal(raw.after ?? before);
    // Each lazy getter must be read at most once per update.
    const finalWith = includeFinal ? raw.finalWith : null;
    const finalWithout = includeFinal && Object.hasOwn(raw, "finalWithout") ? raw.finalWithout : null;
    return {
      type: raw.type ?? "override",
      before,
      after,
      value: raw.value === undefined || raw.value === null ? null : new Decimal(raw.value),
      display: raw.display ?? "",
      alwaysShow: raw.alwaysShow ?? false,
      finalWith: finalWith === undefined || finalWith === null ? null : new Decimal(finalWith),
      // Do not access lazy finalWithout while displaying only Direct impact.
      finalWithout: finalWithout === undefined || finalWithout === null ? null : new Decimal(finalWithout),
      aggregate: raw.aggregate ?? false,
      aggregateScope: raw.aggregateScope ?? "",
    };
  }

  get dilationEffect() {
    return this._dilationEffect() ?? 1;
  }

  get isActive() {
    return this._isActive() ?? false;
  }

  get fakeValue() {
    return this._fakeValue();
  }

  get icon() {
    return this._icon();
  }

  get displayOverride() {
    return this._displayOverride();
  }

  get isDilated() {
    return this._isDilated();
  }

  get isBase() {
    return this._isBase();
  }

  get isOrdered() {
    return this._isOrdered() ?? false;
  }

  get ignoresNerfPowers() {
    return this._ignoresNerfPowers() ?? false;
  }

  isVisibleWithTransform(transform) {
    if (!this.isActive) return false;
    if (this._hasTransform) {
      return transform !== null && (transform.alwaysShow || transform.before.neq(transform.after));
    }
    return this.pow !== 1 || this.mult.neq(1);
  }

  get isVisible() {
    return this.isVisibleWithTransform(this.transform);
  }
}

function createGetter(property, args) {
  if (typeof property === "function") {
    return () => property(...args);
  }

  return () => property;
}

const cache = new Map();

export function createEntryInfo(key) {
  const cached = cache.get(key);
  if (cached !== undefined) {
    return cached;
  }
  const entry = new BreakdownEntryInfo(key);
  cache.set(key, entry);
  return entry;
}
