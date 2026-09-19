import { MultiplierTabIcons } from "./icons";
import { TickspeedBreakdown } from "./tickspeed-breakdown";

// See index.js for documentation
export const AM = {
  total: {
    name: "Antimatter Production",
    displayOverride: () => `${format(Currency.antimatter.productionPerSecond, 2, 2)}/sec`,
    multValue: () => new Decimal(Currency.antimatter.productionPerSecond).clampMin(1),
    isActive: true,
    overlay: ["<i class='fas fa-atom' />"],
  },
  tickRate: {
    name: "Tickspeed (one AD1 rate)",
    displayOverride: () => `${format(Tickspeed.perSecond, 2, 2)}/sec`,
    multValue: () => Tickspeed.perSecond,
    transformValue: () => ({ type: "formula", before: DC.D1, after: Tickspeed.perSecond,
      alwaysShow: true, display: "One Tickspeed rate; not rate raised to all producing AD tiers" }),
    isOrdered: true,
    isActive: () => AntimatterDimension(1).isProducing,
    icon: MultiplierTabIcons.TICKSPEED,
  },
  // Explicit accounting baseline for the production audit: displayed AM/sec is reconciled as
  // AD1 amount × AD1 multiplier × one tickspeed rate × game speed, and everything the gameplay
  // getter produces beyond that baseline is an explicitly labeled accounting remainder.
  ad1Amount: {
    name: "AD1 amount",
    displayOverride: () => `${format(AntimatterDimension(1).totalAmount, 2, 2)} AD1`,
    multValue: () => AntimatterDimension(1).totalAmount,
    isActive: () => AntimatterDimension(1).isProducing,
    icon: MultiplierTabIcons.DIMENSION("AD", 1),
  },
  gameSpeed: {
    name: "Game speed",
    displayOverride: () => formatX(getGameSpeedupForDisplay(), 2, 2),
    multValue: () => getGameSpeedupForDisplay(),
    isActive: () => getGameSpeedupForDisplay().gt(1),
    icon: MultiplierTabIcons.GAMESPEED,
  },
  unattributed: {
    name: "Unattributed production (accounting remainder)",
    displayOverride: () => {
      const remainder = AM.unattributed.multValue();
      return remainder.eq(1) ? "None (baseline reconciles exactly)" : `≈ ${formatX(remainder, 2, 2)}`;
    },
    multValue: () => {
      const amount = AntimatterDimension(1).totalAmount;
      const baseline = amount.eq(0)
        ? DC.D0
        : amount.times(AntimatterDimension(1).multiplier).times(Tickspeed.perSecond)
            .times(getGameSpeedupForDisplay());
      return baseline.gt(0) ? Currency.antimatter.productionPerSecond.div(baseline) : DC.D1;
    },
    isActive: true,
    icon: MultiplierTabIcons.ANTIMATTER,
  },
};

const tickLabels = {
  base: "Base Tickspeed from achievements",
  purchased: "Purchased Tickspeed upgrades",
  free: "Free Tickspeed upgrades",
  galaxies: "Galaxy strength",
  raPower: "Ra Tickspeed power",
  dilationPower: "Dilation Tickspeed power",
  effarig: "Effarig override",
  dilation: "Dilation",
  overcharge: "Overcharge",
  traceMismatch: "Untracked Tickspeed formula difference",
};
for (const [key, name] of Object.entries(tickLabels)) {
  AM[`tick${key[0].toUpperCase()}${key.slice(1)}`] = {
    name,
    transformValue: () => TickspeedBreakdown.perDimensionTransform(key),
    isActive: () => AntimatterDimension(1).isProducing,
    icon: MultiplierTabIcons.TICKSPEED,
  };
}
