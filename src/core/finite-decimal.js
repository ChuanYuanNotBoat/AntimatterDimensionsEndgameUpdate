// Very large powers and products can overflow the finite Decimal representation.
// Use the established DC.BEMAX boundary only for otherwise overflowing arithmetic.
const ceiling = () => DC.BEMAX;

function checkedOperand(input, label) {
  const value = new Decimal(input);
  // Never hide NaN behind a clamp, or zero multiplied by NaN could silently
  // appear to be a legitimate zero gain.
  if ([value.sign, value.layer, value.mag].some(Number.isNaN)) {
    throw new Error(`Invalid Decimal operand in ${label}`);
  }
  return value;
}

export function boundedPositivePower(base, exponent) {
  const value = Decimal.clamp(checkedOperand(base, "power base"), 0, ceiling());
  // Keep the exponent as Decimal instead of first converting it to Number.
  const power = checkedOperand(exponent, "power exponent");
  if (power.eq(0) || value.eq(1)) return DC.D1;
  if (value.eq(0)) return power.lt(0) ? ceiling() : DC.D0;
  // An overflowed *positive* exponent has a well-defined limit for positive bases.
  if (!Number.isFinite(power.layer) || !Number.isFinite(power.mag)) {
    if (power.gt(0)) return value.gt(1) ? ceiling() : DC.D0;
    return value.gt(1) ? DC.D0 : ceiling();
  }
  const baseLog = value.log10();
  const absLog = baseLog.lt(0) ? DC.D0.sub(baseLog) : baseLog;
  const absPower = power.lt(0) ? DC.D0.sub(power) : power;
  // Compare before multiplying the logarithm by the exponent: that product
  // can itself exceed the finite Decimal representation.
  if (absPower.gte(ceiling().log10().div(absLog))) {
    return baseLog.lt(0) === power.lt(0) ? ceiling() : DC.D0;
  }
  return Decimal.min(value.pow(power), ceiling());
}

export function boundedPositiveProduct(left, right) {
  const a = Decimal.clamp(checkedOperand(left, "product left"), 0, ceiling());
  const b = Decimal.clamp(checkedOperand(right, "product right"), 0, ceiling());
  // In particular, zero TP multiplied by an enormous gain multiplier stays zero.
  if (a.eq(0) || b.eq(0)) return DC.D0;
  if (a.gt(1) && b.gt(1) &&
      a.log10().gte(ceiling().log10().sub(b.log10()))) return ceiling();
  return Decimal.min(a.times(b), ceiling());
}

export function boundedPositiveSum(left, right) {
  const a = Decimal.clamp(checkedOperand(left, "sum left"), 0, ceiling());
  const b = Decimal.clamp(checkedOperand(right, "sum right"), 0, ceiling());
  if (a.eq(0)) return b;
  if (b.eq(0)) return a;
  // Protect the final currency assignment too; BEMAX + a positive gain can
  // overflow even when every individual gain was representable.
  if (b.gte(ceiling().sub(a))) return ceiling();
  return Decimal.min(a.add(b), ceiling());
}
