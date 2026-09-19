<script>
import { createEntryInfo } from "./breakdown-entry-info";
import {
  availableMultiplierTabGroups,
  resolveMultiplierTab,
} from "./multiplier-tab-navigation";
import MultiplierBreakdownEntry from "./MultiplierBreakdownEntry";
import AntimatterProductionBreakdown from "./AntimatterProductionBreakdown";
import { antimatterProductionSnapshot } from "@/core/secret-formula/multiplier-tab/antimatter-production-audit";

export default {
  name: "MultiplierBreakdownTab",
  components: {
    MultiplierBreakdownEntry,
    AntimatterProductionBreakdown
  },
  data() {
    return {
      availableGroups: [],
      availableGroupsSignature: "",
      currentID: player.options.multiplierTab.currTab,
      amSnapshot: null,
      // Inline Overall/tier analysis view for dimension resources; UI state only and never a
      // new saved tab ID (player.options.multiplierTab.currTab keeps the dimension's own ID).
      dimensionTier: 0,
      // Navigation memory is local UI state, not a new save field. Existing numeric IDs are preserved.
      lastSelectedTabs: {},
    };
  },
  computed: {
    currentGroup() {
      return this.availableGroups.find(group => group.options.some(option => option.id === this.currentID)) ?? null;
    },
    currentGroupKey() {
      return this.currentGroup?.key ?? null;
    },
    currentOption() {
      return this.currentGroup?.options.find(option => option.id === this.currentID) ?? null;
    },
    availableOptions() {
      return this.currentGroup?.options ?? [];
    },
    currentKey() {
      return this.currentOption?.key ?? null;
    },
    resource() {
      if (!this.currentKey) return null;
      const tierSuffix = this.isDimensionBreakdown && this.dimensionTier > 0 ? `_${this.dimensionTier}` : "";
      return createEntryInfo(`${this.currentKey}_total${tierSuffix}`);
    },
    isDimensionBreakdown() {
      return (this.currentOption?.dimensionTiers ?? 0) > 0;
    },
    // Inline analysis-header switch: Overall plus every currently unlocked tier, in order.
    // Locked tiers are excluded; an out-of-range tier falls back to Overall in update().
    dimensionOptions() {
      if (!this.isDimensionBreakdown) return [];
      const options = [{ tier: 0, text: "Overall" }];
      const maxTier = this.currentOption.dimensionTiers;
      for (let tier = 1; tier <= maxTier; tier++) {
        if (this.checkActiveKey(this.currentKey, tier)) {
          options.push({ tier, text: `${this.currentKey} ${tier}` });
        }
      }
      return options;
    },
    dimensionPrevDisabled() {
      return !this.isDimensionBreakdown ||
        !this.dimensionOptions.some(option => option.tier > 0 && option.tier < this.dimensionTier);
    },
    dimensionNextDisabled() {
      return !this.isDimensionBreakdown ||
        !this.dimensionOptions.some(option => option.tier > this.dimensionTier);
    },
    resourceSymbols() {
      return GameDatabase.multiplierTabValues[this.currentKey]?.total?.overlay ?? [];
    },
    analysisModeLabel() {
      if (this.currentKey === "AM") return "Production sources and gameplay limits";
      if (!this.resource?.isOrdered) return "Multiplier breakdown";
      if (this.isDimensionBreakdown && this.dimensionTier === 0) return "Combined source impacts";
      return "Ordered formula";
    }
  },
  created() {
    // Resolve invalid or newly locked save selections before the first render.
    this.update();
  },
  methods: {
    update() {
      // Use the source formula's own unlock predicate rather than hardcoding progression milestones.
      const groups = availableMultiplierTabGroups(key => this.checkActiveKey(key));
      const signature = groups.map(group => `${group.key}:${group.options.map(option => option.id).join(",")}`).join("|");
      if (signature !== this.availableGroupsSignature) {
        this.availableGroups = groups;
        this.availableGroupsSignature = signature;
      }

      const selected = resolveMultiplierTab(this.availableGroups, this.currentID);
      if (selected && selected.id !== this.currentID) {
        this.selectTab(selected);
      } else if (selected) {
        if (player.options.multiplierTab.currTab !== selected.id) {
          player.options.multiplierTab.currTab = selected.id;
        }
        if (this.lastSelectedTabs[this.currentGroupKey] !== selected.id) {
          this.$set(this.lastSelectedTabs, this.currentGroupKey, selected.id);
        }
      }
      // A tier that became locked (or a resource that lost its tiers) falls back to Overall.
      if (!this.isDimensionBreakdown ||
        (this.dimensionTier !== 0 &&
          !this.dimensionOptions.some(option => option.tier === this.dimensionTier))) {
        this.dimensionTier = 0;
      }
      if (this.currentKey === "AM") this.updateAntimatterSnapshot();
    },
    checkActiveKey(key, tier) {
      const total = GameDatabase.multiplierTabValues[key]?.total;
      if (!total) return false;
      const active = total.isActive;
      return Boolean(typeof active === "function" ? active(tier) : active);
    },
    selectTab(option) {
      if (!option) return;
      this.currentID = option.id;
      player.options.multiplierTab.currTab = option.id;
      this.dimensionTier = 0;
      const group = this.availableGroups.find(g => g.options.some(o => o.id === option.id));
      if (group && this.lastSelectedTabs[group.key] !== option.id) {
        this.$set(this.lastSelectedTabs, group.key, option.id);
      }
      if (option.key === "AM") this.updateAntimatterSnapshot(true);
    },
    selectDimension(tier) {
      if (!this.isDimensionBreakdown) return;
      if (tier !== 0 && !this.dimensionOptions.some(option => option.tier === tier)) return;
      this.dimensionTier = tier;
    },
    stepDimension(delta) {
      if (!this.isDimensionBreakdown) return;
      const tiers = this.dimensionOptions.map(option => option.tier).filter(tier => tier > 0);
      const target = delta < 0
        ? tiers.filter(tier => tier < this.dimensionTier).pop()
        : tiers.find(tier => tier > this.dimensionTier);
      if (target === undefined) return;
      this.dimensionTier = target;
    },
    clickCategory(group) {
      const remembered = this.lastSelectedTabs[group.key];
      this.selectTab(group.options.find(option => option.id === remembered) ?? group.options[0]);
    },
    categoryClassObject(group) {
      return {
        "c-multiplier-nav-btn": true,
        "c-multiplier-nav-btn--active": group.key === this.currentGroupKey,
      };
    },
    subtabClassObject(option) {
      return {
        "c-multiplier-nav-btn": true,
        "c-multiplier-nav-btn--active": option.key === this.currentKey,
      };
    },
    updateAntimatterSnapshot(force = false) {
      const now = Date.now();
      if (!force && this.amSnapshot && now - this.amSnapshot.at < 150) return;
      this.amSnapshot = { ...antimatterProductionSnapshot(), at: Date.now() };
    },
  }
};
</script>

