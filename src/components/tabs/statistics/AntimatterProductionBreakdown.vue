<script>
import { createEntryInfo } from "./breakdown-entry-info";
import MultiplierBreakdownEntry from "./MultiplierBreakdownEntry";
import { stageReductionOoM } from "@/core/secret-formula/multiplier-tab/antimatter-production-audit";

export default {
  name: "AntimatterProductionBreakdown",
  components: { MultiplierBreakdownEntry },
  props: {
    snapshot: { type: Object, required: true }
  },
  data() {
    return {
      openAD: false,
      openTickspeed: false,
      openModifiers: true,
      ad1Resource: createEntryInfo("AD_total_1"),
      tickResource: createEntryInfo("AM_tickRate"),
    };
  },
  computed: {
    modifiers() {
      return this.snapshot.activeStages.filter(step => step.key !== "challengeCap" && step.before.neq(step.after));
    },
    capStages() {
      return this.snapshot.activeStages.filter(step =>
        (step.type === "softcap" || step.type === "hardcap") && step.before.gt(step.after));
    },
  },
  methods: {
    reduction(step) {
      const oom = stageReductionOoM(step);
      return oom === null ? "Output reduced to zero" : `−${format(oom, 2, 2)} OoM`;
    },
  }
};
</script>

<template>
  <div class="c-am-breakdown">
    <div class="c-am-visual" aria-hidden="true">
      <div class="c-am-visual-ad">Ω</div>
      <div class="c-am-visual-tick"><i class="fas fa-tachometer-alt" /></div>
      <div class="c-am-visual-mod">⇢</div>
    </div>
    <div class="c-am-breakdown-content">
      <div class="c-am-header">
        <b>Antimatter Production: {{ format(snapshot.actual, 2, 2) }}/sec</b>
        <span>Gameplay endpoint</span>
      </div>
      <div class="c-am-section">
        <button type="button" class="c-am-section-title" :aria-expanded="openAD"
          @click="openAD = !openAD">
          <i :class="openAD ? 'far fa-minus-square' : 'far fa-plus-square'" />
          <b>Base AD1 Production</b>
          <span>{{ format(snapshot.amount.times(snapshot.multiplier), 2, 2) }} (amount × multiplier)</span>
        </button>
        <div v-if="openAD" class="c-am-inside">
          <div class="c-am-metric"><span>AD1 amount</span><b>{{ format(snapshot.amount, 2, 2) }}</b></div>
          <div class="c-am-metric"><span>AD1 multiplier (gameplay)</span><b>{{ formatX(snapshot.multiplier, 2, 2) }}</b></div>
          <MultiplierBreakdownEntry :resource="ad1Resource" :depth="1" />
        </div>
      </div>
      <div class="c-am-section">
        <button type="button" class="c-am-section-title" :aria-expanded="openTickspeed"
          @click="openTickspeed = !openTickspeed">
          <i :class="openTickspeed ? 'far fa-minus-square' : 'far fa-plus-square'" />
          <b>Total Tickspeed (one producer)</b>
          <span>{{ format(snapshot.tickRate, 2, 2) }}/sec</span>
        </button>
        <div v-if="openTickspeed" class="c-am-inside">
          AM production uses exactly one Tickspeed rate. The separate Tickspeed statistics page
          raises this rate to the number of producing dimensions; that product is not used here.
          <MultiplierBreakdownEntry :resource="tickResource" :depth="1" />
        </div>
      </div>
      <div class="c-am-section">
        <button type="button" class="c-am-section-title" :aria-expanded="openModifiers"
          @click="openModifiers = !openModifiers">
          <i :class="openModifiers ? 'far fa-minus-square' : 'far fa-plus-square'" />
          <b>Production powers &amp; limits</b>
          <span>{{ format(snapshot.perGameSecond, 2, 2) }}/game sec</span>
        </button>
        <div v-if="openModifiers" class="c-am-inside">
          <div class="c-am-metric"><span>Before AD production modifiers</span>
            <b>{{ format(snapshot.raw, 2, 2) }}/game sec</b></div>
          <div v-for="stage in snapshot.activeStages" :key="stage.key" class="c-am-stage"
            :class="{ 'c-am-stage--nerf': stage.before.gt(stage.after) }">
            <div class="c-am-stage-top">
              <span>{{ stage.display || stage.key }}</span>
              <b v-if="stage.before.gt(stage.after)">{{ reduction(stage) }}</b>
              <b v-else-if="stage.key === 'challengeCap'">Not binding</b>
              <b v-else>{{ format(stage.after, 2, 2) }}/sec</b>
            </div>
            <div v-if="stage.before.gt(stage.after)" class="c-am-stage-comparison">
              Before: {{ format(stage.before, 2, 2) }} → After: {{ format(stage.after, 2, 2) }}
            </div>
          </div>
          <div v-if="!modifiers.length && !capStages.length" class="c-am-stage">
            No active production modifiers or limits are changing the current output.
          </div>
          <div class="c-am-metric"><span>After gameplay powers and production caps</span>
            <b>{{ format(snapshot.perGameSecond, 2, 2) }}/game sec</b></div>
        </div>
      </div>
      <div class="c-am-metric c-am-conversion"><span>Game speed</span><b>{{ formatX(snapshot.speed, 2, 2) }}</b></div>
      <div v-if="snapshot.nc12" class="c-am-metric c-am-conversion">
        <span>NC12: additive AD2 output (after game speed)</span>
        <b>+{{ format(snapshot.ad2Real, 2, 2) }}/sec</b>
      </div>
      <div v-if="snapshot.mismatch" class="c-am-diagnostic">
        Formula check: the traced gameplay production differs from the AM/sec getter.
        Traced: {{ format(snapshot.calculated, 2, 2) }}/sec; getter:
        {{ format(snapshot.actual, 2, 2) }}/sec.
      </div>
      <div v-if="snapshot.voidRunning" class="c-am-diagnostic">
        Void mode credits transformed Antimatter per tick; displayed AM/sec is the normal production getter,
        not the actual credited Void gain.
      </div>
      <p class="c-am-explanation">
        The AD1 amount and multiplier feed a single Tickspeed rate, then the actual AD production powers and
        caps apply. Game speed converts game seconds into real seconds. Higher AD tiers increase AD1 amount
        over future ticks; their multiplier product is not instantaneous AM production.
        Cap losses compare the values immediately before and after each gameplay operation.
      </p>
    </div>
  </div>
