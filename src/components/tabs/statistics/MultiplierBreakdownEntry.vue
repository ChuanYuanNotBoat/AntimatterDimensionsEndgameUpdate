<script>
import { BreakdownEntryInfo } from "./breakdown-entry-info";
import { getResourceEntryInfoGroups } from "./breakdown-entry-info-group";
import { PercentageRollingAverage } from "./percentage-rolling-average";
import PrimaryToggleButton from "@/components/PrimaryToggleButton";

// A few props are special-cased because they're base values which can be less than 1, but we don't want to
// show them as nerfs
const nerfBlacklist = ["IP_base", "EP_base", "TP_base"];

function padPercents(percents) {
  // Add some padding to percents to prevent text flicker
  // Max length is for "-100.0%"
  return percents.padStart(7, "\xa0");
}

export default {
  name: "MultiplierBreakdownEntry",
  components: {
    PrimaryToggleButton
  },
  props: {
    resource: {
      type: BreakdownEntryInfo,
      required: true,
    },
    isRoot: {
      type: Boolean,
      required: false,
      default: false,
    }
  },
  data() {
    return {
      selected: 0,
      percentList: [],
      averagedPercentList: [],
      orderedPathPercentList: [],
      showGroup: [],
      hadChildEntriesAt: [],
      mouseoverIndex: -1,
      lastNotEmptyAt: 0,
      dilationExponent: 1,
      isDilated: false,
      // This is used to temporarily remove the transition function from the bar styling when changing the way
      // multipliers are split up; the animation which results from not doing this looks very awkward
      lastLayoutChange: Date.now(),
      now: Date.now(),
      totalMultiplier: DC.D1,
      totalPositivePower: 1,
      replacePowers: player.options.multiplierTab.replacePowers,
      orderedFinalImpact: true,
      inNC12: false,
    };
  },
  computed: {
    groups() {
      return getResourceEntryInfoGroups(this.resource.key);
    },
    /**
     * @returns {BreakdownEntryInfo[]}
     */
    entries() {
      return this.groups[this.selected].entries;
    },
    rollingAverage() {
      return new PercentageRollingAverage();
    },
    containerClass() {
      return {
        "c-multiplier-entry-container": true,
        "c-multiplier-entry-root-container": this.isRoot,
      };
    },
    isEmpty() {
      return !this.isRecent(this.lastNotEmptyAt);
    },
    disabledText() {
      if (!this.resource.isBase) return `Total effect inactive, disabled, or reduced to ${formatX(1)}`;
      return Decimal.eq(this.resource.mult, 0)
        ? `You cannot gain this resource (prestige requirement not reached)`
        : `You have no multipliers for this resource (will gain ${format(1)} on prestige)`;
    },
    // IC4 is the first time the player sees a power-based effect, not counting how infinity power is handled.
    // This doesn't need to be reactive because completing IC4 for the first time forces a tab switch
    hasSeenPowers() {
      return InfinityChallenge(4).isCompleted || PlayerProgress.eternityUnlocked();
    },
    // While infinity power is a power-based effect, we want to disallow showing that as an equivalent multiplier
    // since that it doesn't make a whole lot of sense to do that. We also want to hide this for entries related
    // to tickspeed/galaxies because we already mostly hack those with fake values and should thus not allow those
    // to be changed either.
    allowPowerToggle() {
      if (this.resource.isOrdered) return false;
      const forbiddenEntries = ["AD_infinityPower", "galaxies", "tickspeed"];
      // Uses startsWith instead of String equality since it has to match both the top-level entry and any
      // related children entries further down the tree.
      return !forbiddenEntries.some(key => this.resource.key.startsWith(key));
    },
  },
  watch: {
    replacePowers(newValue) {
      player.options.multiplierTab.replacePowers = newValue;
    },
    orderedFinalImpact() {
      if (!this.resource.isOrdered) return;
      this.lastLayoutChange = Date.now();
      this.rollingAverage.clear();
      this.calculatePercents();
    },
  },
  created() {
    if (this.groups.length > 1 && player.options.multiplierTab.showAltGroup) {
      this.changeGroup();
    }
  },
  methods: {
    update() {
      for (let i = 0; i < this.entries.length; i++) {
        const entry = this.entries[i];
        entry.update();
        const hasChildEntries = getResourceEntryInfoGroups(entry.key)
          .some(group => group.hasVisibleEntries);
        if (hasChildEntries) {
          this.hadChildEntriesAt[i] = Date.now();
        }
      }
      this.dilationExponent = this.resource.dilationEffect;
      this.isDilated = this.dilationExponent !== 1;
      this.calculatePercents();
      this.now = Date.now();
      this.replacePowers = player.options.multiplierTab.replacePowers && this.allowPowerToggle;
      this.inNC12 = NormalChallenge(12).isRunning;
    },
    changeGroup() {
      this.selected = (this.selected + 1) % this.groups.length;
      player.options.multiplierTab.showAltGroup = this.selected === 1;
      this.showGroup = Array.repeat(false, this.entries.length);
      this.hadChildEntriesAt = Array.repeat(0, this.entries.length);
      this.lastLayoutChange = Date.now();
      this.rollingAverage.clear();
      this.update();
    },
    calculatePercents() {
      if (this.resource.isOrdered) {
        this.calculateOrderedImpacts();
        return;
      }

      const powList = this.entries.map(e => new Decimal(e.data.pow));
      const totalPosPow = powList.filter(p => p.gt(1)).reduce((x, y) => x.times(y), DC.D1);
      const totalNegPow = powList.filter(p => p.lt(1)).reduce((x, y) => x.times(y), DC.D1);
      const log10Mult = (this.resource.fakeValue ?? this.resource.mult).log10().div(totalPosPow);
      const isEmpty = log10Mult.eq(0);
      if (!isEmpty) {
        this.lastNotEmptyAt = Date.now();
      }
      let percentList = [];
      for (const entry of this.entries) {
        const pow = new Decimal(entry.data.pow);
        const multFrac = isEmpty ? DC.D0 : Decimal.log10(entry.data.mult).div(log10Mult);
        const powFrac = totalPosPow.eq(1) ? DC.D0 : pow.log10().div(totalPosPow.log10());

        // Handle nerf powers differently from everything else in order to render them with the correct bar percentage
        const perc = pow.gte(1)
          ? multFrac.div(totalPosPow).add(powFrac.times(DC.D1.sub(DC.D1.div(totalPosPow))))
          : pow.log10().div(totalNegPow.log10()).times(totalNegPow.sub(1));

        // Keep these as Decimals until after normalization; individual contributions can be far outside Number range
        // in Endgame even though the final percentages are always small finite values.
        percentList.push([
          entry.ignoresNerfPowers,
          nerfBlacklist.includes(entry.key) ? Decimal.max(perc, 0.0001) : perc
        ]);
      }

      // Shortly after a prestige, these may add up to a lot more than the base amount as production catches up. This
      // is also necessary to suppress some visual weirdness for certain categories which have lots of exponents but
      // actually apply only to specific dimensions (eg. charged infinity upgrades)
      // We have a nerfedPerc variable to give a percentage breakdown as if all multipliers which ARE affected by nerf
      // power effects already had them applied; there is support in the classes to allow for some to be affected but
      // not others. The only actual case of this occurring is V's Reality not affecting gamespeed for DT, but it was
      // cleaner to adjust the class structure instead of specifically special-casing it here
      const positivePercs = percentList.filter(p => p[1].gt(0));
      const totalPerc = positivePercs.reduce((x, y) => x.add(y[1]), DC.D0);
      const nerfedPerc = positivePercs
        .reduce((x, y) => x.add(y[0] ? y[1] : y[1].times(totalNegPow)), DC.D0);
      percentList = percentList.map(p => {
        if (p[1].gt(0)) {
          if (nerfedPerc.eq(0)) return 0;
          return (p[0] ? p[1] : p[1].times(totalNegPow)).div(nerfedPerc).toNumber();
        }
        if (totalPerc.eq(0) || totalNegPow.eq(0)) return Decimal.max(p[1], -1).toNumber();
        return Decimal.max(
          p[1].times(totalPerc.sub(nerfedPerc)).div(totalPerc).div(totalNegPow),
          -1
        ).toNumber();
      });
      this.percentList = percentList;
      this.rollingAverage.add(isEmpty ? undefined : percentList);
      this.averagedPercentList = this.rollingAverage.average;
      this.totalMultiplier = Decimal.pow10(log10Mult);
      this.totalPositivePower = totalPosPow;
    },
    calculateOrderedImpacts() {
      const impacts = this.entries.map((entry, index) => this.orderedImpactDelta(index, this.orderedFinalImpact));
      const directImpacts = this.entries.map((entry, index) => this.orderedImpactDelta(index, false));
      const maxImpact = impacts
        .map(delta => delta.abs())
        .reduce((max, delta) => Decimal.max(max, delta), DC.D0);
      const directPathTotal = directImpacts
        .map(delta => delta.abs())
        .reduce((sum, delta) => sum.add(delta), DC.D0);
      const hasVisibleTransforms = this.entries.some(entry => entry.data.hasTransform && entry.data.isVisible);
      if (hasVisibleTransforms) this.lastNotEmptyAt = Date.now();

      const relativeImpacts = impacts.map(delta => {
        if (delta.eq(0) || maxImpact.eq(0)) return 0;
        return delta.div(maxImpact).toNumber();
      });
      this.orderedPathPercentList = directImpacts.map(delta => {
        if (delta.eq(0) || directPathTotal.eq(0)) return 0;
        return delta.abs().div(directPathTotal).toNumber();
      });

      this.percentList = relativeImpacts;
      this.rollingAverage.add(hasVisibleTransforms ? relativeImpacts : undefined);
      this.averagedPercentList = this.rollingAverage.average;
      this.totalMultiplier = this.resource.mult;
      this.totalPositivePower = DC.D1;
    },
    orderedImpactDelta(index, finalMode = this.orderedFinalImpact) {
      const data = this.entries[index].data;
      if (!data.hasTransform || !data.isVisible) return DC.D0;
      if (finalMode && data.transformHasFinalWithout) {
        return this.log10ForImpact(data.transformFinalWith).sub(this.log10ForImpact(data.transformFinalWithout));
      }
      return this.log10ForImpact(data.transformAfter).sub(this.log10ForImpact(data.transformBefore));
    },
    log10ForImpact(value) {
      return Decimal.max(value, DC.D1).log10();
    },
    orderedImpactStyle(index) {
      const impact = this.averagedPercentList[index] ?? 0;
      const iconObj = this.entries[index].icon;
      return {
        width: `${100 * Math.min(Math.abs(impact), 1)}%`,
        left: impact < 0 ? undefined : 0,
        right: impact < 0 ? 0 : undefined,
        background: impact < 0
          ? `repeating-linear-gradient(-45deg, var(--color-bad), ${iconObj?.color ?? "var(--color-bad)"} 0.8rem)`
          : iconObj?.color ?? "var(--color-accent)",
        opacity: impact === 0 ? 0 : 0.35,
      };
    },
    orderedPathStyle(index) {
      const share = this.orderedPathPercentList[index] ?? 0;
      const directImpact = this.orderedImpactDelta(index, false);
      const isNerf = directImpact.lt(0);
      const iconObj = this.entries[index].icon ?? this.resource.icon;
      return {
        position: "absolute",
        top: `${100 * this.orderedPathPercentList.slice(0, index).sum()}%`,
        height: `${100 * share}%`,
        width: "100%",
        "transition-duration": this.isRecent(this.lastLayoutChange) ? undefined : "0.2s",
        border: share === 0 ? "" : "0.1rem solid var(--color-text)",
        color: iconObj?.textColor ?? "black",
        background: isNerf
          ? `repeating-linear-gradient(-45deg, var(--color-bad), ${iconObj?.color ?? "var(--color-bad)"} 0.8rem)`
          : iconObj?.color ?? this.resource.icon?.color ?? "var(--color-accent)",
      };
    },
    styleObject(index) {
      const netPerc = this.averagedPercentList.sum();
      const isNerf = this.averagedPercentList[index] < 0;
      const iconObj = this.entries[index].icon;
      const percents = this.averagedPercentList[index];
      const barSize = perc => (perc > 0 ? perc * netPerc : -perc);
      return {
        position: "absolute",
        top: `${100 * this.averagedPercentList.slice(0, index).map(p => barSize(p)).sum()}%`,
        height: `${100 * barSize(percents)}%`,
        width: "100%",
        "transition-duration": this.isRecent(this.lastLayoutChange) ? undefined : "0.2s",
        border: percents === 0 ? "" : "0.1rem solid var(--color-text)",
        color: iconObj?.textColor ?? "black",
        background: isNerf
          ? `repeating-linear-gradient(-45deg, var(--color-bad), ${iconObj?.color} 0.8rem)`
          : iconObj?.color,
      };
    },
    singleEntryClass(index) {
      return {
        "c-single-entry": true,
        "c-single-entry-highlight": this.mouseoverIndex === index,
      };
    },
    shouldShowEntry(entry) {
      return entry.data.isVisible || this.isRecent(entry.data.lastVisibleAt);
    },
    barSymbol(index) {
      return this.entries[index].icon?.symbol ?? null;
    },
    hasChildEntries(index) {
      return this.isRecent(this.hadChildEntriesAt[index]);
    },
    expandIcon(index) {
      return this.showGroup[index] ? "far fa-minus-square" : "far fa-plus-square";
    },
    expandIconStyle(index) {
      return {
        opacity: this.hasChildEntries(index) || (this.resource.isOrdered && this.entries[index].data.hasTransform) ? 1 : 0
      };
    },
    entryString(index) {
      if (this.resource.isOrdered) return this.orderedEntryString(index);
      const percents = this.percentList[index];
      if (percents < 0 && !nerfBlacklist.includes(this.entries[index].key)) {
        return this.nerfString(index);
      }

      // We want to handle very small numbers carefully to distinguish between "disabled/inactive" and
      // "too small to be relevant"
      let percString;
      if (percents === 0) percString = formatPercents(0);
      else if (percents === 1) percString = formatPercents(1);
      else if (percents < 0.001) percString = `<${formatPercents(0.001, 1)}`;
      else if (percents > 0.9995) percString = `~${formatPercents(1)}`;
      else percString = formatPercents(percents, 1);
      percString = padPercents(percString);

      // Display both multiplier and powers, but make sure to give an empty string if there's neither
      const entry = this.entries[index];
      if (!entry.data.isVisible) {
        return `${percString}: ${entry.name}`;
      }
      const overrideStr = entry.displayOverride;
      let valueStr;
      if (overrideStr) valueStr = `(${overrideStr})`;
      else {
        const values = [];
        const formatFn = x => {
          const isDilated = entry.isDilated;
          if (isDilated && this.dilationExponent !== 1) {
            const undilated = this.applyDilationExp(x, 1 / this.dilationExponent);
            return `${formatX(undilated, 2, 2)} ➜ ${formatX(x, 2, 2)}`;
          }
          return entry.isBase
            ? format(x, 2, 2)
            : formatX(x, 2, 2);
        };
        if (this.replacePowers && Decimal.neq(entry.data.pow, 1)) {
          // For replacing powers with equivalent multipliers, we calculate what the total additional multiplier
          // from ALL power effects taken together would be, and then we split up that additional multiplier
          // proportionally to this individual power's contribution to all positive powers
          const pow = new Decimal(entry.data.pow);
          const totalPositivePower = new Decimal(this.totalPositivePower);
          const powFrac = totalPositivePower.eq(1) ? DC.D0 : pow.log10().div(totalPositivePower.log10());
          const equivMult = this.totalMultiplier.pow(totalPositivePower.sub(1).times(powFrac));
          values.push(formatFn(entry.data.mult.times(equivMult)));
        } else {
          if (Decimal.neq(entry.data.mult, 1)) values.push(formatFn(entry.data.mult));
          if (Decimal.neq(entry.data.pow, 1)) values.push(formatPow(entry.data.pow, 2, 3));
        }
        valueStr = values.length === 0 ? "" : `(${values.join(", ")})`;
      }

      return `${percString}: ${entry.name} ${valueStr}`;
    },
    orderedEntryString(index) {
      const entry = this.entries[index];
      const impact = this.percentList[index] ?? 0;
      let impactString;
      if (impact === 0) impactString = formatPercents(0);
      else if (Math.abs(impact) < 0.001) {
        impactString = `${impact < 0 ? ">-" : "<"}${formatPercents(0.001, 1)}`;
      } else {
        impactString = formatPercents(impact, 1);
      }
      const mode = this.orderedFinalImpact ? "final" : "direct";
      return `${padPercents(impactString)} rel. (${mode}): ${entry.name} ${this.transformValueString(entry)}`;
    },
    transformValueString(entry) {
      const data = entry.data;
      if (data.transformDisplay) return `(${data.transformDisplay})`;

      switch (data.transformType) {
        case "multiply":
          return data.transformHasValue ? `(${formatX(data.transformValue, 2, 2)})` : "";
        case "power":
          return data.transformHasValue ? `(${formatPow(data.transformValue, 2, 3)})` : "";
        case "formula":
          return `(${format(data.transformAfter, 2, 2)})`;
        case "softcap":
        case "hardcap":
        case "override":
        case "floor":
        default:
          return `(${format(data.transformBefore, 2, 2)} ➜ ${format(data.transformAfter, 2, 2)})`;
      }
    },
    transformTypeString(entry) {
      const labels = {
        multiply: "Multiplier",
        power: "Power",
        formula: "Formula",
        softcap: "Softcap",
        hardcap: "Hardcap",
        override: "Override",
        floor: "Rounding",
      };
      return labels[entry.data.transformType] ?? "Transformation";
    },
    transformImpactString(entry, finalImpact) {
      const data = entry.data;
      let delta;
      if (finalImpact && data.transformHasFinalWithout) {
        delta = this.log10ForImpact(data.transformFinalWith).sub(this.log10ForImpact(data.transformFinalWithout));
      } else {
        delta = this.log10ForImpact(data.transformAfter).sub(this.log10ForImpact(data.transformBefore));
      }
      if (delta.eq(0)) return `${format(0, 2, 2)} OoM`;
      const sign = delta.gt(0) ? "+" : "";
      return `${sign}${format(delta, 2, 2)} OoM`;
    },
    nerfString(index) {
      const entry = this.entries[index];
      const percString = padPercents(formatPercents(this.percentList[index], 1));

      // Display both multiplier and powers, but make sure to give an empty string if there's neither
      const overrideStr = entry.displayOverride;
      let valueStr;
      const formatFn = entry.isBase
        ? x => format(x, 2, 2)
        : x => `/${format(x.reciprocal(), 2, 2)}`;

      if (overrideStr) valueStr = `(${overrideStr})`;
      else {
        const values = [];
        if (this.replacePowers && entry.data.pow !== 1) {
          const finalMult = this.resource.fakeValue ?? this.resource.mult;
          values.push(formatFn(finalMult.pow(1 - 1 / entry.data.pow)));
        } else {
          if (Decimal.neq(entry.data.mult, 1)) {
            values.push(formatFn(entry.data.mult));
          }
          if (entry.data.pow !== 1) values.push(formatPow(entry.data.pow, 2, 3));
        }
        valueStr = values.length === 0 ? "" : `(${values.join(", ")})`;
      }

      return `${percString}: ${entry.name} ${valueStr}`;
    },
    totalString() {
      const resource = this.resource;
      const name = resource.name;
      const overrideStr = resource.displayOverride;
      if (overrideStr) return `${name}: ${overrideStr}`;

      const val = resource.mult;
      return resource.isBase
        ? `${name}: ${format(val, 2, 2)}`
        : `${name}: ${formatX(val, 2, 2)}`;
    },
    applyDilationExp(value, exp) {
      return Decimal.pow10(value.log10().pow(exp));
    },
    dilationString() {
      const resource = this.resource;
      const baseMult = resource.mult;

      // This is tricky to handle properly; if we're not careful, sometimes the dilation gets applied twice since
      // it's already applied in the multiplier itself. In that case we need to apply an appropriate "anti-dilation"
      // to make the UI look correct. However, this cause some mismatches in individual dimension breakdowns due to
      // the dilation function not being linear (ie. multiply=>dilate gives a different result than dilate=>multiply).
      // In that case we check for isDilated one level down and combine the actual multipliers together instead.
      let beforeMult, afterMult;
      if (this.isDilated && resource.isDilated) {
        const dilProd = this.entries
          .filter(entry => entry.isVisible && entry.isDilated)
          .map(entry => entry.mult)
          .map(val => this.applyDilationExp(val, 1 / this.dilationExponent))
          .reduce((x, y) => x.times(y), DC.D1);
        beforeMult = dilProd.neq(1) ? dilProd : this.applyDilationExp(baseMult, 1 / this.dilationExponent);
        afterMult = resource.mult;
      } else {
        beforeMult = baseMult;
        afterMult = this.applyDilationExp(beforeMult, this.dilationExponent);
      }

      const formatFn = resource.isBase
        ? x => format(x, 2, 2)
        : x => formatX(x, 2, 2);
      return `Dilation Effect: Exponent${formatPow(this.dilationExponent, 2, 3)}
        (${formatFn(beforeMult, 2, 2)} ➜ ${formatFn(afterMult, 2, 2)})`;
    },
    isRecent(date) {
      return (this.now - date) < 200;
    }
  },
};
</script>

