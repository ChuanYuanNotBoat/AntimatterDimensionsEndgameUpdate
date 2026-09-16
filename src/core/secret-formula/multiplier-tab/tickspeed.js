import { MultiplierTabHelper } from "./helper-functions";
import { MultiplierTabIcons } from "./icons";
import { TickspeedBreakdown } from "./tickspeed-breakdown";

export const tickspeed = {
  total: {
    name: "Total Tickspeed",
    displayOverride: () => {
      const tickRate = Tickspeed.perSecond;
      const count = MultiplierTabHelper.activeDimCount("AD");
      return `${format(tickRate, 2, 2)}/sec on ${formatInt(count)} producing Dimensions → ${formatX(tickRate.pow(count), 2, 2)}`;
    },
    multValue: () => Tickspeed.perSecond.pow(MultiplierTabHelper.activeDimCount("AD")),
    isActive: () => Tickspeed.perSecond.gt(1) && effectiveBaseGalaxies().gt(0),
    isOrdered: true,
    overlay: ["<i class='fa-solid fa-clock' />"],
    icon: MultiplierTabIcons.TICKSPEED,
  },
  base: {
    name: "Base interval and achievements",
    transformValue: () => TickspeedBreakdown.transform("base"),
    isActive: true,
    icon: MultiplierTabIcons.ACHIEVEMENT,
  },
  purchased: {
    name: "Purchased / Continuum Tickspeed upgrades",
    transformValue: () => TickspeedBreakdown.transform("purchased"),
    isActive: true,
    icon: MultiplierTabIcons.PURCHASE("AD"),
  },
  free: {
    name: "Free Tickspeed upgrades from Time Shards",
    transformValue: () => TickspeedBreakdown.transform("free"),
    isActive: true,
    icon: MultiplierTabIcons.SPECIFIC_GLYPH("time"),
  },
  galaxies: {
    name: "Galaxies · effective Tickspeed impact",
    transformValue: () => TickspeedBreakdown.transform("galaxies"),
    isActive: true,
    isOrdered: true,
    icon: MultiplierTabIcons.GALAXY,
  },
  raPower: {
    name: "Ra - Tickspeed multiplier power",
    transformValue: () => TickspeedBreakdown.transform("raPower"),
    isActive: true,
    icon: MultiplierTabIcons.UPGRADE("reality"),
  },
  dilationPower: {
    name: "Dilation Upgrade - Tickspeed Power",
    transformValue: () => TickspeedBreakdown.transform("dilationPower"),
    isActive: true,
    icon: MultiplierTabIcons.UPGRADE("dilation"),
  },
  effarig: {
    name: "Effarig's Tickspeed override",
    transformValue: () => TickspeedBreakdown.transform("effarig"),
    isActive: true,
    icon: MultiplierTabIcons.GENERIC_GLYPH,
  },
  dilation: {
    name: "Dilation / Pelle strike on tick interval",
    transformValue: () => TickspeedBreakdown.transform("dilation"),
    isActive: true,
    icon: MultiplierTabIcons.UPGRADE("dilation"),
  },
  overcharge: {
    name: "Endgame Overcharge tick dilation",
    transformValue: () => TickspeedBreakdown.transform("overcharge"),
    isActive: true,
    icon: MultiplierTabIcons.TICKSPEED,
  },
  dimensionExponent: {
    name: "Producing dimension count",
    transformValue: () => TickspeedBreakdown.transform("dimensionExponent"),
    isActive: true,
    icon: MultiplierTabIcons.DIMENSION("AD"),
  },
  traceMismatch: {
    name: "Untracked Tickspeed formula difference",
    transformValue: () => TickspeedBreakdown.transform("traceMismatch"),
    isActive: true,
    icon: MultiplierTabIcons.TICKSPEED,
  },
};

// Retained for compatibility with any non-root tree references to the old purchase entries.
export const tickspeedUpgrades = {
  purchased: {
    name: "Purchased Tickspeed Upgrades",
    multValue: () => Decimal.pow10(Laitela.continuumActive ? Tickspeed.continuumValue : player.totalTickBought),
    isActive: true,
    icon: MultiplierTabIcons.PURCHASE("AD"),
  },
  free: {
    name: "Free Tickspeed Upgrades",
    multValue: () => Decimal.pow10(player.totalTickGained),
    isActive: () => Currency.timeShards.gt(0),
    icon: MultiplierTabIcons.SPECIFIC_GLYPH("time"),
  },
};