</template>

<style scoped>
.c-am-breakdown {
  display: flex;
  gap: 0.6rem;
  box-sizing: border-box;
  width: 100%;
  padding: 0.5rem;
  border: 0.2rem solid var(--color-text);
  color: var(--color-text);
  background: var(--color-base);
  text-align: left;
  font-size: 1.12rem;
}
.c-am-visual { flex: 0 0 4.2rem; display: flex; flex-direction: column; border: 0.1rem solid var(--color-text); }
.c-am-visual div { display: flex; align-items: center; justify-content: center; color: #111; font-size: 1.8rem; }
.c-am-visual-ad { flex: 1; background: #e55353; }
.c-am-visual-tick { flex: 1; background: #b540cf; }
.c-am-visual-mod { flex: 0.5; background: #bb9341; }
.c-am-breakdown-content { flex: 1; min-width: 0; overflow-wrap: anywhere; }
.c-am-header, .c-am-section-title, .c-am-metric, .c-am-stage-top {
  display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 0.4rem 1rem;
}
.c-am-header { padding: 0.7rem 0.4rem; border-bottom: 0.1rem dashed var(--color-text); }
.c-am-header span { opacity: 0.7; }
.c-am-section { margin-top: 0.3rem; border: 0.1rem dashed var(--color-text); }
.c-am-section-title { width: 100%; padding: 0.55rem; border: 0; color: inherit;
  background: transparent; text-align: left; cursor: pointer; font: inherit; }
.c-am-section-title b { flex: 1; }
.c-am-section-title:hover, .c-am-section-title:focus-visible { background: var(--color-disabled); }
.c-am-inside { padding: 0.6rem; border-top: 0.1rem solid var(--color-text); line-height: 1.45; }
.c-am-metric { padding: 0.5rem 0.4rem; border-bottom: 0.1rem dashed var(--color-text); }
.c-am-metric b { text-align: right; }
.c-am-stage { padding: 0.45rem; border-bottom: 0.1rem dashed var(--color-text); }
.c-am-stage--nerf { border-left: 0.3rem solid var(--color-bad); }
.c-am-stage-comparison { margin: 0.3rem 0 0; opacity: 0.8; }
.c-am-conversion { margin-top: 0.3rem; }
.c-am-diagnostic { margin: 0.6rem 0; padding: 0.5rem; border: 0.1rem solid var(--color-bad); }
.c-am-explanation { margin: 0.8rem 0 0; line-height: 1.45; }
@media (max-width: 40rem) { .c-am-visual { flex-basis: 2.2rem; } .c-am-section-title b { flex-basis: 60%; } }
</style>