<template>
  <div :class="containerClass">
    <div
      v-if="resource.isOrdered && !isEmpty"
      class="c-stacked-bars c-ordered-path-bars"
    >
      <div
        v-for="(perc, index) in orderedPathPercentList"
        :key="50 + index"
        :style="orderedPathStyle(index)"
        :class="{ 'c-bar-highlight' : mouseoverIndex === index }"
        @mouseover="mouseoverIndex = index"
        @mouseleave="mouseoverIndex = -1"
        @click="showGroup[index] = !showGroup[index]"
      >
        <span
          class="c-bar-overlay"
          v-html="barSymbol(index)"
        />
      </div>
    </div>
    <div
      v-else-if="!isEmpty"
      class="c-stacked-bars"
    >
      <div
        v-for="(perc, index) in averagedPercentList"
        :key="100 + index"
        :style="styleObject(index)"
        :class="{ 'c-bar-highlight' : mouseoverIndex === index }"
        @mouseover="mouseoverIndex = index"
        @mouseleave="mouseoverIndex = -1"
        @click="showGroup[index] = !showGroup[index]"
      >
        <span
          class="c-bar-overlay"
          v-html="barSymbol(index)"
        />
      </div>
    </div>
    <div />
    <div class="c-info-list">
      <div class="c-total-mult">
        <b>
          {{ totalString() }}
        </b>
        <span
          class="c-display-settings"
          :class="{ 'c-ordered-display-settings': resource.isOrdered }"
        >
          <span
            v-if="resource.isOrdered"
            class="c-impact-display-label"
          >
            Impact
          </span>
          <PrimaryToggleButton
            v-if="resource.isOrdered"
            v-model="orderedFinalImpact"
            v-tooltip="'Final includes amplification or reduction from later formula steps; Direct only measures this step itself'"
            off="Direct"
            on="Final"
            class="o-primary-btn c-impact-display-btn"
          />
          <PrimaryToggleButton
            v-else-if="hasSeenPowers && allowPowerToggle"
            v-model="replacePowers"
            v-tooltip="'Change Display for Power effects'"
            off="^N"
            on="×N"
            class="o-primary-btn c-change-display-btn"
          />
          <i
            v-if="groups.length > 1"
            v-tooltip="'Change Multiplier Grouping'"
            class="o-primary-btn c-change-display-btn fas fa-arrows-rotate"
            @click="changeGroup"
          />
        </span>
      </div>
      <div
        v-if="isEmpty"
        class="c-no-effect"
      >
        No Active Effects
        <br>
        <br>
        {{ disabledText }}
      </div>
      <div
        v-for="(entry, index) in entries"
        v-else
        :key="entry.key"
        @mouseover="mouseoverIndex = index"
        @mouseleave="mouseoverIndex = -1"
      >
        <div
          v-if="shouldShowEntry(entry)"
          :class="singleEntryClass(index)"
        >
          <div
            class="c-entry-click-target"
            @click="showGroup[index] = !showGroup[index]"
          >
            <span
              v-if="resource.isOrdered"
              class="c-ordered-impact-bar"
              :style="orderedImpactStyle(index)"
            />
            <span class="c-entry-text">
              <span
                :class="expandIcon(index)"
                :style="expandIconStyle(index)"
              />
              {{ entryString(index) }}
            </span>
          </div>
          <div
            v-if="resource.isOrdered && showGroup[index] && entry.data.hasTransform"
            class="c-ordered-transform-details"
          >
            <div class="c-transform-detail-grid">
              <span>Effect type</span>
              <b>{{ transformTypeString(entry) }}</b>
              <span>Direct effect</span>
              <b>{{ transformValueString(entry) || '—' }}</b>
              <span>Before this step</span>
              <b>{{ format(entry.data.transformBefore, 2, 2) }}</b>
              <span>After this step</span>
              <b>{{ format(entry.data.transformAfter, 2, 2) }}</b>
              <span>Direct impact</span>
              <b>{{ transformImpactString(entry, false) }}</b>
              <template v-if="entry.data.transformHasFinalWithout">
                <span>Final with effect</span>
                <b>{{ format(entry.data.transformFinalWith, 2, 2) }}</b>
                <span>Final without effect</span>
                <b>{{ format(entry.data.transformFinalWithout, 2, 2) }}</b>
                <span>Final impact</span>
                <b>{{ transformImpactString(entry, true) }}</b>
              </template>
            </div>
          </div>
          <MultiplierBreakdownEntry
            v-if="showGroup[index] && hasChildEntries(index)"
            :resource="entry"
          />
        </div>
      </div>
      <div v-if="isDilated && !isEmpty">
        <div class="c-single-entry c-dilation-entry">
          <div>
            {{ dilationString() }}
          </div>
        </div>
      </div>
      <div
        v-if="resource.isOrdered && !isEmpty"
        class="c-no-effect c-ordered-note"
      >
        Left bar shows the direct ordered formula path, split by absolute OoM change at each step.
        Row bars show relative impact strength normalized to the largest absolute effect on this page; they are not
        contribution shares and do not add up to {{ formatPercents(1) }}.
        Final Impact includes all later formula steps; Direct Impact only measures the selected step itself.
      </div>
      <div
        v-if="resource.key === 'AD_total'"
        class="c-no-effect"
      >
        <div>
          "Base AD Production" is the amount of Antimatter that you would be producing with your current AD upgrades
          as if you had waited a fixed amount of time ({{ formatInt(10) }}-{{ formatInt(40) }} seconds depending on
          your AD count) after a Sacrifice. This may misrepresent your actual production if your ADs have been
          producing for a while, but the relative mismatch will become smaller as you progress further in the game
          and numbers become larger.
        </div>
        <div v-if="inNC12">
          The breakdown in this tab within Normal Challenge 12 may be inaccurate for some entries, and might count
          extra multipliers which apply to all Antimatter Dimensions rather than just the ones which are displayed.
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.c-multiplier-entry-container {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  width: 100%;
  max-width: 100rem;
  border: var(--var-border-width, 0.2rem) solid var(--color-text);
  padding: 0.5rem;
  font-weight: normal;
  background-color: var(--color-base);

  -webkit-tap-highlight-color: transparent;
}

