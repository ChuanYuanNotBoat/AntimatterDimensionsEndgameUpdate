export const Ethereal = {
  get isUnlocked() {
    return GalacticPowers.etherealUnlock.isUnlocked;
  },
  get cosmicSector() {
    return player.endgame.ethereal.sector;
  },
  get sectorThreshold() {
    return Decimal.pow(this.cosmicSector, this.cosmicSector);
  },
  get sectorBoost() {
    if (player.disablePostReality && !Alpha.isRunning) return DC.D1;
    if (Alpha.isRunning) return Decimal.pow(2, this.cosmicSector - 1);
    return Decimal.pow(2, Math.pow(this.cosmicSector - 1, 2));
  },
  get isExtended() {
    return player.endgame.ethereal.isExtended;
  },
  get nextStar() {
    return EtherealStars.all.find(x => !x.isUnlocked);
  },
  get nextStarDMReq() {
    return this.nextStar?.dmReq;
  },
  get starBoost() {
    return EtherealStars.gray.reward;
  },
  get stellarProduct() {
    let prod = [];
    for (let star = 0; star < 9; star++) {
      if (EtherealStars.all.find(s => s.id === star).hasStar) {
        prod.push(player.endgame.ethereal.stars[EtherealStars.all.find(s => s.id === star).config.name]);
      }
    }
    return prod.reduce(Decimal.prodReducer, DC.D1);
  },
  get isStarPowerUnlocked() {
    return player.endgame.ethereal.isStarPowerUnlocked;
  },
  get starPower() {
    return player.endgame.ethereal.starPower;
  },
  get allStarBoost() {
    return Decimal.max(this.starPower.pow(0.2), 1);
  },
  get nextGeneration() {
    let arr = [];
    let unl = [6, 8, 10, 12, 15, 18, 21, 25, 30];
    for (let t = 0; t < 9; t++) {
      if (Ethereal.starPower.lt(Decimal.pow10(unl[t]))) arr.push(Decimal.pow10(unl[t]));
    }
    return arr[0];
  },
  starGeneration(tier) {
    let unl = [6, 8, 10, 12, 15, 18, 21, 25, 30][tier];
    if (Ethereal.starPower.lt(Decimal.pow10(unl))) return DC.D0;
    return Ethereal.starPower.max(1).log10().div(unl).pow(2).div(100);
  }
};

export class EtherealStarState {
  constructor(config) {
    this.config = config;
  }

  get id() {
    return this.config.id;
  }

  get reward() {
    return this.config.effect();
  }

  rewardForDisplay(amount) {
    return this.config.effect(amount);
  }

  get dmReq() {
    return this.config.dmReq;
  }

  get isUnlocked() {
    return Currency.dualMachines.value.gte(this.dmReq);
  }

  get canGainStar() {
    return Currency.etherealPower.gte(this.config.resetReq);
  }

  get hasStar() {
    return player.endgame.ethereal.stars[this.config.name].gte(1);
  }
}

export const EtherealStars = mapGameDataToObject(
  GameDatabase.endgame.stars,
  config => new EtherealStarState(config)
);

export function getEtherealPowerGainPerSecond() {
  const cpFactor = Decimal.pow(Decimal.log10(player.endgame.celestialPoints.add(1)).div(100), 10);
  const singFactor = Decimal.pow(Decimal.log10(player.celestials.laitela.singularities.add(1)).div(20000), 3);
  const rmFactor = Decimal.pow(Decimal.log10(Decimal.log10(player.reality.realityMachines.add(1)).add(1)).div(5), 75);
  const gpFactor = Decimal.pow(Decimal.log10(Decimal.max(player.endgame.galacticPower, DC.NUMMAX)).div(308.25), 5);
  const alphaBoost = player.disablePostReality ? DC.D1 : Decimal.pow(1.33, Alpha.currentStage);
  return cpFactor.times(singFactor).times(rmFactor).times(gpFactor).div(1000).times(
    Achievement(216).effectOrDefault(1)).times(alphaBoost).times(EtherealStars.blue.reward).times(
    DivineDimensions.conversionFormula1).times(DivinityMilestone.hadronEmpowerment.isReached ? 10 : 1).timesEffectOf(
    DivinityUpgrade.divineL2U3).times(DivinityMilestone.celestialSurge.isReached ? 1000 : 1).timesEffectsOf(
    ResurgenceUpgrade.ethSurge, ResurgenceUpgrade.synergy6, EndgameMastery(241), SingularityMilestone.singEthPowerBoost).times(
    DivinityMilestone.ascendedSurge.isReached ? getGameSpeedupForDisplay().max(10).log10() : 1);
}

