<script>
import { gameplayLimitSnapshot } from "@/core/secret-formula/multiplier-tab/gameplay-limit-audit";

export default {
  name: "GameplayLimitSummary",
  props: { resourceKey: { type: String, required: true } },
  data() {
    return { expanded: true, details: {}, snapshot: { groups: [], endpoint: "" } };
  },
  beforeCreate() {
    this._lastLimitScan = -Infinity;
  },
  methods: {
    update(force = false) {
      const now = Date.now();
      // Eight real production/multiplier getters can be costly in ADE.
      // Recalculate collapsed summaries more slowly than an open inspector.
      const interval = this.expanded ? 750 : 2000;
      if (!force && now - this._lastLimitScan < interval) return;
      this.snapshot = gameplayLimitSnapshot(this.resourceKey);
      this._lastLimitScan = Date.now();
    },
    toggle() {
      this.expanded = !this.expanded;
      if (this.expanded) this.update(true);
    },
    toggleDetail(key) {
      this.$set(this.details, key, !this.details[key]);
    },
    lossText(loss) {
      return loss === null ? "zero output" : `−${format(loss, 2, 2)} OoM`;
    },
  }
};
</script>

<template>
  <div class="c-gameplay-limits">
    <button type="button" class="c-gameplay-limits-title" :aria-expanded="expanded" @click="toggle">
      <i :class="expanded ? 'far fa-minus-square' : 'far fa-plus-square'" />
      Gameplay production / overflow limits
      <span v-if="snapshot.groups.length">{{ snapshot.groups.length }} active operation(s)</span>
      <span v-else>None currently reducing output</span>
    </button>
    <div v-if="expanded" class="c-gameplay-limits-body">
      <p>{{ snapshot.endpoint }}. Each reduction is measured immediately before and after the game's own
        cap operation. These losses are NOT independently additive resource production gains.</p>
      <div v-if="!snapshot.groups.length">No binding gameplay cap or compression was detected in currently
        producing tiers.</div>
      <div v-for="group in snapshot.groups" :key="group.key" class="c-gameplay-limit-row">
        <button type="button" class="c-gameplay-limit-row-title" :aria-expanded="!!details[group.key]"
          @click="toggleDetail(group.key)">
          <i :class="details[group.key] ? 'far fa-minus-square' : 'far fa-plus-square'" />
          <b>{{ group.label }}</b>
          <span>{{ group.tiers.length }} tier(s); {{ group.zero ? 'includes zero output' : lossText(group.combinedOoM) }}</span>
        </button>
        <div v-if="details[group.key]" class="c-gameplay-limit-tiers">
          <div v-if="group.threshold">Threshold: {{ format(group.threshold, 2, 2) }}</div>
          <div v-for="tier in group.tiers" :key="tier.tier" class="c-gameplay-limit-tier">
            <b>{{ resourceKey }}{{ tier.tier }}: {{ lossText(tier.loss) }}</b>
            <span>{{ format(tier.before, 2, 2) }} → {{ format(tier.after, 2, 2) }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.c-gameplay-limits { box-sizing: border-box; width: 100%; max-width: 100rem; margin-top: 0.6rem;
  padding: 0.4rem; border: 0.2rem solid var(--color-text); color: var(--color-text); background: var(--color-base); }
.c-gameplay-limits-title, .c-gameplay-limit-row-title { display: flex; flex-wrap: wrap; align-items: center;
  gap: 0.6rem; width: 100%; padding: 0.5rem; border: 0; color: inherit; background: transparent;
  text-align: left; font-family: Typewriter; font-size: 1.12rem; cursor: pointer; }
.c-gameplay-limits-title span, .c-gameplay-limit-row-title span { margin-left: auto; }
.c-gameplay-limits-title:hover, .c-gameplay-limit-row-title:hover { background: var(--color-disabled); }
.c-gameplay-limits-body { padding: 0.5rem; text-align: left; font-size: 1.1rem; line-height: 1.4; }
.c-gameplay-limits-body p { margin: 0 0 0.7rem; }
.c-gameplay-limit-row { margin: 0.35rem 0; border: 0.1rem dashed var(--color-text); }
.c-gameplay-limit-row-title b { flex: 1; }
.c-gameplay-limit-tiers { padding: 0.4rem 0.7rem; }
.c-gameplay-limit-tier { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 0.3rem 1rem;
  padding: 0.4rem 0; border-bottom: 0.1rem dashed var(--color-text); }
.c-gameplay-limit-tier span { overflow-wrap: anywhere; }
</style>