.c-multiplier-entry-root-container {
  min-height: 45rem;
}

.c-stacked-bars {
  position: relative;
  width: 5rem;
  background-color: var(--color-disabled);
  margin-right: 1.5rem;
}

.c-ordered-path-bars {
  min-width: 5rem;
}

.c-bar-overlay {
  display: flex;
  width: 100%;
  height: 100%;
  top: -5%;
  position: absolute;
  justify-content: center;
  align-items: center;
  font-size: 1.5rem;
  pointer-events: none;
  user-select: none;
  overflow: hidden;
  opacity: 0.8;
  z-index: 1;
}

.c-bar-highlight {
  animation: a-glow-bar 2s infinite;
}

@keyframes a-glow-bar {
  0% { box-shadow: inset 0 0 0.3rem 0; }
  50% {
    box-shadow: inset 0 0 0.6rem 0;
    filter: brightness(130%);
  }
  100% { box-shadow: inset 0 0 0.3rem 0; }
}

.c-info-list {
  height: 100%;
  width: 90%;
  padding: 0.2rem;
}

.c-display-settings {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  width: 8rem;
}

.c-ordered-display-settings {
  justify-content: flex-end;
  align-items: center;
  width: auto;
  min-width: 17rem;
}

.c-impact-display-label {
  margin-right: 0.6rem;
  color: var(--color-text);
  font-size: 1.1rem;
}

