import { Quotes } from "../quotes";

import { DarkMatterDimensions } from "./dark-matter-dimension";
import { boundedPositivePower, boundedPositiveProduct, boundedPositiveSum } from "../../finite-decimal";

export const Laitela = {
  displayName: "Lai'tela",
  possessiveName: "Lai'tela's",
  get celestial() {
    return player.celestials.laitela;
  },
  get isUnlocked() {
    if (EndgameMilestone.celestialEarlyUnlock.isReached) return true;
    return ImaginaryUpgrade(15).isBought;
  },
  initializeRun() {
    clearCelestialRuns();
    this.celestial.run = true;
  },
  get isRunning() {
    return this.celestial.run;
  },
  get difficultyTier() {
    return player.celestials.laitela.difficultyTier;
  },
  set difficultyTier(tier) {
    player.celestials.laitela.difficultyTier = tier;
  },
  get maxAllowedDimension() {
    return 8 - this.difficultyTier;
  },
  get isFullyDestabilized() {
    return Laitela.maxAllowedDimension === 0;
  },
  get continuumUnlocked() {
    if (EndgameMilestone.celestialEarlyUnlock.isReached) return true;
    return ImaginaryUpgrade(15).isBought;
  },
  get continuumActive() {
    return this.continuumUnlocked && !player.auto.disableContinuum;
  },
  setContinuum(x) {
    player.auto.disableContinuum = !x;
    // If continuum is now not disabled (i.e. is enabled) we update the relevant requirement check.
    if (!player.auto.disableContinuum) {
      player.requirementChecks.reality.noContinuum = false;
      player.requirementChecks.endgame.noContinuum = false;
    }
  },
  get matterExtraPurchaseFactor() {
    if ((Pelle.isDoomed && !PelleDestructionUpgrade.continuumBuff.canBeApplied) || player.disablePostReality) return DC.D1;
    // This factor feeds Continuum amounts directly. At extreme progression, the
    // original chained products and final Duality power can overflow Decimal's
    // *representation* before ID8's production rate gets a chance to bound it.
    // Preserve the original order, but cap each otherwise-valid operation at
    // the established BEMAX gameplay boundary, before it can become Infinity.
    const darkMatter = Currency.darkMatter.max;
    if ([darkMatter.sign, darkMatter.layer, darkMatter.mag].some(x => !Number.isFinite(x))) {
      throw new Error("Non-finite dark matter entering Continuum multiplier");
    }
    const darkMatterLog = new Decimal(Decimal.log10(boundedPositiveSum(darkMatter, 1))).div(50);
    let factor = boundedPositiveSum(boundedPositiveProduct(boundedPositivePower(darkMatterLog, 0.4), 0.5), 1);
    factor = boundedPositiveProduct(factor,
      boundedPositiveSum(SingularityMilestone.continuumMult.effectOrDefault(new Decimal(0)), 1));
    factor = boundedPositiveProduct(factor, DualityUpgrade(11).effectOrDefault(1));
    factor = boundedPositiveProduct(factor, Hadrons.continuumMultiplier);
    SingularityMilestone.singContinuumBoost.applyEffect(value => {
      factor = boundedPositiveProduct(factor, value);
    });
    factor = boundedPositivePower(factor, DualityUpgrade(14).effectOrDefault(1));
    return boundedPositiveProduct(factor,
      BreakInfinityUpgrade.autobuyerSpeed.chargedEffect.effectOrDefault(1));
  },
  get hadronizes() {
    return this.celestial.hadronizes;
  },
  get realityReward() {
    const fullLaitelaCompletion = Decimal.clampMin(Decimal.pow(100, 8).times(Decimal.pow(new Decimal(360).div(300), 2)), 1);
    const currentLaitelaProgress = Decimal.clampMin(Decimal.pow(100, this.difficultyTier).times(
      Decimal.pow(new Decimal(360).div(player.celestials.laitela.fastestCompletion), 2)), 1);
    return Decimal.pow(currentLaitelaProgress, this.hadronizes + 1).times(Decimal.pow(
      fullLaitelaCompletion, (this.hadronizes * (this.hadronizes + 1)) / 2));
  },
  get realityRewardDE() {
    const fullDestabilization = this.isFullyDestabilized ? Decimal.pow(8, this.hadronizes + 1) : DC.D1;
    return Decimal.pow(8, (this.hadronizes * (this.hadronizes + 1)) / 2).times(fullDestabilization);
  },
  // Note that entropy goes from 0 to 1, with 1 being completion
  get entropyGainPerSecond() {
    const maxSpeed = (ExpansionPack.laitelaPack.isBought && !player.disablePostReality) ? 1000 : 100;
    const hadronizeBump = this.hadronizes > 0 ? 1e12 : 1;
    const extraHadronizeBoost = DC.D1.times(Hadrons.entropyFormulaBoost).times(
      DivinityMilestone.firstDivine.isReached ? Decimal.log10(player.records.bestEndgame.galaxies.max(1)) : 1)
      .times(Accelerators.potency.effectValue2).times(
      DivinityMilestone.finalRebirth.isReached && !player.disablePostReality ? Time.thisEndgameRealTime.totalMinutes.pow(3).add(1) : 1)
      .timesEffectsOf(ResurgenceUpgrade.entropySurge, EndgameMastery(201), SingularityMilestone.continuumEntropyMult).pow(
      Achievements.powerConv(EndgameMastery(201).effectOrDefault(1)));
    const hadronizeAntimatter = Decimal.pow(1000, this.hadronizes).times(hadronizeBump).times(1e11).div(extraHadronizeBoost);
    return Decimal.clamp(Decimal.pow(new Decimal(Currency.antimatter.value.add(1).log10()).div(
      hadronizeAntimatter), 2), 0, maxSpeed).div(200);
  },
  get antimatterNeededToDestabilize() {
    const hadrBump = this.hadronizes > 0 ? 1e12 : 1;
    const extraHadrBoost = DC.D1.times(Hadrons.entropyFormulaBoost).times(
      DivinityMilestone.firstDivine.isReached ? Decimal.log10(player.records.bestEndgame.galaxies.max(1)) : 1)
      .times(Accelerators.potency.effectValue2).times(
      DivinityMilestone.finalRebirth.isReached && !player.disablePostReality ? Time.thisEndgameRealTime.totalMinutes.pow(3).add(1) : 1)
      .timesEffectsOf(ResurgenceUpgrade.entropySurge, EndgameMastery(201), SingularityMilestone.continuumEntropyMult).pow(
      Achievements.powerConv(EndgameMastery(201).effectOrDefault(1)));
    const hadrAM = Decimal.pow(1000, this.hadronizes).times(hadrBump).times(1e11).div(extraHadrBoost);
    const currRoot = (this.maxAllowedDimension === 0 ? DC.BEMAX : 8 / this.maxAllowedDimension);
    return Decimal.pow10(hadrAM).pow(Decimal.sqrt(20/3)).pow(currRoot);
  },
  get darkMatterMultGain() {
    const darkMatter = Currency.darkMatter.value;
    // Overflow must be prevented before the final addition in annihilate():
    // the expansion-pack exponent may make even a finite base unrepresentable.
    if ([darkMatter.sign, darkMatter.layer, darkMatter.mag].some(x => !Number.isFinite(x)) || darkMatter.lt(0)) {
      throw new Error("Invalid Dark Matter entering annihilation gain");
    }
    const imaginaryEffect = new Decimal(ImaginaryUpgrade(21).effectOrDefault(1));
    if ([imaginaryEffect.sign, imaginaryEffect.layer, imaginaryEffect.mag]
      .some(x => !Number.isFinite(x)) || imaginaryEffect.lt(0)) {
      throw new Error("Invalid Imaginary Upgrade 21 annihilation effect");
    }
    let extraPow = DC.D1;
    if (ExpansionPack.laitelaPack.isBought && !player.disablePostReality) {
      const innerLog = Decimal.log10(boundedPositiveSum(darkMatter, 1));
      const outerLog = Decimal.log10(boundedPositiveSum(innerLog, 1));
      extraPow = boundedPositiveSum(boundedPositivePower(boundedPositiveSum(outerLog, 1).div(2), 2), 1);
    }
    const base = boundedPositiveProduct(boundedPositivePower(
      boundedPositiveSum(darkMatter.dividedBy(this.annihilationDMRequirement), 1).log10(), 1.5), imaginaryEffect);
    return boundedPositivePower(base, extraPow);
  },
  get darkMatterMult() {
    return this.celestial.darkMatterMult;
  },
  get darkMatterMultAfterAnnihilation() {
    const current = this.celestial.darkMatterMult;
    if ([current.sign, current.layer, current.mag].some(x => !Number.isFinite(x)) || current.lte(0)) {
      throw new Error("Invalid saved annihilation multiplier");
    }
    // Do not decrease an existing above-boundary multiplier from a legacy save.
    if (current.gte(DC.BEMAX)) return current;
    return boundedPositiveSum(current, this.darkMatterMultGain);
  },
  get darkMatterMultRatio() {
    return this.darkMatterMultAfterAnnihilation.div(this.darkMatterMult);
  },
  get darkMatterSoftcap1() {
    return DC.E10000.times(EtherealStars.white.reward).powEffectOf(EndgameMastery(262));
  },
  get darkMatterSoftcap2() {
    return DC.E100000.times(EtherealStars.white.reward).powEffectOf(EndgameMastery(262));
  },
  get darkMatterCap() {
    let baseCap = DC.NUMMAX;
    if (ImaginaryUpgrade(26).isBought) baseCap = DC.E1000;
    if (ImaginaryUpgrade(27).isBought) baseCap = DC.E4000;
    if (ImaginaryUpgrade(28).isBought) baseCap = DC.E20000;
    if (ImaginaryUpgrade(29).isBought) baseCap = DC.E100000;
    const realityReward = (ExpansionPack.laitelaPack.isBought && !player.disablePostReality) ? this.realityReward : 1;
    return baseCap.times(EndgameUpgrade(4).effectOrDefault(1)).times(realityReward).times(
      Hadrons.darkMatterCapMultiplier).times(EtherealStars.white.reward).powEffectOf(EndgameMastery(262));
  },
  get darkMatterOmegaSoftcap() {
    return Decimal.pow10(6.5625e10);
  },
  get annihilationUnlocked() {
    return ImaginaryUpgrade(19).isBought;
  },
  get annihilationDMRequirement() {
    return 1e60;
  },
  get canAnnihilate() {
    return Laitela.annihilationUnlocked && Currency.darkMatter.gte(this.annihilationDMRequirement);
  },
  annihilate(force) {
    if (!force && !this.canAnnihilate) return false;
    this.celestial.darkMatterMult = this.darkMatterMultAfterAnnihilation;
    if (force || !DivinityMilestone.hadronEmpowerment.isReached) DarkMatterDimensions.reset();
    Laitela.quotes.annihilation.show();
    Achievement(176).unlock();
    return true;
  },
  // Greedily buys the cheapest available upgrade until none are affordable
  maxAllDMDimensions(maxTier) {
    // Note that tier is 1-indexed
    const unlockedDimensions = DarkMatterDimensions.all
      .filter(d => d.isUnlocked && d.tier <= maxTier);
    for (let i = 0; i < unlockedDimensions.length; i++) {
      unlockedDimensions[i].buyManyInterval(Infinity);
    }
    for (let i = 0; i < unlockedDimensions.length; i++) {
      unlockedDimensions[i].buyManyPowerDM(Infinity);
    }
    for (let i = 0; i < unlockedDimensions.length; i++) {
      unlockedDimensions[i].buyManyPowerDE(Infinity);
    }
  },
  hadronize() {
    if (!Laitela.isFullyDestabilized) return false;
    this.celestial.fastestCompletion = 3600;
    this.celestial.difficultyTier = 0;
    this.celestial.hadronizes += 1;
    if (DualityUpgrade(15).isBought) this.celestial.hadrons.total += 1;
    if (DualityUpgrade(15).isBought) this.celestial.hadrons.light += 1;
    if (DivinityMilestone.hadronEmpowerment.isReached) this.celestial.hadrons.dark += 1;
    return true;
  },
  reset() {
    this.annihilate(true);
    this.celestial.darkMatterMult = DC.D1;
    Currency.darkMatter.max = DC.D1;
    Currency.darkMatter.reset();
    Currency.unnerfedDarkMatter.reset();
    this.celestial.singularities = ExpansionPack.laitelaPack.isBought ? DC.E1 : DC.D0;
    this.celestial.singularityCapIncreases = DC.D0;
  },
  fullReset() {
    this.reset();
    this.celestial.fastestCompletion = 3600;
    this.celestial.difficultyTier = 0;
    this.celestial.hadronizes = 0;
    this.celestial.hadrons.total = 0;
    this.celestial.hadrons.light = 0;
    this.celestial.hadrons.dark = 0;
  },
  quotes: Quotes.laitela,
  symbol: "ᛝ"
};

EventHub.logic.on(GAME_EVENT.TAB_CHANGED, () => {
  if (Tab.celestials.laitela.isOpen) Laitela.quotes.unlock.show();
});