<template>
  <div class="c-stats-tab">
    <div
      v-if="availableGroups.length"
      class="l-multiplier-category-btn-container"
      role="group"
      aria-label="Multiplier categories"
    >
      <button
        v-for="group in availableGroups"
        :key="group.key"
        type="button"
        :class="categoryClassObject(group)"
        :aria-pressed="group.key === currentGroupKey"
        @click="clickCategory(group)"
      >
        {{ group.text }}
      </button>
    </div>
    <div
      v-if="availableOptions.length > 1"
      class="l-multiplier-subtab-btn-container"
      role="group"
      aria-label="Multiplier resources"
    >
      <button
        v-for="option in availableOptions"
        :key="option.key"
        type="button"
        :class="subtabClassObject(option)"
        :aria-pressed="option.key === currentKey"
        @click="selectTab(option)"
      >
        {{ option.text }}
      </button>
    </div>
    <div
      v-if="resource"
      class="c-list-container"
    >
      <div class="c-multiplier-context">
        <h3 class="c-multiplier-resource-title">
          {{ currentOption.text }}
        </h3>
        <span class="c-multiplier-analysis-kind">{{ analysisModeLabel }}</span>
        <div
          v-if="isDimensionBreakdown"
          class="l-dimension-inline-switch"
        >
          <button
            type="button"
            class="c-dimension-step-btn"
            :disabled="dimensionPrevDisabled"
            aria-label="Previous dimension analysis view"
            @click="stepDimension(-1)"
          >
            <i class="fas fa-chevron-left" />
          </button>
          <select
            class="c-dimension-inline-select"
            aria-label="Choose overall or dimension analysis view"
            :value="dimensionTier"
            @change="selectDimension(Number($event.target.value))"
          >
            <option
              v-for="opt in dimensionOptions"
              :key="opt.tier"
              :value="opt.tier"
            >
              {{ opt.text }}
            </option>
          </select>
          <button
            type="button"
            class="c-dimension-step-btn"
            :disabled="dimensionNextDisabled"
            aria-label="Next dimension analysis view"
            @click="stepDimension(1)"
          >
            <i class="fas fa-chevron-right" />
          </button>
        </div>
      </div>
      <p
        v-if="currentKey === 'AD'"
        class="c-multiplier-coverage-warning"
      >
        AD analyzes individual dimension multipliers, not production. The inline switch in the analysis header
        moves between the combined view and AD1–AD8 without opening another tab; the grouping button inside the
        panel additionally switches between source and dimension grouping. Expand a dimension to inspect its
        ordered formula.
        The combined multiplier is NOT Antimatter/sec. Source overview defaults to exact Direct-step impacts
        for speed, and the Impact toggle can opt into counterfactual Final impacts when needed.
      </p>
      <p v-if="currentKey === 'AM'" class="c-multiplier-coverage-warning">
        Antimatter production attribution remains approximate.
        Base AD1 Production and one Tickspeed rate are expandable as in the original analysis.
        Production powers and caps use checkpoints from the actual gameplay getter;
        loss is measured at the cap itself, not estimated from the product of eight dimension multipliers.
      </p>
      <span
        v-for="symbol in resourceSymbols"
        :key="symbol"
      >
        <span
          class="c-symbol-overlay"
          v-html="symbol"
        />
      </span>
      <AntimatterProductionBreakdown
        v-if="currentKey === 'AM' && amSnapshot"
        :snapshot="amSnapshot"
      />
      <MultiplierBreakdownEntry
        v-else-if="currentKey !== 'AM'"
        :key="resource.key"
        :resource="resource"
        :is-root="true"
      />
      <div class="c-multiplier-tab-text-line">
        Note: Entries are only expandable if they contain multiple sources which can be different values.
        For example, any effects which affect all Dimensions of any type equally will not expand into a
        list of eight identical numbers.
        <br>
        <b>
          Some entries may cause lag if expanded out fully. Resizing happens over 200 ms (instead of instantly)
          in order to reduce possible adverse effects due to photosensitivity. This may cause some visual weirdness
          after prestige events.
        </b>
      </div>
    </div>
  </div>
