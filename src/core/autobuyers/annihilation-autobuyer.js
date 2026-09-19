import { AutobuyerState } from "./autobuyer";

export class AnnihilationAutobuyerState extends AutobuyerState {
  get data() {
    return player.auto.annihilation;
  }

  get name() {
    return `Annihilation`;
  }

  get isUnlocked() {
    return SingularityMilestone.annihilationAutobuyer.canBeApplied;
  }

  get multiplier() {
    return this.data.multiplier;
  }

  set multiplier(value) {
    this.data.multiplier = value;
  }

  get bulk() {
    return 0;
  }

  get mode() {
    return this.data.mode;
  }

  get hasInput() {
    return true;
  }

  get inputType() {
    return "float";
  }

  get inputEntry() {
    return "multiplier";
  }

  tick() {
    // There is no further representable multiplier to earn at the established
    // Decimal ceiling. Avoid pointless repeated annihilations and DMD resets.
    if (Laitela.darkMatterMult.gte(DC.BEMAX)) return;
    const gain = Laitela.darkMatterMultGain;
    if (this.mode === 0 && gain.gte(this.multiplier)) {
      Laitela.annihilate();
    }

    // Comparing gain / current avoids an overflowing current * target multiplier.
    if (this.mode === 1 && gain.div(Laitela.darkMatterMult).gte(this.multiplier)) {
      Laitela.annihilate();
    }
  }
}