.c-impact-display-btn {
  min-width: 7rem;
  margin: 0 0.5rem;
}

.c-change-display-btn {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 3rem;
  margin: 0 0.5rem;
}

.c-total-mult {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  padding-left: 0.5rem;
  margin-bottom: 1rem;
  color: var(--color-text);
}

.c-no-effect {
  color: var(--color-text);
  user-select: none;
}

.c-single-entry {
  position: relative;
  text-align: left;
  color: var(--color-text);
  padding: 0.2rem 0.5rem;
  margin: 0.2rem;
  border: 0.1rem dashed;
  cursor: pointer;
  user-select: none;
  overflow: hidden;
}

.c-entry-click-target {
  position: relative;
  min-height: 1.8rem;
}

.c-entry-text {
  position: relative;
  z-index: 1;
}

.c-ordered-impact-bar {
  position: absolute;
  top: -0.2rem;
  bottom: -0.2rem;
  z-index: 0;
  pointer-events: none;
  transition: width 0.2s ease;
}

.c-ordered-transform-details {
  position: relative;
  z-index: 1;
  margin: 0.5rem 1.5rem 0.3rem;
  padding: 0.8rem 1rem;
  border: 0.1rem dashed var(--color-text);
  background-color: var(--color-base);
  cursor: default;
}

.c-transform-detail-grid {
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr);
  gap: 0.35rem 1.2rem;
  align-items: baseline;
}

.c-transform-detail-grid b {
  overflow-wrap: anywhere;
}

.c-ordered-note {
  margin: 0.8rem 0.5rem 0;
  font-size: 1.05rem;
}

.c-single-entry-highlight {
  border: 0.1rem solid;
  font-weight: bold;
  animation: a-glow-text 2s infinite;
}

@keyframes a-glow-text {
  50% { background-color: var(--color-accent); }
}

.c-dilation-entry {
  border: 0.2rem solid;
  font-weight: bold;
  animation: a-glow-dilation-nerf 3s infinite;
}

@keyframes a-glow-dilation-nerf {
  50% { background-color: var(--color-bad); }
}
</style>