</template>

<style scoped>
.c-multiplier-coverage-warning {
  margin: 0.7rem 0;
  padding: 0.7rem;
  border: 0.1rem solid var(--color-text);
  border-radius: var(--var-border-radius, 0.4rem);
  line-height: 1.4;
  font-size: 1.05rem;
  text-align: left;
}

.c-list-container {
  position: relative;
  width: 100%;
  max-width: 100rem;
  min-width: 0;
}

.l-multiplier-category-btn-container,
.l-multiplier-subtab-btn-container {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(12rem, 100%), 1fr));
  gap: 0.5rem;
  width: 100%;
  max-width: 100rem;
  margin-bottom: 0.7rem;
}

.l-dimension-inline-switch {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.c-dimension-step-btn {
  width: 2.8rem;
  min-height: 2.8rem;
  padding: 0.2rem;
  font-family: Typewriter;
  font-size: 1.1rem;
  font-weight: bold;
  color: var(--color-text);
  background-color: var(--color-base);
  border: var(--var-border-width, 0.2rem) solid var(--color-text);
  border-radius: var(--var-border-radius, 0.4rem);
  cursor: pointer;
}

.c-dimension-step-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.c-dimension-inline-select {
  min-height: 2.8rem;
  padding: 0.2rem 0.5rem;
  font-family: Typewriter;
  font-size: 1.1rem;
  color: var(--color-text);
  background-color: var(--color-base);
  border: var(--var-border-width, 0.2rem) solid var(--color-text);
  border-radius: var(--var-border-radius, 0.4rem);
}

.c-multiplier-nav-btn {
  box-sizing: border-box;
  min-width: 0;
  min-height: 3.4rem;
  padding: 0.4rem 0.8rem;
  font-family: Typewriter;
  font-size: 1.1rem;
  font-weight: bold;
  color: var(--color-text);
  background-color: var(--color-base);
  border: var(--var-border-width, 0.2rem) solid var(--color-text);
  border-radius: var(--var-border-radius, 0.4rem);
}

.c-multiplier-nav-btn {
  cursor: pointer;
}

.c-multiplier-nav-btn--active {
  color: var(--color-base);
  background-color: var(--color-text);
  cursor: default;
}

.c-multiplier-nav-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.c-multiplier-nav-btn:focus-visible {
  outline: 0.2rem solid var(--color-accent);
  outline-offset: 0.2rem;
}

.c-multiplier-context {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem 1rem;
  padding: 0.3rem 0.2rem 0.7rem;
  color: var(--color-text);
}

.c-multiplier-resource-title {
  margin: 0;
  font-size: 1.4rem;
  font-weight: bold;
}

.c-multiplier-analysis-kind {
  font-size: 1.05rem;
  opacity: 0.75;
}

.c-multiplier-tab-text-line {
  padding: 0.8rem 0.2rem;
  color: var(--color-text);
  font-size: 1.15rem;
  line-height: 1.5;
  text-align: left;
}

.c-symbol-overlay {
  display: flex;
  width: 100%;
  height: 100%;
  top: -5%;
  position: absolute;
  justify-content: center;
  align-items: center;
  font-size: clamp(12rem, 35vw, 40rem);
  color: var(--color-text);
  text-shadow: 0 0 3rem;
  pointer-events: none;
  user-select: none;
  opacity: 0.2;
  z-index: 1;
}
</style>
