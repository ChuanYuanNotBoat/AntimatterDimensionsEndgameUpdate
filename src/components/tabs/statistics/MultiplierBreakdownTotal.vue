<script>
import { BreakdownEntryInfo } from "./breakdown-entry-info";

// The live headline is independent of the expensive breakdown tree. The
// global UI mixin calls update() on every UI frame, just like the original
// statistics headline, while the parent only samples source impacts as needed.
export default {
  name: "MultiplierBreakdownTotal",
  props: {
    resource: {
      type: BreakdownEntryInfo,
      required: true,
    }
  },
  data() {
    return { text: "" };
  },
  watch: {
    resource() {
      this.update();
    }
  },
  created() {
    this.update();
  },
  methods: {
    update() {
      const resource = this.resource;
      const name = resource.name;
      const override = resource.displayOverride;
      if (override) {
        this.text = `${name}: ${override}`;
        return;
      }
      const value = resource.mult;
      this.text = resource.isBase
        ? `${name}: ${format(value, 2, 2)}`
        : `${name}: ${formatX(value, 2, 2)}`;
    }
  }
};
</script>

<template>
  <span>{{ text }}</span>
</template>
