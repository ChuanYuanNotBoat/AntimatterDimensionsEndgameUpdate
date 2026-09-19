import { AutobuyerState } from "./autobuyer";
import { boundedPositiveSum } from "../finite-decimal";

export class BulkSingularityAutobuyerState extends AutobuyerState {
  get data() {
    return player.auto.bulkSingularity;
  }

  get name() {
    return `Bulk Singularity`;
  }

  get isUnlocked() {
    return ExpansionPack.laitelaPack.isBought && !player.disablePostReality;
  }

  get lowerBound() {
    return this.data.lowerBound;
  }

  set lowerBound(value) {
    this.data.lowerBound = value;
  }

  get upperBound() {
    return this.data.upperBound;
  }

  set upperBound(value) {
    this.data.upperBound = value;
  }

  get hasLowerBound() {
    return this.data.hasLowerBound;
  }

  set hasLowerBound(value) {
    this.data.hasLowerBound = value;
  }

  get hasUpperBound() {
    return this.data.hasUpperBound;
  }

  set hasUpperBound(value) {
    this.data.hasUpperBound = value;
  }

  get bulk() {
    return 0;
  }

  tick() {
    if (player.celestials.laitela.singularities.lte(10)) {
      player.celestials.laitela.singularityCapIncreases = DC.E1;
    }

    if (player.celestials.laitela.singularities.gt(10)) {
      if (Singularity.timePerCondense.gt(this.upperBound) && this.data.hasUpperBound && player.celestials.laitela.singularityCapIncreases.gt(0)) {
        const bulk = Decimal.floor(Decimal.log10(Singularity.timePerCondense.div(this.upperBound))).add(1);
        player.celestials.laitela.singularityCapIncreases = Decimal.max(player.celestials.laitela.singularityCapIncreases.sub(bulk), 0);
      }

      if (Singularity.timePerCondense.lt(this.lowerBound) && this.data.hasLowerBound) {
        const time = Singularity.timePerCondense;
        // log10(0) is NaN in break_eternity. A zero duration means the exact
        // count exceeds the Decimal type's representable range, so use its
        // existing representation boundary instead of evaluating that log.
        const bulk = time.eq(0) ? DC.BEMAX : (() => {
          const ratio = time.div(this.lowerBound).recip();
          // Retain the original ratio calculation whenever it is representable.
          // At extreme rates it can underflow to zero before reciprocal(), even
          // though the logarithmic ratio still has a valid Decimal value.
          const logRatio = Decimal.isFinite(ratio)
            ? Decimal.log10(ratio)
            : Decimal.log10(this.lowerBound).sub(Decimal.log10(time));
          return Decimal.floor(logRatio).add(1);
        })();
        player.celestials.laitela.singularityCapIncreases = boundedPositiveSum(
          player.celestials.laitela.singularityCapIncreases, bulk);
      }
    }
  }
}
