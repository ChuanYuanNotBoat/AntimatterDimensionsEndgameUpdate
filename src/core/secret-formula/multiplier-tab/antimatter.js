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