export function tryAdvanceSector() {
  const current = player.endgame.ethereal.sector;
  if (!Number.isFinite(current) || !Number.isInteger(current) || current < 1) {
    throw new Error("Invalid saved Ethereal sector");
  }
  // Sector is stored as a native Number. Above this point integer increments
  // cannot be represented exactly; a larger range requires a save migration.
  // Do not lower an existing (possibly legacy) above-boundary sector.
  if (current >= Number.MAX_SAFE_INTEGER) return;

  const power = Currency.etherealPower.value;
  if ([power.sign, power.layer, power.mag].some(x => !Number.isFinite(x))) {
    throw new Error("Invalid Ethereal Power entering sector advancement");
  }
  if (Currency.etherealPower.lt(Ethereal.sectorThreshold)) return;
  if (!DivinityMilestone.ascendedSurge.isReached) {
    player.endgame.ethereal.sector = current + 1;
    return;
  }

  // The inverse of s^s is ln(power) / W(ln(power)); converting an enormous
  // inverse (or its difference from the old sector) to Number can write Infinity.
  // Check the exact integer-storage boundary in Decimal *before* inversion.
  const limit = Number.MAX_SAFE_INTEGER;
  const maxThreshold = Decimal.pow(limit - 1, limit - 1);
  if (power.gte(maxThreshold)) {
    player.endgame.ethereal.sector = limit;
    return;
  }

  // At power = 1, ln(power) / W(ln(power)) is 0/0. Its limit is 1.
  if (power.eq(1)) {
    player.endgame.ethereal.sector = 2;
    return;
  }

  const logarithm = power.ln();
  const highestPossibleSector = Decimal.floor(logarithm.div(Decimal.lambertw(logarithm))).add(1);
  if ([highestPossibleSector.sign, highestPossibleSector.layer, highestPossibleSector.mag]
    .some(x => !Number.isFinite(x)) || highestPossibleSector.lt(1) || highestPossibleSector.gte(limit)) {
    throw new Error("Invalid Ethereal sector inverse");
  }
  let target = Math.round(highestPossibleSector.toNumber());
  if (!Number.isSafeInteger(target)) throw new Error("Unsafe Ethereal sector conversion");
  // Lambert W and Decimal flooring can be off by one at an exact threshold.
  // Confirm the advancement against the actual s^s requirement.
  if (target > current + 1 && power.lt(Decimal.pow(target - 1, target - 1))) target--;
  if (target < limit && power.gte(Decimal.pow(target, target))) target++;
  if (target <= current) target = current + 1;
  if (target > current + 1 && power.lt(Decimal.pow(target - 1, target - 1))) {
    throw new Error("Ethereal sector inverse exceeds affordable threshold");
  }
  player.endgame.ethereal.sector = target;
}

export function resetForStar(id) {
  const gainedStarType = EtherealStars.all.find(x => x.id === id);
  const starName = gainedStarType.config.name;
  const resetReq = gainedStarType.config.resetReq;
  if (Currency.etherealPower.lt(resetReq) || !gainedStarType.isUnlocked) return;
  const resetFormula = Decimal.pow(Currency.etherealPower.value.div(resetReq), 0.5 - id / 20).times(Ethereal.allStarBoost);
  player.endgame.ethereal.power = DC.D0;
  player.endgame.ethereal.sector = 1;
  player.endgame.ethereal.stars[starName] = player.endgame.ethereal.stars[starName].add(resetFormula);
}

export function freeStarReset(id, diff) {
  const gainedStarType = EtherealStars.all.find(x => x.id === id);
  const starName = gainedStarType.config.name;
  const resetReq = gainedStarType.config.resetReq;
  if (Currency.etherealPower.lt(resetReq) || !gainedStarType.isUnlocked) return;
  const resetFormula = Decimal.pow(Currency.etherealPower.value.div(resetReq), 0.5 - id / 20).times(Ethereal.allStarBoost).times(
    Ethereal.starGeneration(id).times(diff).div(1000));
  player.endgame.ethereal.stars[starName] = player.endgame.ethereal.stars[starName].add(resetFormula);
}

export function getStarPowerGainPerSecond() {
  return Decimal.pow10(Ethereal.stellarProduct.div(DC.NUMMAX).max(1).log10().div(25));
}
