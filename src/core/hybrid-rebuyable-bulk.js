// Hybrid upgrades store purchase counts as Numbers even when their currency and
// inverse costs are Decimals. Plan the purchase without coercing an unbounded
// inverse, then check the actual price before modifying the save.
export function purchaseHybridRebuyableBulk(upgrade, scaling) {
  const current = upgrade.boughtAmount;
  if (!Number.isSafeInteger(current) || current < 0 || current >= Number.MAX_SAFE_INTEGER) return false;
  if (GameEnd.creditsEverClosed) return false;

  const currency = upgrade.currency;
  const money = currency.value;
  if (!Decimal.isFinite(money) || money.lt(0)) throw new Error("Invalid hybrid rebuyable currency");
  if (!upgrade.canBeBought) return false;
  const costAt = count => getHybridCostScaling(count, ...scaling);
  // The inverse implementation itself converts its estimate to Number.
  // Avoid calling it when the currency already covers the storage ceiling.
  const ceilingCost = costAt(Number.MAX_SAFE_INTEGER - 1);
  if (!Decimal.isFinite(ceilingCost) || ceilingCost.lt(0)) {
    throw new Error("Invalid hybrid rebuyable ceiling price");
  }

  let target;
  if (money.gte(ceilingCost)) {
    target = Number.MAX_SAFE_INTEGER;
  } else {
    const inverse = getInverseHybridCostScaling(money, ...scaling);
    if (!Decimal.isFinite(inverse) || inverse.lt(0)) throw new Error("Invalid hybrid rebuyable inverse");
    target = inverse.gte(Number.MAX_SAFE_INTEGER) ? Number.MAX_SAFE_INTEGER : Decimal.floor(inverse).toNumber();
    // An inaccurate inverse must not become an arbitrary number of free buys.
    if (!Number.isSafeInteger(target) || target <= current) target = current + 1;
  }

  // The legacy bulk pricing rule charges the price of the LAST purchased
  // upgrade, not the sum of all intermediate prices.
  let price = costAt(target - 1);
  if (!Decimal.isFinite(price) || price.lt(0)) throw new Error("Invalid hybrid rebuyable price");
  if (price.gt(money)) {
    target = current + 1;
    price = costAt(current);
    if (!Decimal.isFinite(price) || price.lt(0)) throw new Error("Invalid hybrid rebuyable fallback price");
    if (price.gt(money)) return false;
  }
  if (!currency.purchase(price)) return false;
  upgrade.boughtAmount = target;
  return true;
}
